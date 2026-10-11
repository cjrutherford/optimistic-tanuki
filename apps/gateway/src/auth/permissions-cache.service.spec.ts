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
            const cache = new Map<
              string,
              { value: boolean; timestamp: number }
            >();
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
      await service.set(
        'profile1',
        'permission1',
        'appScope1',
        true,
        'target1'
      );
      const result1 = await service.get(
        'profile1',
        'permission1',
        'appScope1',
        'target1'
      );
      const result2 = await service.get(
        'profile1',
        'permission1',
        'appScope1',
        'target2'
      );

      expect(result1).toBe(true);
      expect(result2).toBeNull();
    });

    it('does not reuse a target permission cache entry across workspace child scope IDs', async () => {
      await service.set(
        'profile1',
        'permission1',
        'workspace-scope-1',
        true,
        'target1'
      );

      expect(
        await service.get(
          'profile1',
          'permission1',
          'workspace-scope-1',
          'target1'
        )
      ).toBe(true);
      expect(
        await service.get(
          'profile1',
          'permission1',
          'workspace-scope-2',
          'target1'
        )
      ).toBeNull();
    });

    it('should differentiate between different profiles', async () => {
      await service.set('profile1', 'permission1', 'appScope1', true);
      await service.set('profile2', 'permission1', 'appScope1', false);

      expect(await service.get('profile1', 'permission1', 'appScope1')).toBe(
        true
      );
      expect(await service.get('profile2', 'permission1', 'appScope1')).toBe(
        false
      );
    });

    it('should differentiate between different permissions', async () => {
      await service.set('profile1', 'permission1', 'appScope1', true);
      await service.set('profile1', 'permission2', 'appScope1', false);

      expect(await service.get('profile1', 'permission1', 'appScope1')).toBe(
        true
      );
      expect(await service.get('profile1', 'permission2', 'appScope1')).toBe(
        false
      );
    });

    it('should differentiate between different app scopes', async () => {
      await service.set('profile1', 'permission1', 'appScope1', true);
      await service.set('profile1', 'permission1', 'appScope2', false);

      expect(await service.get('profile1', 'permission1', 'appScope1')).toBe(
        true
      );
      expect(await service.get('profile1', 'permission1', 'appScope2')).toBe(
        false
      );
    });
  });

  it('rechecks a permission result whose RPC overlaps profile invalidation', async () => {
    let releaseOldLookup!: (granted: boolean) => void;
    let markLookupStarted!: () => void;
    const lookupStarted = new Promise<void>((resolve) => {
      markLookupStarted = resolve;
    });
    const oldLookup = new Promise<boolean>((resolve) => {
      releaseOldLookup = resolve;
    });
    const loader = jest
      .fn<Promise<boolean>, []>()
      .mockImplementationOnce(() => {
        markLookupStarted();
        return oldLookup;
      })
      .mockResolvedValueOnce(false);

    const pending = service.getOrLoad(
      'profile-race',
      'permission',
      'scope-a',
      undefined,
      loader
    );
    await lookupStarted;
    await service.invalidateProfile('profile-race');
    releaseOldLookup(true);

    await expect(pending).resolves.toBe(false);
    expect(loader).toHaveBeenCalledTimes(2);
    await expect(
      service.get('profile-race', 'permission', 'scope-a')
    ).resolves.toBe(false);
  });

  it('does not trust cache after profile invalidation fails', async () => {
    (cacheProvider.deletePattern as jest.Mock).mockRejectedValueOnce(
      new Error('cache unavailable')
    );
    await expect(service.invalidateProfile('profile-fail')).rejects.toThrow(
      'cache unavailable'
    );
    await service.set('profile-fail', 'permission', 'scope-a', true);
    const load = jest.fn().mockResolvedValue(false);

    await expect(
      service.getOrLoad(
        'profile-fail',
        'permission',
        'scope-a',
        undefined,
        load
      )
    ).resolves.toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('waits asynchronously for an active profile invalidation before checking', async () => {
    let releaseDelete!: () => void;
    (cacheProvider.deletePattern as jest.Mock).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseDelete = resolve;
      })
    );
    const invalidation = service.invalidateProfile('profile-wait');
    const load = jest.fn().mockResolvedValue(false);
    const pending = service.getOrLoad(
      'profile-wait',
      'permission',
      'scope',
      undefined,
      load
    );
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    releaseDelete();
    await invalidation;
    await expect(pending).resolves.toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('bypasses cache when a late stale-write cleanup fails', async () => {
    let finishSet!: () => void;
    let markSetStarted!: () => void;
    const setStarted = new Promise<void>(
      (resolve) => (markSetStarted = resolve)
    );
    (cacheProvider.set as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSet = resolve;
          markSetStarted();
        })
    );
    const load = jest
      .fn<Promise<boolean>, []>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    (cacheProvider.deletePattern as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('late delete failed'));
    const pending = service.getOrLoad(
      'profile-late',
      'p',
      's',
      undefined,
      load
    );
    await setStarted;
    await service.invalidateProfile('profile-late');
    finishSet();
    await expect(pending).rejects.toThrow('late delete failed');

    await service.set('profile-late', 'p', 's', true);
    await expect(
      service.getOrLoad('profile-late', 'p', 's', undefined, load)
    ).resolves.toBe(false);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('fences in-flight lookups during clear and keeps cache bypassed after clear failure', async () => {
    let releaseLookup!: (granted: boolean) => void;
    let lookupStarted!: () => void;
    const started = new Promise<void>((resolve) => (lookupStarted = resolve));
    const oldLookup = new Promise<boolean>(
      (resolve) => (releaseLookup = resolve)
    );
    const load = jest
      .fn<Promise<boolean>, []>()
      .mockImplementationOnce(() => {
        lookupStarted();
        return oldLookup;
      })
      .mockResolvedValueOnce(false);
    const pending = service.getOrLoad(
      'profile-clear',
      'p',
      's',
      undefined,
      load
    );
    await started;
    (cacheProvider.clear as jest.Mock).mockRejectedValueOnce(
      new Error('clear failed')
    );
    await expect(service.clear()).rejects.toThrow('clear failed');
    releaseLookup(true);
    await expect(pending).resolves.toBe(false);
    await service.set('profile-clear', 'p', 's', true);
    const subsequentLoad = jest.fn().mockResolvedValue(false);
    await expect(
      service.getOrLoad('profile-clear', 'p', 's', undefined, subsequentLoad)
    ).resolves.toBe(false);
    expect(subsequentLoad).toHaveBeenCalledTimes(1);
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

      expect(
        await service.get('profile1', 'permission1', 'appScope1')
      ).toBeNull();
      expect(
        await service.get('profile1', 'permission2', 'appScope1')
      ).toBeNull();
      expect(
        await service.get('profile1', 'permission1', 'appScope2')
      ).toBeNull();
      expect(await service.get('profile2', 'permission1', 'appScope1')).toBe(
        true
      );
    });

    it('should invalidate all cache entries for an app scope', async () => {
      await service.invalidateAppScope('appScope1');

      expect(
        await service.get('profile1', 'permission1', 'appScope1')
      ).toBeNull();
      expect(
        await service.get('profile1', 'permission2', 'appScope1')
      ).toBeNull();
      expect(
        await service.get('profile2', 'permission1', 'appScope1')
      ).toBeNull();
      expect(await service.get('profile1', 'permission1', 'appScope2')).toBe(
        true
      );
    });

    it('should clear all cache entries', async () => {
      await service.clear();

      expect(
        await service.get('profile1', 'permission1', 'appScope1')
      ).toBeNull();
      expect(
        await service.get('profile1', 'permission2', 'appScope1')
      ).toBeNull();
      expect(
        await service.get('profile2', 'permission1', 'appScope1')
      ).toBeNull();
      expect(
        await service.get('profile1', 'permission1', 'appScope2')
      ).toBeNull();
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
