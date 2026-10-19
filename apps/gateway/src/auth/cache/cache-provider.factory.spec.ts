import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { CacheProviderFactory } from './cache-provider.factory';

const mockRedisClient = {
  on: jest.fn().mockReturnThis(),
  connect: jest.fn().mockResolvedValue(undefined),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

describe('CacheProviderFactory', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockRedisClient.on.mockReturnThis();
    mockRedisClient.connect.mockResolvedValue(undefined);
  });

  it('keeps the Redis password out of diagnostics while forwarding it to Redis', () => {
    const password = 'synthetic-cache-password-sentinel';
    const loggerSpies = [
      jest.spyOn(Logger.prototype, 'log').mockImplementation(),
      jest.spyOn(Logger.prototype, 'error').mockImplementation(),
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(),
      jest.spyOn(Logger.prototype, 'debug').mockImplementation(),
      jest.spyOn(Logger.prototype, 'verbose').mockImplementation(),
    ];
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          'permissions.cache.provider': 'redis',
          'permissions.cache.redis.password': password,
        };
        return key in values ? values[key] : fallback;
      }),
    } as unknown as ConfigService;

    CacheProviderFactory.create(configService);

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ password })
    );
    expect(loggerSpies[3]).toHaveBeenCalled();
    const emittedLogs = JSON.stringify(
      loggerSpies.map((logger) => logger.mock.calls)
    );
    expect(emittedLogs).not.toContain(password);
    expect(emittedLogs).toContain('redis');
    expect(emittedLogs).toContain('ttl');
  });
});
