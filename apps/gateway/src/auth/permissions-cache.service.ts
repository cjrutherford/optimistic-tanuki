import { Injectable, Logger } from '@nestjs/common';
import { ICacheProvider } from './cache/cache-provider.interface';

/**
 * Service for caching permission check results to reduce load on the permissions service
 * and improve response times for frequently checked permissions.
 * 
 * Supports multiple cache backends: memory, file, Redis
 */
@Injectable()
export class PermissionsCacheService {
  private readonly logger = new Logger(PermissionsCacheService.name);
  private readonly cacheProvider: ICacheProvider;

  constructor(cacheProvider: ICacheProvider) {
    this.cacheProvider = cacheProvider;
    this.logger.log('PermissionsCacheService initialized');
  }

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
  async get(
    profileId: string,
    permission: string,
    appScopeId: string,
    targetId?: string
  ): Promise<boolean | null> {
    const key = this.getCacheKey(profileId, permission, appScopeId, targetId);
    return await this.cacheProvider.get(key);
  }

  /**
   * Store a permission check result in the cache
   */
  async set(
    profileId: string,
    permission: string,
    appScopeId: string,
    granted: boolean,
    targetId?: string
  ): Promise<void> {
    const key = this.getCacheKey(profileId, permission, appScopeId, targetId);
    await this.cacheProvider.set(key, granted);
  }

  /**
   * Invalidate cached permissions for a specific profile
   * Call this when a user's roles or permissions change
   */
  async invalidateProfile(profileId: string): Promise<void> {
    await this.cacheProvider.deletePattern(`${profileId}:*`);
    this.logger.log(`Invalidated cache entries for profile: ${profileId}`);
  }

  /**
   * Invalidate cached permissions for a specific app scope
   * Call this when permissions or roles change in an app scope
   */
  async invalidateAppScope(appScopeId: string): Promise<void> {
    await this.cacheProvider.deletePattern(`*:*:${appScopeId}:*`);
    this.logger.log(`Invalidated cache entries for app scope: ${appScopeId}`);
  }

  /**
   * Clear all cached permissions
   * Call this during system maintenance or major permission changes
   */
  async clear(): Promise<void> {
    await this.cacheProvider.clear();
    this.logger.log('Cleared all cache entries');
  }

  /**
   * Get cache statistics for monitoring
   */
  async getStats() {
    return await this.cacheProvider.getStats();
  }

  /**
   * Clean up expired entries (called periodically by a scheduled task)
   */
  async cleanupExpired(): Promise<void> {
    await this.cacheProvider.cleanup();
  }
}
