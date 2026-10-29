import { deletionProfiles } from './cache-deletion';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ICacheProvider, CacheStats } from './cache-provider.interface';
import { createClient, RedisClientType } from 'redis';

/**
 * Redis cache provider for permission checks
 * Distributed cache suitable for multi-instance deployments
 * Requires Redis server
 */
@Injectable()
export class RedisCacheProvider implements ICacheProvider, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheProvider.name);
  private client: RedisClientType;
  private readonly cacheTTL: number;
  private readonly keyPrefix: string;
  private hits = 0;
  private misses = 0;
  private isConnected = false;

  constructor(
    host = 'localhost',
    port = 6379,
    password?: string,
    db = 0,
    ttl = 5 * 60 * 1000,
    keyPrefix = 'permissions:'
  ) {
    this.cacheTTL = ttl;
    const normalizedPrefix = keyPrefix.trim();
    if (!normalizedPrefix || /[*?\[\]\\]/.test(normalizedPrefix)) {
      throw new Error(
        'Redis permissions cache key prefix must be non-empty and contain no glob characters'
      );
    }
    this.keyPrefix = normalizedPrefix;
    this.initRedis(host, port, password, db);
    this.logger.log(
      `RedisCacheProvider initialized with host=${host}, port=${port}, TTL=${ttl}ms`
    );
  }

  private async initRedis(
    host: string,
    port: number,
    password?: string,
    db?: number
  ): Promise<void> {
    try {
      this.client = createClient({
        socket: {
          host,
          port,
        },
        password,
        database: db,
      }) as RedisClientType;

      this.client.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        this.logger.warn('Disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error(`Failed to initialize Redis: ${error.message}`);
      this.isConnected = false;
    }
  }

  async purgeProfiles(profileIds: readonly string[]): Promise<void> {
    await this.deletionInventory(profileIds, true);
  }
  async countProfiles(profileIds: readonly string[]): Promise<number> {
    return this.deletionInventory(profileIds, false);
  }
  private async deletionInventory(
    profileIds: readonly string[],
    purge: boolean
  ): Promise<number> {
    const profiles = [...deletionProfiles(profileIds)];
    if (!this.isConnected || !this.client.isReady)
      throw Error('PERMISSION_CACHE_UNAVAILABLE');
    const result = await this.client.sendCommand([
      'EVAL',
      `
      local profiles = {}; for _,id in ipairs(cjson.decode(ARGV[2])) do profiles[id] = true end
      local cursor = '0'; local pages = 0; local found = {}; local remaining = 0; local count = 0
      repeat
        local page = redis.call('SCAN', cursor, 'MATCH', ARGV[1]..'*', 'COUNT', 100)
        cursor = page[1]; pages = pages + 1; if pages > 1000 then return -1 end
        for _,key in ipairs(page[2]) do
          if not found[key] then
            found[key] = true; count = count + 1; if count > 10000 then return -1 end
            local suffix = string.sub(key, string.len(ARGV[1]) + 1)
            local profile = string.match(suffix, '^([^:]+):')
            if profile and profiles[string.lower(profile)] then
              if ARGV[3] == 'purge' then redis.call('DEL', key) else remaining = remaining + 1 end
            end
          end
        end
      until cursor == '0'
      return remaining`,
      '0',
      this.keyPrefix,
      JSON.stringify(profiles),
      purge ? 'purge' : 'readback',
    ]);
    if (
      typeof result !== 'number' ||
      !Number.isSafeInteger(result) ||
      result < 0
    )
      throw Error('PERMISSION_CACHE_READBACK_INVALID');
    return result;
  }

  private getPrefixedKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get(key: string): Promise<boolean | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, returning null');
      this.misses++;
      return null;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key);
      const value = await this.client.get(prefixedKey);

      if (value === null) {
        this.misses++;
        this.logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      this.hits++;
      this.logger.debug(`Cache hit for key: ${key}`);
      return value === 'true';
    } catch (error) {
      this.misses++;
      this.logger.error(
        `Error reading from Redis for key ${key}: ${error.message}`
      );
      return null;
    }
  }

  async set(key: string, value: boolean, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping set operation');
      return;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key);
      const ttlSeconds = Math.floor((ttl || this.cacheTTL) / 1000);

      await this.client.setEx(prefixedKey, ttlSeconds, value.toString());
      this.logger.debug(
        `Cached value for key: ${key} = ${value} (TTL: ${ttlSeconds}s)`
      );
    } catch (error) {
      this.logger.error(
        `Error writing to Redis for key ${key}: ${error.message}`
      );
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping delete operation');
      return;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key);
      await this.client.del(prefixedKey);
      this.logger.debug(`Deleted cache entry: ${key}`);
    } catch (error) {
      this.logger.error(
        `Error deleting from Redis for key ${key}: ${error.message}`
      );
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error(
        'Redis not connected; cannot invalidate permission cache'
      );
    }

    try {
      const prefixedPattern = this.getPrefixedKey(pattern);
      const keys = await this.client.keys(prefixedPattern);

      if (keys.length > 0) {
        await this.client.del(keys);
        this.logger.log(
          `Deleted ${keys.length} cache entries matching pattern: ${pattern}`
        );
      }
    } catch (error) {
      this.logger.error(`Error deleting pattern from Redis: ${error.message}`);
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis not connected; cannot clear permission cache');
    }

    try {
      const pattern = this.getPrefixedKey('*');
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(keys);
      }

      this.hits = 0;
      this.misses = 0;
      this.logger.log(`Cleared all ${keys.length} cache entries`);
    } catch (error) {
      this.logger.error(`Error clearing Redis cache: ${error.message}`);
      throw error;
    }
  }

  async getStats(): Promise<CacheStats> {
    let size = 0;

    if (this.isConnected) {
      try {
        const pattern = this.getPrefixedKey('*');
        const keys = await this.client.keys(pattern);
        size = keys.length;
      } catch (error) {
        this.logger.error(`Error getting cache stats: ${error.message}`);
      }
    }

    return {
      size,
      ttlMs: this.cacheTTL,
      provider: 'redis',
      hits: this.hits,
      misses: this.misses,
    };
  }

  async cleanup(): Promise<void> {
    // Redis handles TTL expiration automatically, no manual cleanup needed
    this.logger.debug('Redis handles TTL expiration automatically');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
      this.logger.log('Disconnected from Redis');
    }
  }
}
