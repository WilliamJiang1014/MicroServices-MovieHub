import Redis, { RedisOptions } from 'ioredis';
import { Logger } from './logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class RedisClient {
  private client: Redis;
  private logger: Logger;
  private isConnected: boolean = false;

  constructor(options?: RedisOptions) {
    this.logger = new Logger('RedisClient');
    
    const defaultOptions: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    this.client = new Redis({ ...defaultOptions, ...options });

    this.client.on('connect', () => {
      this.logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.logger.info('Redis client connected and ready');
    });

    this.client.on('error', (err: Error) => {
      this.logger.error('Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.info('Redis client reconnecting...');
    });
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, returning null');
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping set');
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.error(`Error deleting pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, ttl?: number): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const value = await this.client.incr(key);
      
      if (ttl && value === 1) {
        // Only set TTL on first increment
        await this.client.expire(key, ttl);
      }
      
      return value;
    } catch (error) {
      this.logger.error(`Error incrementing key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get TTL of a key
   */
  async getTTL(key: string): Promise<number> {
    if (!this.isConnected) {
      return -2;
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Add item to a set
   */
  async addToSet(key: string, ...values: string[]): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      return await this.client.sadd(key, ...values);
    } catch (error) {
      this.logger.error(`Error adding to set ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get all members of a set
   */
  async getSet(key: string): Promise<string[]> {
    if (!this.isConnected) {
      return [];
    }

    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.logger.error(`Error getting set ${key}:`, error);
      return [];
    }
  }

  /**
   * Add item to sorted set with score
   */
  async addToSortedSet(key: string, score: number, value: string): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      return await this.client.zadd(key, score, value);
    } catch (error) {
      this.logger.error(`Error adding to sorted set ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get top N items from sorted set
   */
  async getTopFromSortedSet(key: string, limit: number = 10): Promise<string[]> {
    if (!this.isConnected) {
      return [];
    }

    try {
      return await this.client.zrevrange(key, 0, limit - 1);
    } catch (error) {
      this.logger.error(`Error getting sorted set ${key}:`, error);
      return [];
    }
  }

  /**
   * Flush all cache
   */
  async flushAll(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.flushall();
      this.logger.info('Redis cache flushed');
      return true;
    } catch (error) {
      this.logger.error('Error flushing cache:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  isReady(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  /**
   * Close the connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.info('Redis client disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Redis:', error);
    }
  }

  /**
   * Get raw Redis client (for advanced operations)
   */
  getClient(): Redis {
    return this.client;
  }
}

// Singleton instance
let redisInstance: RedisClient | null = null;

export function getRedisClient(options?: RedisOptions): RedisClient {
  if (!redisInstance) {
    redisInstance = new RedisClient(options);
  }
  return redisInstance;
}

