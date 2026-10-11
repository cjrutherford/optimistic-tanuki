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
  private readonly profileEpochs = new Map<
    string,
    {
      generation: number;
      activeLookups: number;
      invalidations: number;
      invalidationWaiters: Array<() => void>;
    }
  >();
  // A failed deletion can leave old decisions behind, so bypass all cached
  // values until a successful clear restores a known-empty cache.
  private cacheBypass = false;
  private globalClearCount = 0;
  private globalClearWaiters: Array<() => void> = [];

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

  async getOrLoad(
    profileId: string,
    permission: string,
    appScopeId: string,
    targetId: string | undefined,
    load: () => Promise<boolean>
  ): Promise<boolean> {
    const state = this.getEpoch(profileId);
    state.activeLookups++;
    try {
      while (true) {
        if (this.globalClearCount > 0) {
          await new Promise<void>((resolve) =>
            this.globalClearWaiters.push(resolve)
          );
          continue;
        }
        if (state.invalidations > 0) {
          await new Promise<void>((resolve) =>
            state.invalidationWaiters.push(resolve)
          );
          continue;
        }
        const generation = state.generation;
        const cached = !this.cacheBypass
          ? await this.get(profileId, permission, appScopeId, targetId)
          : null;
        if (generation !== state.generation || state.invalidations > 0)
          continue;
        if (cached !== null) return cached;

        const granted = await load();
        if (generation !== state.generation || state.invalidations > 0)
          continue;
        if (!this.cacheBypass) {
          await this.set(profileId, permission, appScopeId, granted, targetId);
          if (generation !== state.generation || state.invalidations > 0) {
            // The stale write may have landed after the first deletion.
            try {
              await this.cacheProvider.deletePattern(`${profileId}:*`);
            } catch (error) {
              this.cacheBypass = true;
              throw error;
            }
            continue;
          }
        }
        return granted;
      }
    } finally {
      state.activeLookups--;
      this.releaseEpoch(profileId, state);
    }
  }

  /**
   * Invalidate cached permissions for a specific profile
   * Call this when a user's roles or permissions change
   */
  async invalidateProfile(profileId: string): Promise<void> {
    const state = this.getEpoch(profileId);
    state.generation++;
    state.invalidations++;
    try {
      await this.cacheProvider.deletePattern(`${profileId}:*`);
      this.logger.log(`Invalidated cache entries for profile: ${profileId}`);
    } catch (error) {
      this.cacheBypass = true;
      throw error;
    } finally {
      state.invalidations--;
      if (state.invalidations === 0) {
        state.invalidationWaiters.splice(0).forEach((resolve) => resolve());
      }
      this.releaseEpoch(profileId, state);
    }
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
    this.globalClearCount++;
    for (const state of this.profileEpochs.values()) state.generation++;
    try {
      await this.cacheProvider.clear();
      this.cacheBypass = false;
      this.logger.log('Cleared all cache entries');
    } catch (error) {
      this.cacheBypass = true;
      throw error;
    } finally {
      this.globalClearCount--;
      if (this.globalClearCount === 0) {
        this.globalClearWaiters.splice(0).forEach((resolve) => resolve());
      }
    }
  }

  private getEpoch(profileId: string) {
    let state = this.profileEpochs.get(profileId);
    if (!state) {
      state = {
        generation: 0,
        activeLookups: 0,
        invalidations: 0,
        invalidationWaiters: [],
      };
      this.profileEpochs.set(profileId, state);
    }
    return state;
  }

  private releaseEpoch(
    profileId: string,
    state: {
      generation: number;
      activeLookups: number;
      invalidations: number;
      invalidationWaiters: Array<() => void>;
    }
  ): void {
    if (state.activeLookups === 0 && state.invalidations === 0) {
      this.profileEpochs.delete(profileId);
    }
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
