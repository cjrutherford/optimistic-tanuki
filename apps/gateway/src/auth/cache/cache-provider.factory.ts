import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ICacheProvider, CacheConfig } from './cache-provider.interface';
import { MemoryCacheProvider } from './memory-cache.provider';
import { FileCacheProvider } from './file-cache.provider';
import { RedisCacheProvider } from './redis-cache.provider';

/**
 * Factory for creating cache providers based on configuration
 */
export class CacheProviderFactory {
  private static readonly logger = new Logger(CacheProviderFactory.name);

  /**
   * Create a cache provider based on configuration
   */
  static create(configService: ConfigService): ICacheProvider {
    const config = this.loadConfig(configService);
    
    this.logger.log(`Creating cache provider: ${config.provider}`);

    switch (config.provider) {
      case 'memory':
        return new MemoryCacheProvider(config.ttl, config.maxSize);

      case 'file':
        return new FileCacheProvider(
          config.cacheDir,
          config.ttl,
          config.maxSize
        );

      case 'redis':
        return new RedisCacheProvider(
          config.redisHost,
          config.redisPort,
          config.redisPassword,
          config.redisDb,
          config.ttl,
          config.redisKeyPrefix
        );

      default:
        this.logger.warn(
          `Unknown cache provider: ${config.provider}, falling back to memory`
        );
        return new MemoryCacheProvider(config.ttl, config.maxSize);
    }
  }

  /**
   * Load cache configuration from ConfigService with sensible defaults
   */
  private static loadConfig(configService: ConfigService): CacheConfig {
    const provider = configService.get<'memory' | 'file' | 'redis'>(
      'permissions.cache.provider',
      'memory'
    );

    const config: CacheConfig = {
      provider,
      ttl: configService.get<number>(
        'permissions.cache.ttl',
        5 * 60 * 1000 // 5 minutes default
      ),
      maxSize: configService.get<number>(
        'permissions.cache.maxSize',
        10000
      ),
    };

    // Load file-specific config
    if (provider === 'file') {
      config.cacheDir = configService.get<string>(
        'permissions.cache.cacheDir',
        '/tmp/permissions-cache'
      );
    }

    // Load Redis-specific config
    if (provider === 'redis') {
      config.redisHost = configService.get<string>(
        'permissions.cache.redis.host',
        'localhost'
      );
      config.redisPort = configService.get<number>(
        'permissions.cache.redis.port',
        6379
      );
      config.redisPassword = configService.get<string>(
        'permissions.cache.redis.password'
      );
      config.redisDb = configService.get<number>(
        'permissions.cache.redis.db',
        0
      );
      config.redisKeyPrefix = configService.get<string>(
        'permissions.cache.redis.keyPrefix',
        'permissions:'
      );
    }

    this.logger.debug(`Loaded cache config: ${JSON.stringify(config)}`);
    return config;
  }

  /**
   * Validate cache configuration
   */
  static validateConfig(config: CacheConfig): string[] {
    const errors: string[] = [];

    if (!config.provider || !['memory', 'file', 'redis'].includes(config.provider)) {
      errors.push(`Invalid cache provider: ${config.provider}`);
    }

    if (config.ttl && config.ttl < 1000) {
      errors.push(`TTL too low: ${config.ttl}ms (minimum 1000ms recommended)`);
    }

    if (config.maxSize && config.maxSize < 100) {
      errors.push(`maxSize too low: ${config.maxSize} (minimum 100 recommended)`);
    }

    if (config.provider === 'redis') {
      if (!config.redisHost) {
        errors.push('Redis host is required for redis provider');
      }
      if (!config.redisPort || config.redisPort < 1 || config.redisPort > 65535) {
        errors.push(`Invalid Redis port: ${config.redisPort}`);
      }
    }

    return errors;
  }
}
