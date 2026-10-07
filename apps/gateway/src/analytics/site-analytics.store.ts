import { Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

/** Where site-analytics counters live. Keys are opaque aggregate keys. */
export interface SiteAnalyticsStore {
  /** Adds one to `key`; returns false when `key` is new and the store is full. */
  increment(key: string, maxKeys: number): Promise<boolean>;
  entries(): Promise<Array<[string, number]>>;
}

export const SITE_ANALYTICS_STORE = Symbol('SITE_ANALYTICS_STORE');

/** Process memory; counts reset on restart. Used when Redis is not configured. */
export class MemorySiteAnalyticsStore implements SiteAnalyticsStore {
  private readonly counts = new Map<string, number>();

  async increment(key: string, maxKeys: number): Promise<boolean> {
    const current = this.counts.get(key);
    if (current === undefined && this.counts.size >= maxKeys) return false;
    this.counts.set(key, (current ?? 0) + 1);
    return true;
  }

  async entries(): Promise<Array<[string, number]>> {
    return [...this.counts.entries()];
  }
}

/** Minimal client surface, so tests can supply a fake. */
export interface SiteAnalyticsRedisClient {
  hExists(key: string, field: string): Promise<boolean | number>;
  hLen(key: string): Promise<number>;
  hIncrBy(key: string, field: string, increment: number): Promise<number>;
  hGetAll(key: string): Promise<Record<string, string>>;
}

/**
 * One Redis hash shared by every gateway replica, so counts survive gateway
 * restarts and add up across replicas.
 */
export class RedisSiteAnalyticsStore
  implements SiteAnalyticsStore, OnModuleDestroy
{
  static readonly HASH = 'ot:site-analytics:counts';
  private readonly logger = new Logger(RedisSiteAnalyticsStore.name);
  private connecting?: Promise<SiteAnalyticsRedisClient>;

  constructor(
    private readonly connect: () => Promise<SiteAnalyticsRedisClient>,
    private readonly close: () => Promise<void> = async () => undefined
  ) {}

  static fromEnvironment(
    host: string,
    port: number,
    password?: string,
    database = 0
  ): RedisSiteAnalyticsStore {
    const client = createClient({
      socket: { host, port },
      password,
      database,
    }) as RedisClientType;
    const logger = new Logger(RedisSiteAnalyticsStore.name);
    client.on('error', (error: Error) =>
      logger.error(`Redis error: ${error.message}`)
    );
    return new RedisSiteAnalyticsStore(
      async () => {
        if (!client.isOpen) await client.connect();
        return client as unknown as SiteAnalyticsRedisClient;
      },
      async () => {
        if (client.isOpen) await client.quit();
      }
    );
  }

  async increment(key: string, maxKeys: number): Promise<boolean> {
    const redis = await this.client();
    const hash = RedisSiteAnalyticsStore.HASH;
    if (
      !(await redis.hExists(hash, key)) &&
      (await redis.hLen(hash)) >= maxKeys
    )
      return false;
    await redis.hIncrBy(hash, key, 1);
    return true;
  }

  async entries(): Promise<Array<[string, number]>> {
    const redis = await this.client();
    return Object.entries(
      await redis.hGetAll(RedisSiteAnalyticsStore.HASH)
    ).map(([key, value]) => [key, Number(value)]);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.close();
    } catch (error) {
      this.logger.warn(`Closing Redis failed: ${(error as Error).message}`);
    }
  }

  private client(): Promise<SiteAnalyticsRedisClient> {
    this.connecting ??= this.connect().catch((error) => {
      this.connecting = undefined;
      throw error;
    });
    return this.connecting;
  }
}
