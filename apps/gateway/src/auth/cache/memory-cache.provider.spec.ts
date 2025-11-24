import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MemoryCacheProvider } from './memory-cache.provider';

describe('MemoryCacheProvider', () => {
  let provider: MemoryCacheProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: MemoryCacheProvider,
          useFactory: () => new MemoryCacheProvider(5000, 100), // 5s TTL, 100 max size
        },
        Logger,
      ],
    }).compile();

    provider = module.get<MemoryCacheProvider>(MemoryCacheProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('get and set', () => {
    it('should return null for non-existent key', async () => {
      const result = await provider.get('test-key');
      expect(result).toBeNull();
    });

    it('should cache and retrieve a value', async () => {
      await provider.set('test-key', true);
      const result = await provider.get('test-key');
      expect(result).toBe(true);
    });

    it('should cache false values correctly', async () => {
      await provider.set('test-key', false);
      const result = await provider.get('test-key');
      expect(result).toBe(false);
    });
  });

  describe('expiration', () => {
    it('should return null for expired entries', async () => {
      await provider.set('test-key', true);
      
      // Manually expire the entry
      const cache = (provider as any).cache;
      const entry = cache.get('test-key');
      entry.timestamp = Date.now() - 10000; // 10 seconds ago
      
      const result = await provider.get('test-key');
      expect(result).toBeNull();
    });

    it('should cleanup expired entries', async () => {
      await provider.set('key1', true);
      await provider.set('key2', false);
      
      // Expire first entry
      const cache = (provider as any).cache;
      const entry1 = cache.get('key1');
      entry1.timestamp = Date.now() - 10000;
      
      await provider.cleanup();
      
      expect(await provider.get('key1')).toBeNull();
      expect(await provider.get('key2')).toBe(false);
    });
  });

  describe('delete operations', () => {
    beforeEach(async () => {
      await provider.set('key1', true);
      await provider.set('key2', false);
      await provider.set('key3', true);
    });

    it('should delete a specific key', async () => {
      await provider.delete('key1');
      expect(await provider.get('key1')).toBeNull();
      expect(await provider.get('key2')).toBe(false);
    });

    it('should delete keys matching pattern', async () => {
      await provider.set('user:123:perm1', true);
      await provider.set('user:123:perm2', false);
      await provider.set('user:456:perm1', true);
      
      await provider.deletePattern('user:123:.*');
      
      expect(await provider.get('user:123:perm1')).toBeNull();
      expect(await provider.get('user:123:perm2')).toBeNull();
      expect(await provider.get('user:456:perm1')).toBe(true);
    });

    it('should clear all entries', async () => {
      await provider.clear();
      
      expect(await provider.get('key1')).toBeNull();
      expect(await provider.get('key2')).toBeNull();
      expect(await provider.get('key3')).toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when cache is full', async () => {
      const maxSize = (provider as any).maxCacheSize;
      
      // Fill cache to max
      for (let i = 0; i < maxSize; i++) {
        await provider.set(`key${i}`, true);
      }
      
      // Verify first entry exists
      expect(await provider.get('key0')).toBe(true);
      
      // Add one more to trigger eviction
      await provider.set('keyNew', true);
      
      // First entry should be evicted
      expect(await provider.get('key0')).toBeNull();
      expect(await provider.get('keyNew')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await provider.set('key1', true);
      await provider.set('key2', false);
      
      const stats = await provider.getStats();
      
      expect(stats.provider).toBe('memory');
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBeDefined();
      expect(stats.ttlMs).toBeDefined();
      expect(stats.hits).toBeDefined();
      expect(stats.misses).toBeDefined();
    });
  });
});
