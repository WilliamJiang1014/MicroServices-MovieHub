import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Logger, getRedisClient, CacheManager } from '@moviehub/shared';
import { TVMazeClient } from './tvmaze-client';
import { MovieSearchParams } from '@moviehub/shared';

// 加载项目根目录的 .env 文件
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.PORT || 3006;
const logger = new Logger('TVMaze-Provider');

app.use(cors());
app.use(express.json());

const tvmazeClient = new TVMazeClient();

// Initialize Redis and Cache Manager
const redis = getRedisClient();
const cacheManager = new CacheManager(redis, {
  keyPrefix: 'provider:tvmaze',
  defaultTTL: 3600, // 1 hour for provider data
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'provider-tvmaze' });
});

// Search shows (with caching)
app.get('/api/search', async (req, res) => {
  try {
    const params: MovieSearchParams = {
      query: req.query.query as string,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
    };

    if (!params.query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Try cache first
    const cached = await cacheManager.getCachedProviderResponse(
      'tvmaze',
      'search',
      params as Record<string, any>
    );

    if (cached) {
      logger.info(`Returning cached TVMaze search for: ${params.query}`);
      return res.json(cached);
    }

    const result = await tvmazeClient.search(params);

    // Cache the result
    await cacheManager.cacheProviderResponse(
      'tvmaze',
      'search',
      params as Record<string, any>,
      result,
      3600
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Error in /api/search:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get show by ID (with caching)
app.get('/api/movie/:id', async (req, res) => {
  try {
    const showId = req.params.id;
    
    // Try cache first
    const cached = await cacheManager.getCachedProviderResponse(
      'tvmaze',
      'movie',
      { id: showId }
    );

    if (cached) {
      logger.info(`Returning cached TVMaze show: ${showId}`);
      return res.json(cached);
    }

    const result = await tvmazeClient.getById(showId);

    // Cache the result (longer TTL for show details)
    await cacheManager.cacheProviderResponse(
      'tvmaze',
      'movie',
      { id: showId },
      result,
      7200 // 2 hours
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Error in /api/movie/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get show by external ID (with caching)
app.get('/api/movie/external/:type/:id', async (req, res) => {
  try {
    const type = req.params.type as 'imdb' | 'tmdb';
    const id = req.params.id;

    if (!['imdb', 'tmdb'].includes(type)) {
      return res.status(400).json({ error: 'Type must be imdb or tmdb' });
    }

    // Try cache first
    const cached = await cacheManager.getCachedProviderResponse(
      'tvmaze',
      'external',
      { type, id }
    );

    if (cached) {
      logger.info(`Returning cached TVMaze external lookup: ${type}:${id}`);
      return res.json(cached);
    }

    const result = await tvmazeClient.getByExternalId(id, type);

    // Cache the result
    await cacheManager.cacheProviderResponse(
      'tvmaze',
      'external',
      { type, id },
      result,
      7200 // 2 hours
    );

    res.json(result);
  } catch (error: any) {
    logger.error('Error in /api/movie/external/:type/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  logger.info(`TVMaze Provider listening on port ${port}`);
});


