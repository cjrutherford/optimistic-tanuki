import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ICacheProvider, CacheStats } from './cache-provider.interface';
import { createClient, RedisClientType } from 'redis';

/**
 * Redis cache provider for permission checks
 * Distributed cache suitable for multi-instance deployments
 * Requires Redis server
 */
@Injectable()
export class RedisCacheProvider implements ICacheProvider, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheProvider.name);
  private client: RedisClientType;
  private readonly cacheTTL: number;
  private readonly keyPrefix: string;
  private hits = 0;
  private misses = 0;
  private isConnected = false;

  constructor(
    host = 'localhost',
    port = 6379,
    password?: string,
    db = 0,
    ttl = 5 * 60 * 1000,
    keyPrefix = 'permissions:'
  ) {
    this.cacheTTL = ttl;
    this.keyPrefix = keyPrefix;
    this.initRedis(host, port, password, db);
    this.logger.log(
      `RedisCacheProvider initialized with host=${host}, port=${port}, TTL=${ttl}ms`
    );
  }

  private async initRedis(
    host: string,
    port: number,
    password?: string,
    db?: number
  ): Promise<void> {
    try {
      this.client = createClient({
        socket: {
          host,
          port,
        },
        password,
        database: db,
      }) as RedisClientType;

      this.client.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        this.logger.warn('Disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error(`Failed to initialize Redis: ${error.message}`);
      this.isConnected = false;
    }
  }

  private getPrefixedKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get(key: string): Promise<boolean | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, returning null');
      this.misses++;
      return null;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key);
      const value = await this.client.get(prefixedKey);

      if (value === null) {
        this.misses++;
        this.logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      this.hits++;
      this.logger.debug(`Cache hit for key: ${key}`);
      return value === 'true';
    } catch (error) {
      this.misses++;
      this.logger.error(`Error reading from Redis for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: boolean, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping set operation');
      return;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key);
      const ttlSeconds = Math.floor((ttl || this.cacheTTL) / 1000);

      await this.client.setEx(prefixedKey, ttlSeconds, value.toString());
      this.logger.debug(`Cached value for key: ${key} = ${value} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      this.logger.error(`Error writing to Redis for key ${key}: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping delete operation');
      return;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key);
      await this.client.del(prefixedKey);
      this.logger.debug(`Deleted cache entry: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting from Redis for key ${key}: ${error.message}`);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping deletePattern operation');
      return;
    }

    try {
      const prefixedPattern = this.getPrefixedKey(pattern);
      const keys = await this.client.keys(prefixedPattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
        this.logger.log(`Deleted ${keys.length} cache entries matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting pattern from Redis: ${error.message}`);
    }
  }

  async clear(): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping clear operation');
      return;
    }

    try {
      const pattern = this.getPrefixedKey('*');
      const keys = await this.client.keys(pattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
      }

      this.hits = 0;
      this.misses = 0;
      this.logger.log(`Cleared all ${keys.length} cache entries`);
    } catch (error) {
      this.logger.error(`Error clearing Redis cache: ${error.message}`);
    }
  }

  async getStats(): Promise<CacheStats> {
    let size = 0;

    if (this.isConnected) {
      try {
        const pattern = this.getPrefixedKey('*');
        const keys = await this.client.keys(pattern);
        size = keys.length;
      } catch (error) {
        this.logger.error(`Error getting cache stats: ${error.message}`);
      }
    }

    return {
      size,
      ttlMs: this.cacheTTL,
      provider: 'redis',
      hits: this.hits,
      misses: this.misses,
    };
  }

  async cleanup(): Promise<void> {
    // Redis handles TTL expiration automatically, no manual cleanup needed
    this.logger.debug('Redis handles TTL expiration automatically');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.logger.log('Disconnected from Redis');
    }
  }
}
