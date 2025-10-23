import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Logger, getRedisClient, CacheManager } from '@moviehub/shared';
import { QwenClient } from './qwen-client';
import { LLMRequest, MovieSummaryRequest } from '@moviehub/shared';

// 加载项目根目录的 .env 文件
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.PORT || 3001;
const logger = new Logger('LLM-Service');

app.use(cors());
app.use(express.json());

const qwenClient = new QwenClient(
  process.env.QWEN_API_KEY || '',
  process.env.QWEN_API_URL
);

// Initialize Redis and Cache Manager
const redis = getRedisClient();
const cacheManager = new CacheManager(redis, {
  keyPrefix: 'llm',
  defaultTTL: 86400, // 24 hours - LLM responses are expensive to generate
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'llm-service' });
});

// Generic chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const request: LLMRequest = req.body;
    
    if (!request.messages || request.messages.length === 0) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    const response = await qwenClient.chat(request);
    res.json(response);
  } catch (error: any) {
    logger.error('Error in /api/chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// Intent analysis endpoint for MCP Graph Orchestrator
app.post('/analyze-intent', async (req, res) => {
  try {
    const { query, context } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const intentAnalysisPrompt = `
你是一个电影搜索意图分析专家。请分析用户的查询意图，并返回JSON格式的结果。

用户查询: "${query}"
上下文: ${context || 'movie_search'}

请分析用户意图并返回以下JSON格式：
{
  "type": "search_movies|get_movie_details|compare_movies|recommend_movies",
  "confidence": 0.0-1.0,
  "reasoning": "分析原因",
  "extractedEntities": {
    "genres": ["科幻", "动作"],
    "years": [2020, 2021],
    "actors": ["演员名"],
    "directors": ["导演名"],
    "keywords": ["关键词"]
  },
  "searchStrategy": {
    "type": "direct_search|genre_search|popular_search",
    "parameters": {}
  }
}

意图类型说明：
- search_movies: 搜索电影
- get_movie_details: 获取电影详情
- compare_movies: 比较电影
- recommend_movies: 推荐电影

       搜索策略说明：
       - direct_search: 直接搜索关键词
       - genre_search: 按类型搜索（当查询包含类型关键词时）
       - popular_search: 搜索热门电影（当查询包含"热门"、"推荐"等词时）
       - director_search: 按导演搜索（当查询包含"导演"、"执导"等词时）

       示例：
       - "科幻电影" -> genre_search
       - "Christopher Nolan导演的电影" -> director_search
       - "热门电影" -> popular_search
       - "Dune" -> direct_search

       请只返回JSON，不要其他内容。`;

    const request: LLMRequest = {
      messages: [
        {
          role: 'user',
          content: intentAnalysisPrompt
        }
      ],
      model: 'qwen-plus',
      temperature: 0.1, // 低温度确保一致性
      max_tokens: 1000
    };

    const response = await qwenClient.chat(request);
    
    try {
      // 尝试解析LLM返回的JSON
      const intentResult = JSON.parse(response.content);
      
      res.json({
        success: true,
        result: intentResult
      });
    } catch (parseError) {
      logger.warn('Failed to parse LLM response as JSON:', response.content);
      // 如果解析失败，返回默认结果
      res.json({
        success: true,
        result: {
          type: 'search_movies',
          confidence: 0.7,
          reasoning: 'LLM response parsing failed, using default',
          extractedEntities: {},
          searchStrategy: {
            type: 'direct_search',
            parameters: {}
          }
        }
      });
    }
  } catch (error: any) {
    logger.error('Error in /analyze-intent:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Movie summary endpoint (with caching)
app.post('/api/movie/summary', async (req, res) => {
  try {
    const { title, plot, genres }: MovieSummaryRequest = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Try to get full summary from cache
    const cacheKey = `full:${title.toLowerCase()}`;
    const cached = await cacheManager.getCachedLLMSummary(title, 'full');
    
    if (cached) {
      logger.info(`Returning cached LLM summary for: ${title}`);
      return res.json(cached);
    }

    logger.info(`Generating new LLM summary for: ${title}`);

    const [summary, highlights, similarMovies] = await Promise.all([
      qwenClient.generateMovieSummary(title, plot, genres),
      qwenClient.generateHighlights(title, plot),
      qwenClient.generateSimilarMovies(title, genres, plot),
    ]);

    const response = {
      summary,
      highlights,
      similarMovies,
    };

    // Cache the full summary (24 hours)
    await cacheManager.cacheLLMSummary(title, 'full', response, 86400);

    res.json(response);
  } catch (error: any) {
    logger.error('Error in /api/movie/summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate summary only (with caching)
app.post('/api/movie/summary-only', async (req, res) => {
  try {
    const { title, plot, genres } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Try to get from cache
    const cached = await cacheManager.getCachedLLMSummary(title, 'short');
    
    if (cached) {
      logger.info(`Returning cached short summary for: ${title}`);
      return res.json(cached);
    }

    logger.info(`Generating new short summary for: ${title}`);
    
    const summary = await qwenClient.generateMovieSummary(title, plot, genres);
    const response = { summary };

    // Cache the short summary
    await cacheManager.cacheLLMSummary(title, 'short', response, 86400);

    res.json(response);
  } catch (error: any) {
    logger.error('Error in /api/movie/summary-only:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate similar movies (with caching)
app.post('/api/movie/similar', async (req, res) => {
  try {
    const { title, genres, plot } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Try to get from cache
    const cached = await cacheManager.getCachedLLMSummary(title, 'similar');
    
    if (cached) {
      logger.info(`Returning cached similar movies for: ${title}`);
      return res.json(cached);
    }

    logger.info(`Generating new similar movies for: ${title}`);

    const similarMovies = await qwenClient.generateSimilarMovies(title, genres, plot);
    const response = { similarMovies };

    // Cache the similar movies
    await cacheManager.cacheLLMSummary(title, 'similar', response, 86400);

    res.json(response);
  } catch (error: any) {
    logger.error('Error in /api/movie/similar:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  logger.info(`LLM Service listening on port ${port}`);
});

