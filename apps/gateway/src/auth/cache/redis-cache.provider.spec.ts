import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { RedisCacheProvider } from './redis-cache.provider';
import * as redis from 'redis';

const redisClient = {
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  quit: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => redisClient),
}));

describe('RedisCacheProvider', () => {
  let provider: RedisCacheProvider;

  beforeEach(async () => {
    // Reset mocks before each test to ensure test isolation
    for (const key in redisClient) {
      if (typeof redisClient[key].mockReset === 'function') {
        redisClient[key].mockReset();
      }
    }
    // Re-apply default mock implementations that are needed for provider initialization
    redisClient.connect.mockResolvedValue(undefined);
    // Simulate 'on' being chainable and capture the 'connect' handler to call it
    redisClient.on.mockImplementation((event, handler) => {
      if (event === 'connect') {
        handler(); // a 'connect' event happens immediately
      }
      return redisClient;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RedisCacheProvider,
          useFactory: () =>
            new RedisCacheProvider('localhost', 6379, '', 0, 5000),
        },
        Logger,
      ],
    }).compile();

    provider = module.get<RedisCacheProvider>(RedisCacheProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('get and set', () => {
    it('should return null for non-existent key', async () => {
      redisClient.get.mockResolvedValue(null);
      const result = await provider.get('test-key');
      expect(result).toBeNull();
    });

    it('should cache and retrieve a value', async () => {
      await provider.set('test-key', true);
      redisClient.get.mockResolvedValue('true');
      const result = await provider.get('test-key');
      expect(result).toBe(true);
    });

    it('should cache false values correctly', async () => {
      await provider.set('test-key', false);
      redisClient.get.mockResolvedValue('false');
      const result = await provider.get('test-key');
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete a cache entry', async () => {
      await provider.delete('test-key');
      expect(redisClient.del).toHaveBeenCalledWith('permissions:test-key');
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      redisClient.keys.mockResolvedValue([
        'permissions:key1',
        'permissions:key2',
      ]);
      await provider.clear();
      expect(redisClient.keys).toHaveBeenCalledWith('permissions:*');
      expect(redisClient.del).toHaveBeenCalledWith([
        'permissions:key1',
        'permissions:key2',
      ]);
    });
  });
});
