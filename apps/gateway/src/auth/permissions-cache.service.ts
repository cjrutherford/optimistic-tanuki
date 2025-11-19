import { Injectable, Logger } from '@nestjs/common';

/**
 * Cache entry for a permission check result
 */
interface PermissionCacheEntry {
  granted: boolean;
  timestamp: number;
}

/**
 * Service for caching permission check results to reduce load on the permissions service
 * and improve response times for frequently checked permissions.
 * 
 * Uses an in-memory LRU-style cache with TTL (Time To Live) expiration.
 */
@Injectable()
export class PermissionsCacheService {
  private readonly cache = new Map<string, PermissionCacheEntry>();
  private readonly logger = new Logger(PermissionsCacheService.name);
  
  // Cache TTL in milliseconds (default: 5 minutes)
  private readonly cacheTTL = 5 * 60 * 1000;
  
  // Maximum cache size (LRU eviction when exceeded)
  private readonly maxCacheSize = 10000;

  /**
   * Generate a unique cache key for a permission check
   */
  private getCacheKey(
    profileId: string,
    permission: string,
    appScopeId: string,
    targetId?: string
  ): string {
    return `${profileId}:${permission}:${appScopeId}:${targetId || 'null'}`;
  }

  /**
   * Check if a cached permission result exists and is still valid
   */
  get(
    profileId: string,
    permission: string,
    appScopeId: string,
    targetId?: string
  ): boolean | null {
    const key = this.getCacheKey(profileId, permission, appScopeId, targetId);
    const entry = this.cache.get(key);

    if (!entry) {
      this.logger.debug(`Cache miss for key: ${key}`);
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if entry has expired
    if (age > this.cacheTTL) {
      this.logger.debug(`Cache entry expired for key: ${key} (age: ${age}ms)`);
      this.cache.delete(key);
      return null;
    }

    this.logger.debug(`Cache hit for key: ${key}`);
    return entry.granted;
  }

  /**
   * Store a permission check result in the cache
   */
  set(
    profileId: string,
    permission: string,
    appScopeId: string,
    granted: boolean,
    targetId?: string
  ): void {
    const key = this.getCacheKey(profileId, permission, appScopeId, targetId);
    
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry (first entry in the Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.logger.debug(`Cache full, evicted oldest entry: ${firstKey}`);
      }
    }

    this.cache.set(key, {
      granted,
      timestamp: Date.now(),
    });

    this.logger.debug(`Cached permission check result for key: ${key} = ${granted}`);
  }

  /**
   * Invalidate cached permissions for a specific profile
   * Call this when a user's roles or permissions change
   */
  invalidateProfile(profileId: string): void {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${profileId}:`)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.logger.log(`Invalidated ${count} cache entries for profile: ${profileId}`);
  }

  /**
   * Invalidate cached permissions for a specific app scope
   * Call this when permissions or roles change in an app scope
   */
  invalidateAppScope(appScopeId: string): void {
    let count = 0;
    for (const key of this.cache.keys()) {
      const parts = key.split(':');
      if (parts[2] === appScopeId) {
        this.cache.delete(key);
        count++;
      }
    }
    this.logger.log(`Invalidated ${count} cache entries for app scope: ${appScopeId}`);
  }

  /**
   * Clear all cached permissions
   * Call this during system maintenance or major permission changes
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.log(`Cleared all ${size} cache entries`);
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttlMs: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMs: this.cacheTTL,
    };
  }

  /**
   * Clean up expired entries (called periodically by a scheduled task)
   */
  cleanupExpired(): void {
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
