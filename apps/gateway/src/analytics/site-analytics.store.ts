import { Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

/**
 * Counters are kept in separate tiers, each with its own key budget, so a
 * flood of one kind of dimension (for example made-up campaign values) cannot
 * use up the budget of another (page paths).
 */
export type SiteAnalyticsTier = 'pages' | 'campaigns';

/** `counted`: the event's own counter; `overflow`: the tier was full. */
export type SiteAnalyticsIncrement = 'counted' | 'overflow';

/** Where site-analytics counters live. Keys are opaque aggregate keys. */
export interface SiteAnalyticsStore {
  /**
   * Adds one to `key` in `tier`. When `key` is new and the tier already holds
   * `maxKeys` counters, adds one to `overflowKey` instead. The decision and
   * the increment happen atomically, so concurrent callers cannot push a tier
   * past its budget.
   */
  increment(
    tier: SiteAnalyticsTier,
    key: string,
    overflowKey: string,
    maxKeys: number
  ): Promise<SiteAnalyticsIncrement>;
  entries(): Promise<Array<[string, number]>>;
}

export const SITE_ANALYTICS_STORE = Symbol('SITE_ANALYTICS_STORE');

const TIERS: readonly SiteAnalyticsTier[] = ['pages', 'campaigns'];

/** Process memory; counts reset on restart. Used when Redis is not configured. */
export class MemorySiteAnalyticsStore implements SiteAnalyticsStore {
  private readonly counts = new Map<SiteAnalyticsTier, Map<string, number>>(
    TIERS.map((tier) => [tier, new Map()])
  );

  async increment(
    tier: SiteAnalyticsTier,
    key: string,
    overflowKey: string,
    maxKeys: number
  ): Promise<SiteAnalyticsIncrement> {
    const counts = this.counts.get(tier) as Map<string, number>;
    const fits = counts.has(key) || counts.size < maxKeys;
    const target = fits ? key : overflowKey;
    counts.set(target, (counts.get(target) ?? 0) + 1);
    return fits ? 'counted' : 'overflow';
  }

  async entries(): Promise<Array<[string, number]>> {
    return TIERS.flatMap((tier) => [
      ...(this.counts.get(tier) as Map<string, number>).entries(),
    ]);
  }
}

/** Minimal client surface, so tests can supply a fake. */
export interface SiteAnalyticsRedisClient {
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] }
  ): Promise<unknown>;
  hGetAll(key: string): Promise<Record<string, string>>;
}

/**
 * Checks the budget and increments in one step. Redis runs a script without
 * interleaving other commands, so two gateway replicas cannot both see room
 * for one more counter and both add one.
 *
 * KEYS[1] tier hash; ARGV[1] key, ARGV[2] overflow key, ARGV[3] budget.
 * Returns 1 when the key itself was counted, 0 when the overflow was.
 */
export const INCREMENT_SCRIPT = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1
  or redis.call('HLEN', KEYS[1]) < tonumber(ARGV[3]) then
  redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
  return 1
end
redis.call('HINCRBY', KEYS[1], ARGV[2], 1)
return 0
`;

/**
 * Redis hashes shared by every gateway replica, so counts survive gateway
 * restarts and add up across replicas.
 */
export class RedisSiteAnalyticsStore
  implements SiteAnalyticsStore, OnModuleDestroy
{
  static readonly HASH = 'ot:site-analytics:counts';
  static readonly CAMPAIGN_HASH = 'ot:site-analytics:campaigns';
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

  static hashFor(tier: SiteAnalyticsTier): string {
    return tier === 'campaigns'
      ? RedisSiteAnalyticsStore.CAMPAIGN_HASH
      : RedisSiteAnalyticsStore.HASH;
  }

  async increment(
    tier: SiteAnalyticsTier,
    key: string,
    overflowKey: string,
    maxKeys: number
  ): Promise<SiteAnalyticsIncrement> {
    const redis = await this.client();
    const result = await redis.eval(INCREMENT_SCRIPT, {
      keys: [RedisSiteAnalyticsStore.hashFor(tier)],
      arguments: [key, overflowKey, String(maxKeys)],
    });
    return Number(result) === 1 ? 'counted' : 'overflow';
  }

  async entries(): Promise<Array<[string, number]>> {
    const redis = await this.client();
    const entries: Array<[string, number]> = [];
    for (const tier of TIERS) {
      const hash = await redis.hGetAll(RedisSiteAnalyticsStore.hashFor(tier));
      for (const [key, value] of Object.entries(hash)) {
        entries.push([key, Number(value)]);
      }
    }
    return entries;
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
