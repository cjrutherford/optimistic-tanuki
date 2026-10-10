import {
  INCREMENT_SCRIPT,
  MemorySiteAnalyticsStore,
  RedisSiteAnalyticsStore,
  SiteAnalyticsRedisClient,
} from './site-analytics.store';
import { SiteAnalyticsService } from './site-analytics.service';

/**
 * Stands in for the Redis server: hashes that outlive any one client, and
 * scripts that run without interleaving, as Redis runs them.
 */
class FakeRedis implements SiteAnalyticsRedisClient {
  readonly hashes = new Map<string, Map<string, number>>();
  scripts = 0;

  hash(key: string) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    return this.hashes.get(key) as Map<string, number>;
  }
  async eval(script: string, options: { keys: string[]; arguments: string[] }) {
    expect(script).toBe(INCREMENT_SCRIPT);
    // Yield first, so concurrent callers interleave between scripts...
    await new Promise((resolve) => setImmediate(resolve));
    this.scripts += 1;
    // ...but never inside one: the check and the increment are one step.
    const hash = this.hash(options.keys[0]);
    const [key, overflowKey, max] = options.arguments;
    const fits = hash.has(key) || hash.size < Number(max);
    const target = fits ? key : overflowKey;
    hash.set(target, (hash.get(target) ?? 0) + 1);
    return fits ? 1 : 0;
  }
  async hGetAll(key: string) {
    return Object.fromEntries(
      [...(this.hashes.get(key) ?? new Map<string, number>())].map(
        ([field, value]) => [field, String(value)]
      )
    );
  }
}

describe('site analytics stores', () => {
  const event = { appId: 'hai', name: 'page_view', path: '/private-cloud' };

  it('memory store counts into the overflow once a tier is full', async () => {
    const store = new MemorySiteAnalyticsStore();

    expect(await store.increment('pages', 'a', 'o', 1)).toBe('counted');
    expect(await store.increment('pages', 'b', 'o', 1)).toBe('overflow');
    expect(await store.increment('pages', 'a', 'o', 1)).toBe('counted');
    // The other tier has its own budget.
    expect(await store.increment('campaigns', 'c', 'o', 1)).toBe('counted');
    expect(await store.entries()).toEqual([
      ['a', 2],
      ['o', 1],
      ['c', 1],
    ]);
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

  it('caps each tier in its own Redis hash', async () => {
    const redis = new FakeRedis();
    const store = new RedisSiteAnalyticsStore(async () => redis);

    expect(await store.increment('pages', 'a', 'o', 1)).toBe('counted');
    expect(await store.increment('pages', 'b', 'o', 1)).toBe('overflow');
    expect(await store.increment('pages', 'a', 'o', 1)).toBe('counted');
    expect(await store.increment('campaigns', 'c', 'o', 1)).toBe('counted');

    expect(redis.hash(RedisSiteAnalyticsStore.HASH)).toEqual(
      new Map([
        ['a', 2],
        ['o', 1],
      ])
    );
    expect(redis.hash(RedisSiteAnalyticsStore.CAMPAIGN_HASH)).toEqual(
      new Map([['c', 1]])
    );
  });

  it('never exceeds the budget under concurrent replicas', async () => {
    const redis = new FakeRedis();
    const replicas = [
      new RedisSiteAnalyticsStore(async () => redis),
      new RedisSiteAnalyticsStore(async () => redis),
    ];

    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        replicas[i % 2].increment('pages', `k${i}`, 'overflow', 10)
      )
    );

    const hash = redis.hash(RedisSiteAnalyticsStore.HASH);
    // Ten counters plus the overflow, and every event is counted once.
    expect(hash.size).toBe(11);
    expect(results.filter((r) => r === 'counted')).toHaveLength(10);
    expect(hash.get('overflow')).toBe(30);
    // One script per event: no separate check and increment to race.
    expect(redis.scripts).toBe(40);
  });

  it('retries the connection after a failure', async () => {
    const redis = new FakeRedis();
    const connect = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue(redis);
    const store = new RedisSiteAnalyticsStore(connect);

    await expect(store.increment('pages', 'a', 'o', 10)).rejects.toThrow(
      'ECONNREFUSED'
    );
    await expect(store.increment('pages', 'a', 'o', 10)).resolves.toBe(
      'counted'
    );
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('ignores unreadable keys when summarising', async () => {
    const redis = new FakeRedis();
    redis.hash(RedisSiteAnalyticsStore.HASH).set('not json', 4);
    const service = new SiteAnalyticsService(
      new RedisSiteAnalyticsStore(async () => redis)
    );

    expect(await service.summary()).toEqual([]);
  });
});
