import {
  MemorySiteAnalyticsStore,
  RedisSiteAnalyticsStore,
  SiteAnalyticsRedisClient,
} from './site-analytics.store';
import { SiteAnalyticsService } from './site-analytics.service';

/** Stands in for the Redis server: one hash that outlives any one client. */
class FakeRedis implements SiteAnalyticsRedisClient {
  readonly hashes = new Map<string, Map<string, number>>();

  private hash(key: string) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    return this.hashes.get(key) as Map<string, number>;
  }
  async hExists(key: string, field: string) {
    return this.hash(key).has(field);
  }
  async hLen(key: string) {
    return this.hash(key).size;
  }
  async hIncrBy(key: string, field: string, increment: number) {
    const next = (this.hash(key).get(field) ?? 0) + increment;
    this.hash(key).set(field, next);
    return next;
  }
  async hGetAll(key: string) {
    return Object.fromEntries(
      [...this.hash(key)].map(([field, value]) => [field, String(value)])
    );
  }
}

describe('site analytics stores', () => {
  const event = { appId: 'hai', name: 'page_view', path: '/private-cloud' };

  it('memory store caps new keys but keeps counting existing ones', async () => {
    const store = new MemorySiteAnalyticsStore();

    expect(await store.increment('a', 1)).toBe(true);
    expect(await store.increment('b', 1)).toBe(false);
    expect(await store.increment('a', 1)).toBe(true);
    expect(await store.entries()).toEqual([['a', 2]]);
  });

  it('keeps counts across a gateway restart and shares them between replicas', async () => {
    const redis = new FakeRedis();
    const replicaA = new SiteAnalyticsService(
      new RedisSiteAnalyticsStore(async () => redis)
    );
    const replicaB = new SiteAnalyticsService(
      new RedisSiteAnalyticsStore(async () => redis)
    );

    await replicaA.record(event);
    await replicaB.record(event);
    // A fresh gateway process: new service and store, same Redis server.
    const restarted = new SiteAnalyticsService(
      new RedisSiteAnalyticsStore(async () => redis)
    );
    await restarted.record(event);

    expect(await restarted.summary('hai')).toEqual([
      expect.objectContaining({ name: 'page_view', count: 3 }),
    ]);
    expect([...redis.hashes.keys()]).toEqual([RedisSiteAnalyticsStore.HASH]);
  });

  it('caps new keys in Redis too', async () => {
    const redis = new FakeRedis();
    const store = new RedisSiteAnalyticsStore(async () => redis);

    expect(await store.increment('a', 1)).toBe(true);
    expect(await store.increment('b', 1)).toBe(false);
    expect(await store.increment('a', 1)).toBe(true);
  });

  it('retries the connection after a failure', async () => {
    const redis = new FakeRedis();
    const connect = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue(redis);
    const store = new RedisSiteAnalyticsStore(connect);

    await expect(store.increment('a', 10)).rejects.toThrow('ECONNREFUSED');
    await expect(store.increment('a', 10)).resolves.toBe(true);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('ignores unreadable keys when summarising', async () => {
    const redis = new FakeRedis();
    await redis.hIncrBy(RedisSiteAnalyticsStore.HASH, 'not json', 4);
    const service = new SiteAnalyticsService(
      new RedisSiteAnalyticsStore(async () => redis)
    );

    expect(await service.summary()).toEqual([]);
  });
});
