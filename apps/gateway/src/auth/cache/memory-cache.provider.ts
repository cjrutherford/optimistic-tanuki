import { Injectable, Logger } from '@nestjs/common';
import { ICacheProvider, CacheStats } from './cache-provider.interface';

interface CacheEntry {
  value: boolean;
  timestamp: number;
}

/**
 * In-memory cache provider for permission checks
 * Fast but does not persist across restarts
 * Best for single-instance deployments
 */
@Injectable()
export class MemoryCacheProvider implements ICacheProvider {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly logger = new Logger(MemoryCacheProvider.name);
  
  private readonly cacheTTL: number;
  private readonly maxCacheSize: number;
  private hits = 0;
  private misses = 0;

  constructor(ttl = 5 * 60 * 1000, maxSize = 10000) {
    this.cacheTTL = ttl;
    this.maxCacheSize = maxSize;
    this.logger.log(`MemoryCacheProvider initialized with TTL=${ttl}ms, maxSize=${maxSize}`);
  }

  async get(key: string): Promise<boolean | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      this.logger.debug(`Cache miss for key: ${key}`);
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > this.cacheTTL) {
      this.misses++;
      this.logger.debug(`Cache entry expired for key: ${key} (age: ${age}ms)`);
      this.cache.delete(key);
      return null;
    }

    this.hits++;
    this.logger.debug(`Cache hit for key: ${key}`);
    return entry.value;
  }

  async set(key: string, value: boolean, ttl?: number): Promise<void> {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.logger.debug(`Cache full, evicted oldest entry: ${firstKey}`);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    this.logger.debug(`Cached value for key: ${key} = ${value}`);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.logger.debug(`Deleted cache entry: ${key}`);
  }

  async deletePattern(pattern: string): Promise<void> {
    let count = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    this.logger.log(`Deleted ${count} cache entries matching pattern: ${pattern}`);
  }

  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.logger.log(`Cleared all ${size} cache entries`);
  }

  async getStats(): Promise<CacheStats> {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMs: this.cacheTTL,
      provider: 'memory',
      hits: this.hits,
      misses: this.misses,
    };
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > this.cacheTTL) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.logger.debug(`Cleaned up ${count} expired cache entries`);
    }
  }
}
