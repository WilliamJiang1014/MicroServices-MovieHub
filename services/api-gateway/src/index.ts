import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { Logger, getRedisClient, CacheManager } from '@moviehub/shared';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.PORT || 3000;
const logger = new Logger('API-Gateway');

const redis = getRedisClient();
const cacheManager = new CacheManager(redis, {
  keyPrefix: 'gateway',
  defaultTTL: 1800,
});

app.use(cors());
app.use(express.json());

const AGGREGATION_URL = process.env.AGGREGATION_URL || 'http://localhost:3004';
const LLM_URL = process.env.LLM_URL || 'http://localhost:3001';
const USER_URL = process.env.USER_URL || 'http://localhost:3005';
const TMDB_URL = process.env.TMDB_URL || 'http://localhost:3002';
const OMDB_URL = process.env.OMDB_URL || 'http://localhost:3003';
const TVMAZE_URL = process.env.TVMAZE_URL || 'http://localhost:3006';

app.get('/health', async (req, res) => {
  try {
    const services = {
      gateway: 'healthy',
      aggregation: 'unknown',
      llm: 'unknown',
      user: 'unknown',
      tmdb: 'unknown',
      omdb: 'unknown',
      tvmaze: 'unknown',
    };

    const checks = await Promise.allSettled([
      axios.get(`${AGGREGATION_URL}/health`),
      axios.get(`${LLM_URL}/health`),
      axios.get(`${USER_URL}/health`),
      axios.get(`${TMDB_URL}/health`),
      axios.get(`${OMDB_URL}/health`),
      axios.get(`${TVMAZE_URL}/health`),
    ]);

    if (checks[0].status === 'fulfilled') services.aggregation = 'healthy';
    if (checks[1].status === 'fulfilled') services.llm = 'healthy';
    if (checks[2].status === 'fulfilled') services.user = 'healthy';
    if (checks[3].status === 'fulfilled') services.tmdb = 'healthy';
    if (checks[4].status === 'fulfilled') services.omdb = 'healthy';
    if (checks[5].status === 'fulfilled') services.tvmaze = 'healthy';

    res.json({ status: 'healthy', services });
  } catch (error: any) {
    logger.error('Error in health check:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to MovieHub API Gateway',
    version: '1.0.0',
    endpoints: {
      search: '/api/search?query=<movie_name>',
      movieDetails: '/api/movie/:id',
      movieSummary: '/api/movie/:id/summary',
      watchlist: '/api/users/:userId/watchlist',
      health: '/health',
    },
  });
});

/** 搜索电影（带缓存） */
app.get('/api/search', async (req, res) => {
  try {
    const query = (req.query.query || req.query.q) as string;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const sort = req.query.sort as string;
    
    logger.info(`Search request: ${query}`);

    const cached = await cacheManager.getCachedSearchResults(query, year, sort);
    if (cached) {
      logger.info(`Returning cached search results for: ${query}`);
      return res.json(cached);
    }

    const response = await axios.get(`${AGGREGATION_URL}/api/search`, {
      params: req.query,
    });

    await cacheManager.cacheSearchResults(query, year, response.data, undefined, sort);

    res.json(response.data);
  } catch (error: any) {
    logger.error('Error in /api/search:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** 获取电影详情（带缓存） */
app.get('/api/movie/:id', async (req, res) => {
  try {
    const movieId = req.params.id;
    logger.info(`Get movie details: ${movieId}`);

    const cached = await cacheManager.getCachedMovieDetails(movieId);
    if (cached) {
      logger.info(`Returning cached movie details for: ${movieId}`);
      return res.json(cached);
    }

    const response = await axios.get(`${AGGREGATION_URL}/api/movie/${movieId}`);

    await cacheManager.cacheMovieDetails(movieId, response.data, 7200);

    res.json(response.data);
  } catch (error: any) {
    logger.error('Error in /api/movie/:id:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** 获取AI生成的电影摘要和推荐 */
app.get('/api/movie/:id/summary', async (req, res) => {
  try {
    logger.info(`Get movie summary: ${req.params.id}`);
    
    const movieResponse = await axios.get(`${AGGREGATION_URL}/api/movie/${req.params.id}`);
    const movie = movieResponse.data.data;

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const summaryResponse = await axios.post(`${LLM_URL}/api/movie/summary`, {
      title: movie.title,
      plot: movie.plot,
      genres: movie.genres,
      year: movie.year,
    });

    res.json({
      success: true,
      data: {
        movie,
        aiSummary: summaryResponse.data,
      },
    });
  } catch (error: any) {
    logger.error('Error in /api/movie/:id/summary:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** 为任意电影查询生成AI摘要 */
app.post('/api/generate-summary', async (req, res) => {
  try {
    const response = await axios.post(`${LLM_URL}/api/movie/summary`, req.body);
    res.json(response.data);
  } catch (error: any) {
    logger.error('Error in /api/generate-summary:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** 获取用户信息 */
app.get('/api/users/:userId', async (req, res) => {
  try {
    const response = await axios.get(`${USER_URL}/api/user/${req.params.userId}`);
    res.json(response.data);
  } catch (error: any) {
    logger.error('Error in /api/users/:userId:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** 获取用户观影清单 */
app.get('/api/users/:userId/watchlist', async (req, res) => {
  try {
    const response = await axios.get(`${USER_URL}/api/watchlist/${req.params.userId}`, {
      params: req.query,
    });
    res.json(response.data);
  } catch (error: any) {
    logger.error('Error in /api/users/:userId/watchlist:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** 获取观影清单统计 */
app.get('/api/users/:userId/watchlist/stats', async (req, res) => {
  try {
    const response = await axios.get(`${USER_URL}/api/watchlist/${req.params.userId}/stats`);
    res.json(response.data);
  } catch (error: any) {
    logger.error('Error in /api/users/:userId/watchlist/stats:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** 添加电影到观影清单 */
app.post('/api/users/:userId/watchlist', async (req, res) => {
  try {
    logger.info(`Add to watchlist: ${req.body.movieId} for user ${req.params.userId}`);
    const response = await axios.post(`${USER_URL}/api/watchlist/${req.params.userId}`, req.body);
    res.json(response.data);
  } catch (error: any) {
    logger.error('Error in POST /api/users/:userId/watchlist:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** 更新观影清单项 */
app.patch('/api/watchlist/item/:itemId', async (req, res) => {
  try {
    const response = await axios.patch(`${USER_URL}/api/watchlist/item/${req.params.itemId}`, req.body);
    res.json(response.data);
  } catch (error: any) {
    logger.error('Error in PATCH /api/watchlist/item/:itemId:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** 删除观影清单项 */
app.delete('/api/watchlist/item/:itemId', async (req, res) => {
  try {
    const response = await axios.delete(`${USER_URL}/api/watchlist/item/${req.params.itemId}`);
    res.json(response.data);
  } catch (error: any) {
    logger.error('Error in DELETE /api/watchlist/item/:itemId:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** AI增强搜索 */
app.get('/api/search-enhanced', async (req, res) => {
  try {
    const query = req.query.query as string;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    logger.info(`Enhanced search request: ${query}`);

    const searchResponse = await axios.get(`${AGGREGATION_URL}/api/search`, {
      params: req.query,
    });

    const movies = searchResponse.data.data || [];

    const enhancedMovies = await Promise.all(
      movies.slice(0, 3).map(async (movie: any) => {
        try {
          const summaryResponse = await axios.post(`${LLM_URL}/api/movie/summary-only`, {
            title: movie.title,
            plot: movie.plot,
            genres: movie.genres,
          });
          return {
            ...movie,
            aiSummary: summaryResponse.data.summary,
          };
        } catch (error) {
          return movie;
        }
      })
    );

    res.json({
      success: true,
      data: [...enhancedMovies, ...movies.slice(3)],
      totalResults: searchResponse.data.totalResults,
    });
  } catch (error: any) {
    logger.error('Error in /api/search-enhanced:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
    });
  }
});

/** 获取热门搜索 */
app.get('/api/analytics/popular-searches', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const popularSearches = await cacheManager.getPopularSearches(limit);
    
    res.json({
      success: true,
      data: popularSearches,
    });
  } catch (error: any) {
    logger.error('Error in /api/analytics/popular-searches:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 获取缓存统计 */
app.get('/api/cache/stats', async (req, res) => {
  try {
    const stats = await cacheManager.getCacheStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Error in /api/cache/stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/** 清除缓存（管理端点） */
app.delete('/api/cache/clear', async (req, res) => {
  try {
    const type = req.query.type as string;
    
    if (type === 'search') {
      await cacheManager.invalidateSearchCache();
      logger.info('Search cache cleared');
    } else if (type === 'all') {
      await cacheManager.clearAll();
      logger.info('All cache cleared');
    } else {
      return res.status(400).json({ error: 'Invalid cache type' });
    }
    
    res.json({
      success: true,
      message: `${type} cache cleared`,
    });
  } catch (error: any) {
    logger.error('Error in /api/cache/clear:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  logger.info(`API Gateway listening on port ${port}`);
  logger.info(`Service URLs:`);
  logger.info(`  - Aggregation: ${AGGREGATION_URL}`);
  logger.info(`  - LLM: ${LLM_URL}`);
  logger.info(`  - User: ${USER_URL}`);
  logger.info(`  - TMDB: ${TMDB_URL}`);
  logger.info(`  - OMDb: ${OMDB_URL}`);
});

