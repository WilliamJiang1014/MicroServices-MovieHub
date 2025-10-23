import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Logger, getRedisClient, CacheManager } from '@moviehub/shared';
import { TMDBClient } from './tmdb-client';
import { MovieSearchParams } from '@moviehub/shared';

// 加载项目根目录的 .env 文件
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.PORT || 3002;
const logger = new Logger('TMDB-Provider');

app.use(cors());
app.use(express.json());

const tmdbClient = new TMDBClient(process.env.TMDB_API_KEY || '');

// Initialize Redis and Cache Manager
const redis = getRedisClient();
const cacheManager = new CacheManager(redis, {
  keyPrefix: 'provider:tmdb',
  defaultTTL: 3600, // 1 hour for provider data
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'provider-tmdb' });
});

// Search movies (with caching)
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
      'tmdb',
      'search',
      params as Record<string, any>
    );

    if (cached) {
      logger.info(`Returning cached TMDB search for: ${params.query}`);
      return res.json(cached);
    }

    const result = await tmdbClient.search(params);

    // Only cache successful results
    if (result.success) {
      await cacheManager.cacheProviderResponse(
        'tmdb',
        'search',
        params as Record<string, any>,
        result,
        3600
      );
    } else {
      logger.warn(`Skipping cache for TMDB search due to failure: ${params.query}`);
    }

    res.json(result);
  } catch (error: any) {
    logger.error('Error in /api/search:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get movie by ID (with caching)
app.get('/api/movie/:id', async (req, res) => {
  try {
    const movieId = req.params.id;
    
    // Try cache first
    const cached = await cacheManager.getCachedProviderResponse(
      'tmdb',
      'movie',
      { id: movieId }
    );

    if (cached) {
      logger.info(`Returning cached TMDB movie: ${movieId}`);
      return res.json(cached);
    }

    const result = await tmdbClient.getById(movieId);

    // Cache only if successful (longer TTL for movie details)
    if (result.success) {
      await cacheManager.cacheProviderResponse(
        'tmdb',
        'movie',
        { id: movieId },
        result,
        7200 // 2 hours
      );
    } else {
      logger.warn(`Skipping cache for TMDB movie due to failure: ${movieId}`);
    }

    res.json(result);
  } catch (error: any) {
    logger.error('Error in /api/movie/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get movie by external ID
app.get('/api/movie/external/:type/:id', async (req, res) => {
  try {
    const type = req.params.type as 'imdb' | 'tmdb';
    const id = req.params.id;

    if (!['imdb', 'tmdb'].includes(type)) {
      return res.status(400).json({ error: 'Type must be imdb or tmdb' });
    }

    const result = await tmdbClient.getByExternalId(id, type);
    // Only cache successful results for external lookups
    if (result.success) {
      await cacheManager.cacheProviderResponse(
        'tmdb',
        'external',
        { type, id },
        result,
        7200
      );
    } else {
      logger.warn(`Skipping cache for TMDB external lookup due to failure: ${type}:${id}`);
    }
    res.json(result);
  } catch (error: any) {
    logger.error('Error in /api/movie/external/:type/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  logger.info(`TMDB Provider listening on port ${port}`);
});

