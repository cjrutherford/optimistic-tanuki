import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsCacheService } from './permissions-cache.service';
import { Logger } from '@nestjs/common';

describe('PermissionsCacheService', () => {
  let service: PermissionsCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsCacheService, Logger],
    }).compile();

    service = module.get<PermissionsCacheService>(PermissionsCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get and set', () => {
    it('should return null for non-existent cache entry', () => {
      const result = service.get('profile1', 'permission1', 'appScope1');
      expect(result).toBeNull();
    });

    it('should cache and retrieve a permission check result', () => {
      service.set('profile1', 'permission1', 'appScope1', true);
      const result = service.get('profile1', 'permission1', 'appScope1');
      expect(result).toBe(true);
    });

    it('should cache granted=false correctly', () => {
      service.set('profile1', 'permission1', 'appScope1', false);
      const result = service.get('profile1', 'permission1', 'appScope1');
      expect(result).toBe(false);
    });

    it('should handle targetId in cache key', () => {
      service.set('profile1', 'permission1', 'appScope1', true, 'target1');
      const result1 = service.get('profile1', 'permission1', 'appScope1', 'target1');
      const result2 = service.get('profile1', 'permission1', 'appScope1', 'target2');
      
      expect(result1).toBe(true);
      expect(result2).toBeNull();
    });

    it('should differentiate between different profiles', () => {
      service.set('profile1', 'permission1', 'appScope1', true);
      service.set('profile2', 'permission1', 'appScope1', false);
      
      expect(service.get('profile1', 'permission1', 'appScope1')).toBe(true);
      expect(service.get('profile2', 'permission1', 'appScope1')).toBe(false);
    });

    it('should differentiate between different permissions', () => {
      service.set('profile1', 'permission1', 'appScope1', true);
      service.set('profile1', 'permission2', 'appScope1', false);
      
      expect(service.get('profile1', 'permission1', 'appScope1')).toBe(true);
      expect(service.get('profile1', 'permission2', 'appScope1')).toBe(false);
    });

    it('should differentiate between different app scopes', () => {
      service.set('profile1', 'permission1', 'appScope1', true);
      service.set('profile1', 'permission1', 'appScope2', false);
      
      expect(service.get('profile1', 'permission1', 'appScope1')).toBe(true);
      expect(service.get('profile1', 'permission1', 'appScope2')).toBe(false);
    });
  });

  describe('cache expiration', () => {
    it('should return null for expired cache entries', (done) => {
      // Set a very short TTL for testing (we'll mock the timestamp)
      service.set('profile1', 'permission1', 'appScope1', true);
      
      // Manually set timestamp to simulate expiration
      // Access private cache for testing purposes
      const cache = (service as any).cache;
      const key = 'profile1:permission1:appScope1:null';
      const entry = cache.get(key);
      entry.timestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago (past TTL)
      
      const result = service.get('profile1', 'permission1', 'appScope1');
      expect(result).toBeNull();
      expect(cache.has(key)).toBe(false); // Should be deleted
      done();
    });

    it('should cleanupExpired remove expired entries', () => {
      service.set('profile1', 'permission1', 'appScope1', true);
      service.set('profile2', 'permission2', 'appScope2', false);
      
      // Manually expire the first entry
      const cache = (service as any).cache;
      const key1 = 'profile1:permission1:appScope1:null';
      const entry1 = cache.get(key1);
      entry1.timestamp = Date.now() - 6 * 60 * 1000; // Expired
      
      service.cleanupExpired();
      
      expect(service.get('profile1', 'permission1', 'appScope1')).toBeNull();
      expect(service.get('profile2', 'permission2', 'appScope2')).toBe(false);
    });
  });

  describe('invalidation', () => {
    beforeEach(() => {
      service.set('profile1', 'permission1', 'appScope1', true);
      service.set('profile1', 'permission2', 'appScope1', false);
      service.set('profile2', 'permission1', 'appScope1', true);
      service.set('profile1', 'permission1', 'appScope2', true);
    });

    it('should invalidate all cache entries for a profile', () => {
      service.invalidateProfile('profile1');
      
      expect(service.get('profile1', 'permission1', 'appScope1')).toBeNull();
      expect(service.get('profile1', 'permission2', 'appScope1')).toBeNull();
      expect(service.get('profile1', 'permission1', 'appScope2')).toBeNull();
      expect(service.get('profile2', 'permission1', 'appScope1')).toBe(true);
    });

    it('should invalidate all cache entries for an app scope', () => {
      service.invalidateAppScope('appScope1');
      
      expect(service.get('profile1', 'permission1', 'appScope1')).toBeNull();
      expect(service.get('profile1', 'permission2', 'appScope1')).toBeNull();
      expect(service.get('profile2', 'permission1', 'appScope1')).toBeNull();
      expect(service.get('profile1', 'permission1', 'appScope2')).toBe(true);
    });

    it('should clear all cache entries', () => {
      service.clear();
      
      expect(service.get('profile1', 'permission1', 'appScope1')).toBeNull();
      expect(service.get('profile1', 'permission2', 'appScope1')).toBeNull();
      expect(service.get('profile2', 'permission1', 'appScope1')).toBeNull();
      expect(service.get('profile1', 'permission1', 'appScope2')).toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when cache is full', () => {
      const maxSize = (service as any).maxCacheSize;
      
      // Fill cache to max
      for (let i = 0; i < maxSize; i++) {
        service.set(`profile${i}`, 'permission1', 'appScope1', true);
      }
      
      // Verify first entry exists
      expect(service.get('profile0', 'permission1', 'appScope1')).toBe(true);
      
      // Add one more entry to trigger eviction
      service.set('profileNew', 'permission1', 'appScope1', true);
      
      // First entry should be evicted
      expect(service.get('profile0', 'permission1', 'appScope1')).toBeNull();
      expect(service.get('profileNew', 'permission1', 'appScope1')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      service.set('profile1', 'permission1', 'appScope1', true);
      service.set('profile2', 'permission2', 'appScope2', false);
      
      const stats = service.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBeDefined();
      expect(stats.ttlMs).toBeDefined();
    });
  });
});
