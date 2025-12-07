import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsCacheService } from './permissions-cache.service';
import { Logger } from '@nestjs/common';
import { ICacheProvider } from './cache/cache-provider.interface';

describe('PermissionsCacheService', () => {
  let service: PermissionsCacheService;
  let cacheProvider: ICacheProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Logger,
        {
          provide: 'ICacheProvider',
          useFactory: () => {
            const cache = new Map<string, { value: boolean, timestamp: number }>();
            return {
              get: jest.fn(async (key: string) => {
                const entry = cache.get(key);
                if (!entry) return null;
                // Simple TTL check for testing
                if (Date.now() - entry.timestamp > 5 * 60 * 1000) {
                  cache.delete(key);
                  return null;
                }
                return entry.value;
              }),
              set: jest.fn(async (key: string, value: boolean) => {
                cache.set(key, { value, timestamp: Date.now() });
              }),
              delete: jest.fn(async (key: string) => {
                cache.delete(key);
              }),
              deletePattern: jest.fn(async (pattern: string) => {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                for (const key of cache.keys()) {
                  if (regex.test(key)) {
                    cache.delete(key);
                  }
                }
              }),
              clear: jest.fn(async () => {
                cache.clear();
              }),
              getStats: jest.fn(async () => ({
                size: cache.size,
                maxSize: 10000,
                ttlMs: 5 * 60 * 1000,
                provider: 'memory',
                hits: 0,
                misses: 0,
              })),
              cleanup: jest.fn(async () => {
                const now = Date.now();
                for (const [key, entry] of cache.entries()) {
                  if (now - entry.timestamp > 5 * 60 * 1000) {
                    cache.delete(key);
                  }
                }
              }),
            };
          },
        },
        {
          provide: PermissionsCacheService,
          useFactory: (provider: ICacheProvider) => {
            return new PermissionsCacheService(provider);
          },
          inject: ['ICacheProvider'],
        },
      ],
    }).compile();

    service = module.get<PermissionsCacheService>(PermissionsCacheService);
    cacheProvider = module.get<ICacheProvider>('ICacheProvider');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get and set', () => {
    it('should return null for non-existent cache entry', async () => {
      const result = await service.get('profile1', 'permission1', 'appScope1');
      expect(result).toBeNull();
    });

    it('should cache and retrieve a permission check result', async () => {
      await service.set('profile1', 'permission1', 'appScope1', true);
      const result = await service.get('profile1', 'permission1', 'appScope1');
      expect(result).toBe(true);
    });

    it('should cache granted=false correctly', async () => {
      await service.set('profile1', 'permission1', 'appScope1', false);
      const result = await service.get('profile1', 'permission1', 'appScope1');
      expect(result).toBe(false);
    });

    it('should handle targetId in cache key', async () => {
      await service.set('profile1', 'permission1', 'appScope1', true, 'target1');
      const result1 = await service.get('profile1', 'permission1', 'appScope1', 'target1');
      const result2 = await service.get('profile1', 'permission1', 'appScope1', 'target2');
      
      expect(result1).toBe(true);
      expect(result2).toBeNull();
    });

    it('should differentiate between different profiles', async () => {
      await service.set('profile1', 'permission1', 'appScope1', true);
      await service.set('profile2', 'permission1', 'appScope1', false);
      
      expect(await service.get('profile1', 'permission1', 'appScope1')).toBe(true);
      expect(await service.get('profile2', 'permission1', 'appScope1')).toBe(false);
    });

    it('should differentiate between different permissions', async () => {
      await service.set('profile1', 'permission1', 'appScope1', true);
      await service.set('profile1', 'permission2', 'appScope1', false);
      
      expect(await service.get('profile1', 'permission1', 'appScope1')).toBe(true);
      expect(await service.get('profile1', 'permission2', 'appScope1')).toBe(false);
    });

    it('should differentiate between different app scopes', async () => {
      await service.set('profile1', 'permission1', 'appScope1', true);
      await service.set('profile1', 'permission1', 'appScope2', false);
      
      expect(await service.get('profile1', 'permission1', 'appScope1')).toBe(true);
      expect(await service.get('profile1', 'permission1', 'appScope2')).toBe(false);
    });
  });

  describe('invalidation', () => {
    beforeEach(async () => {
      await service.set('profile1', 'permission1', 'appScope1', true);
      await service.set('profile1', 'permission2', 'appScope1', false);
      await service.set('profile2', 'permission1', 'appScope1', true);
      await service.set('profile1', 'permission1', 'appScope2', true);
    });

    it('should invalidate all cache entries for a profile', async () => {
      await service.invalidateProfile('profile1');
      
      expect(await service.get('profile1', 'permission1', 'appScope1')).toBeNull();
      expect(await service.get('profile1', 'permission2', 'appScope1')).toBeNull();
      expect(await service.get('profile1', 'permission1', 'appScope2')).toBeNull();
      expect(await service.get('profile2', 'permission1', 'appScope1')).toBe(true);
    });

    it('should invalidate all cache entries for an app scope', async () => {
      await service.invalidateAppScope('appScope1');
      
      expect(await service.get('profile1', 'permission1', 'appScope1')).toBeNull();
      expect(await service.get('profile1', 'permission2', 'appScope1')).toBeNull();
      expect(await service.get('profile2', 'permission1', 'appScope1')).toBeNull();
      expect(await service.get('profile1', 'permission1', 'appScope2')).toBe(true);
    });

    it('should clear all cache entries', async () => {
      await service.clear();
      
      expect(await service.get('profile1', 'permission1', 'appScope1')).toBeNull();
      expect(await service.get('profile1', 'permission2', 'appScope1')).toBeNull();
      expect(await service.get('profile2', 'permission1', 'appScope1')).toBeNull();
      expect(await service.get('profile1', 'permission1', 'appScope2')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await service.set('profile1', 'permission1', 'appScope1', true);
      await service.set('profile2', 'permission2', 'appScope2', false);
      
      const stats = await service.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBeDefined();
      expect(stats.ttlMs).toBeDefined();
    });
  });
});
