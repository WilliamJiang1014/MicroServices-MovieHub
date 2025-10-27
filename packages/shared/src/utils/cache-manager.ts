import { RedisClient } from './redis-client';
import { Logger } from './logger';

export interface CacheConfig {
  defaultTTL?: number;
  keyPrefix?: string;
  enableLogging?: boolean;
}

export class CacheManager {
  private redis: RedisClient;
  private logger: Logger;
  private config: CacheConfig;

  constructor(redis: RedisClient, config: CacheConfig = {}) {
    this.redis = redis;
    this.logger = new Logger('CacheManager');
    this.config = {
      defaultTTL: 3600, // 1 hour
      keyPrefix: 'moviehub',
      enableLogging: true,
      ...config,
    };
  }

  /**
   * Generate cache key with prefix
   */
  private makeKey(...parts: string[]): string {
    return [this.config.keyPrefix, ...parts].filter(Boolean).join(':');
  }

  /**
   * Generic cache wrapper with fallback
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cacheKey = this.makeKey(key);
    
    // Try to get from cache
    const cached = await this.redis.get<T>(cacheKey);
    if (cached !== null) {
      if (this.config.enableLogging) {
        this.logger.info(`Cache HIT: ${cacheKey}`);
      }
      return cached;
    }

    if (this.config.enableLogging) {
      this.logger.info(`Cache MISS: ${cacheKey}`);
    }

    // Fetch fresh data
    const data = await fetcher();
    
    // Store in cache
    const cacheTTL = ttl ?? this.config.defaultTTL;
    await this.redis.set(cacheKey, data, cacheTTL);

    return data;
  }

  /**
   * Cache movie search results
   */
  async cacheSearchResults(
    query: string,
    year: number | undefined,
    results: any,
    ttl: number = 1800, // 30 minutes
    sort?: string
  ): Promise<void> {
    const key = this.makeKey('search', query.toLowerCase(), year?.toString() || 'any', sort || 'relevance');
    await this.redis.set(key, results, ttl);
    
    // Track popular searches
    await this.trackPopularSearch(query);
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(
    query: string,
    year: number | undefined,
    sort?: string
  ): Promise<any | null> {
    const key = this.makeKey('search', query.toLowerCase(), year?.toString() || 'any', sort || 'relevance');
    return await this.redis.get(key);
  }

  /**
   * Cache movie details
   */
  async cacheMovieDetails(
    movieId: string,
    data: any,
    ttl: number = 7200 // 2 hours
  ): Promise<void> {
    const key = this.makeKey('movie', movieId);
    await this.redis.set(key, data, ttl);
  }

  /**
   * Get cached movie details
   */
  async getCachedMovieDetails(movieId: string): Promise<any | null> {
    const key = this.makeKey('movie', movieId);
    return await this.redis.get(key);
  }

  /**
   * Cache LLM-generated summary
   */
  async cacheLLMSummary(
    title: string,
    summaryType: 'full' | 'short' | 'highlights' | 'similar',
    data: any,
    ttl: number = 86400 // 24 hours - LLM results are expensive
  ): Promise<void> {
    const key = this.makeKey('llm', summaryType, title.toLowerCase());
    await this.redis.set(key, data, ttl);
  }

  /**
   * Get cached LLM summary
   */
  async getCachedLLMSummary(
    title: string,
    summaryType: 'full' | 'short' | 'highlights' | 'similar'
  ): Promise<any | null> {
    const key = this.makeKey('llm', summaryType, title.toLowerCase());
    return await this.redis.get(key);
  }

  /**
   * Cache provider API response
   */
  async cacheProviderResponse(
    provider: string,
    endpoint: string,
    params: Record<string, any>,
    data: any,
    ttl: number = 3600 // 1 hour
  ): Promise<void> {
    const paramsKey = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    
    const key = this.makeKey('provider', provider, endpoint, paramsKey);
    await this.redis.set(key, data, ttl);
  }

  /**
   * Get cached provider response
   */
  async getCachedProviderResponse(
    provider: string,
    endpoint: string,
    params: Record<string, any>
  ): Promise<any | null> {
    const paramsKey = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    
    const key = this.makeKey('provider', provider, endpoint, paramsKey);
    return await this.redis.get(key);
  }

  /**
   * Track popular search query
   */
  async trackPopularSearch(query: string): Promise<void> {
    const key = this.makeKey('popular-searches');
    const timestamp = Date.now();
    await this.redis.addToSortedSet(key, timestamp, query.toLowerCase());
  }

  /**
   * Get popular searches
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    const key = this.makeKey('popular-searches');
    return await this.redis.getTopFromSortedSet(key, limit);
  }

  /**
   * Track API rate limiting
   */
  async trackAPICall(
    provider: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = this.makeKey('rate-limit', provider);
    const count = await this.redis.increment(key, windowSeconds);
    
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    if (!allowed) {
      this.logger.warn(`Rate limit exceeded for provider: ${provider}`);
    }

    return { allowed, remaining };
  }

  /**
   * Cache watchlist
   */
  async cacheWatchlist(
    userId: string,
    data: any,
    ttl: number = 300 // 5 minutes - user data changes frequently
  ): Promise<void> {
    const key = this.makeKey('watchlist', userId);
    await this.redis.set(key, data, ttl);
  }

  /**
   * Get cached watchlist
   */
  async getCachedWatchlist(userId: string): Promise<any | null> {
    const key = this.makeKey('watchlist', userId);
    return await this.redis.get(key);
  }

  /**
   * Invalidate watchlist cache
   */
  async invalidateWatchlist(userId: string): Promise<void> {
    const key = this.makeKey('watchlist', userId);
    await this.redis.delete(key);
  }

  /**
   * Invalidate all caches for a specific movie
   */
  async invalidateMovie(movieId: string): Promise<void> {
    const pattern = this.makeKey('movie', movieId);
    await this.redis.delete(pattern);
  }

  /**
   * Invalidate search cache
   */
  async invalidateSearchCache(query?: string): Promise<void> {
    if (query) {
      // Clear specific query from all services
      // Patterns: *:search:query:*:*
      const patterns = [
        `*:search:${query.toLowerCase()}:*`,
        `aggregation:search:${query.toLowerCase()}:*`,
        `provider:*:search:*${query.toLowerCase()}*`,
      ];
      
      for (const pattern of patterns) {
        await this.redis.deletePattern(pattern);
      }
    } else {
      // Clear all search caches from all services
      const patterns = [
        'aggregation:search:*',
        'provider:*:search:*',
        this.makeKey('search', '*'),
      ];
      
      for (const pattern of patterns) {
        await this.redis.deletePattern(pattern);
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    isConnected: boolean;
    popularSearches: string[];
  }> {
    return {
      isConnected: this.redis.isReady(),
      popularSearches: await this.getPopularSearches(10),
    };
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    const pattern = this.makeKey('*');
    await this.redis.deletePattern(pattern);
    this.logger.info('All caches cleared');
  }
}



