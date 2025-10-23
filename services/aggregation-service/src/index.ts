import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { Logger, Movie, ProviderResponse, MovieSearchParams, getRedisClient, CacheManager } from '@moviehub/shared';
import { MovieAggregator } from './aggregator';

// 加载项目根目录的 .env 文件
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.PORT || 3004;
const logger = new Logger('Aggregation-Service');

app.use(cors());
app.use(express.json());

const aggregator = new MovieAggregator();

// Initialize Redis and Cache Manager
const redis = getRedisClient();
const cacheManager = new CacheManager(redis, {
  keyPrefix: 'aggregation',
  defaultTTL: 1800, // 30 minutes
});

// Provider URLs
const TMDB_PROVIDER_URL = process.env.TMDB_PROVIDER_URL || 'http://localhost:3002';
const OMDB_PROVIDER_URL = process.env.OMDB_PROVIDER_URL || 'http://localhost:3003';
const TVMAZE_PROVIDER_URL = process.env.TVMAZE_PROVIDER_URL || 'http://localhost:3006';

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'aggregation-service' });
});

// Aggregate search across multiple providers (with caching)
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

    logger.info(`Aggregating search for: ${params.query}`);

    // Try to get from cache first
    const sortMode = (req.query.sort as string) || 'relevance';
    const cached = await cacheManager.getCachedSearchResults(params.query, params.year, sortMode);
    if (cached) {
      logger.info(`Returning cached aggregated results for: ${params.query}`);
      return res.json(cached);
    }

    // Call all providers in parallel
    const [tmdbResult, omdbResult, tvmazeResult] = await Promise.allSettled([
      axios.get<ProviderResponse<Movie[]>>(`${TMDB_PROVIDER_URL}/api/search`, { params }),
      axios.get<ProviderResponse<Movie[]>>(`${OMDB_PROVIDER_URL}/api/search`, { params }),
      axios.get<ProviderResponse<Movie[]>>(`${TVMAZE_PROVIDER_URL}/api/search`, { params }),
    ]);

    // Collect successful results
    const allMovies: Movie[] = [];

    // Log results from each provider
    if (tmdbResult.status === 'fulfilled' && tmdbResult.value.data.success) {
      allMovies.push(...(tmdbResult.value.data.data || []));
      logger.info(`TMDB: Found ${tmdbResult.value.data.data?.length || 0} movies`);
    } else {
      logger.warn(`TMDB: Failed - ${tmdbResult.status === 'rejected' ? tmdbResult.reason?.message : 'Invalid response'}`);
    }
    
    if (omdbResult.status === 'fulfilled' && omdbResult.value.data.success) {
      allMovies.push(...(omdbResult.value.data.data || []));
      logger.info(`OMDb: Found ${omdbResult.value.data.data?.length || 0} movies`);
    } else {
      logger.warn(`OMDb: Failed - ${omdbResult.status === 'rejected' ? omdbResult.reason?.message : 'Invalid response'}`);
    }
    
    if (tvmazeResult.status === 'fulfilled' && tvmazeResult.value.data.success) {
      allMovies.push(...(tvmazeResult.value.data.data || []));
      logger.info(`TVMaze: Found ${tvmazeResult.value.data.data?.length || 0} movies`);
    } else {
      logger.warn(`TVMaze: Failed - ${tvmazeResult.status === 'rejected' ? tvmazeResult.reason?.message : 'Invalid response'}`);
    }

    // Deduplicate and sort
    const uniqueMovies = aggregator.deduplicateMovies(allMovies);
    const sortedMovies = aggregator.sortMovies(uniqueMovies, sortMode, params.query);

    // Add weighted ratings
    const moviesWithRatings = sortedMovies.slice(0, params.limit).map(movie => ({
      ...movie,
      aggregatedRating: aggregator.calculateWeightedRating(movie),
    }));

    const response = {
      success: true,
      data: moviesWithRatings,
      totalResults: sortedMovies.length,
    };

    // If any provider call failed, avoid caching to prevent stale partial data being reused
    const anyProviderFailed = !(
      (tmdbResult.status === 'fulfilled' && tmdbResult.value.data.success) ||
      (omdbResult.status === 'fulfilled' && omdbResult.value.data.success) ||
      (tvmazeResult.status === 'fulfilled' && tvmazeResult.value.data.success)
    );

    if (!anyProviderFailed) {
      await cacheManager.cacheSearchResults(params.query, params.year, response, undefined, sortMode);
    } else {
      logger.warn(`Skipping cache for aggregated search due to provider failure: ${params.query}`);
    }

    res.json(response);
  } catch (error: any) {
    logger.error('Error in /api/search:', error);
    res.status(500).json({ error: error.message });
  }
});

// Aggregate movie details from multiple providers (with caching)
app.get('/api/movie/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`Aggregating movie details for: ${id}`);

    // Try to get from cache first
    const cached = await cacheManager.getCachedMovieDetails(id);
    if (cached) {
      logger.info(`Returning cached aggregated movie details for: ${id}`);
      return res.json(cached);
    }

    // Determine which provider to use based on ID prefix
    let movie: Movie | null = null;

    if (id.startsWith('tmdb-')) {
      const tmdbId = id.replace('tmdb-', '');
      const response = await axios.get<ProviderResponse<Movie>>(
        `${TMDB_PROVIDER_URL}/api/movie/${tmdbId}`
      );
      if (response.data.success) {
        movie = response.data.data!;
      }
    } else if (id.startsWith('omdb-')) {
      const imdbId = id.replace('omdb-', '');
      const response = await axios.get<ProviderResponse<Movie>>(
        `${OMDB_PROVIDER_URL}/api/movie/${imdbId}`
      );
      if (response.data.success) {
        movie = response.data.data!;
      }
    } else if (id.startsWith('tvmaze-')) {
      const tvmazeId = id.replace('tvmaze-', '');
      const response = await axios.get<ProviderResponse<Movie>>(
        `${TVMAZE_PROVIDER_URL}/api/movie/${tvmazeId}`
      );
      if (response.data.success) {
        movie = response.data.data!;
      }
    }

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    // Try to enrich with data from other providers using external IDs
    const enrichmentPromises: Promise<any>[] = [];

    if (movie.externalIds.imdb && !id.startsWith('omdb-')) {
      enrichmentPromises.push(
        axios.get<ProviderResponse<Movie>>(
          `${OMDB_PROVIDER_URL}/api/movie/${movie.externalIds.imdb}`
        ).catch(() => null)
      );
    }

    if (movie.externalIds.tmdb && !id.startsWith('tmdb-')) {
      enrichmentPromises.push(
        axios.get<ProviderResponse<Movie>>(
          `${TMDB_PROVIDER_URL}/api/movie/${movie.externalIds.tmdb}`
        ).catch(() => null)
      );
    }

    if (movie.externalIds.tvmaze && !id.startsWith('tvmaze-')) {
      enrichmentPromises.push(
        axios.get<ProviderResponse<Movie>>(
          `${TVMAZE_PROVIDER_URL}/api/movie/${movie.externalIds.tvmaze}`
        ).catch(() => null)
      );
    }

    if (movie.externalIds.imdb && !id.startsWith('tvmaze-')) {
      enrichmentPromises.push(
        axios.get<ProviderResponse<Movie>>(
          `${TVMAZE_PROVIDER_URL}/api/movie/external/imdb/${movie.externalIds.imdb}`
        ).catch(() => null)
      );
    }

    const enrichmentResults = await Promise.all(enrichmentPromises);
    const additionalMovies: Movie[] = enrichmentResults
      .filter(result => result && result.data.success)
      .map(result => result.data.data!);

    // Merge all data
    const allMovieData = [movie, ...additionalMovies];
    const mergedMovie = aggregator.mergeMovies(allMovieData);
    const aggregatedRating = aggregator.calculateWeightedRating(mergedMovie);

    const response = {
      success: true,
      data: {
        ...mergedMovie,
        aggregatedRating,
      },
    };

    // Cache the aggregated movie details (longer TTL)
    await cacheManager.cacheMovieDetails(id, response, 7200); // 2 hours

    res.json(response);
  } catch (error: any) {
    logger.error('Error in /api/movie/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Merge multiple movies
app.post('/api/merge', async (req, res) => {
  try {
    const { movies }: { movies: Movie[] } = req.body;

    if (!movies || movies.length === 0) {
      return res.status(400).json({ error: 'Movies array is required' });
    }

    const merged = aggregator.mergeMovies(movies);
    const aggregatedRating = aggregator.calculateWeightedRating(merged);

    res.json({
      success: true,
      data: {
        ...merged,
        aggregatedRating,
      },
    });
  } catch (error: any) {
    logger.error('Error in /api/merge:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  logger.info(`Aggregation Service listening on port ${port}`);
});

