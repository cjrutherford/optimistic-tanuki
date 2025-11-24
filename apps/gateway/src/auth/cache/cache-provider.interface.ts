/**
 * Interface for permission cache providers
 * Allows switching between different caching strategies (memory, file, Redis)
 */
export interface ICacheProvider {
  /**
   * Get a cached value by key
   * @returns The cached value or null if not found/expired
   */
  get(key: string): Promise<boolean | null>;

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in milliseconds (optional, uses default if not provided)
   */
  set(key: string, value: boolean, ttl?: number): Promise<void>;

  /**
   * Delete a specific key from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string): Promise<void>;

  /**
   * Clear all cached entries
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Clean up expired entries (implementation-specific)
   */
  cleanup(): Promise<void>;
}

export interface CacheStats {
  size: number;
  maxSize?: number;
  ttlMs: number;
  provider: 'memory' | 'file' | 'redis';
  hits?: number;
  misses?: number;
}

export interface CacheConfig {
  provider: 'memory' | 'file' | 'redis';
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Max cache size (for memory/file providers)
  
  // File-specific config
  cacheDir?: string;
  
  // Redis-specific config
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  redisDb?: number;
  redisKeyPrefix?: string;
}
