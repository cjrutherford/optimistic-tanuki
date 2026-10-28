import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import {
  LocalOAuthStateStore,
  OAuthStateStore,
  RedisOAuthStateStore,
  StoredOAuthCallbackGrant,
  StoredOAuthState,
} from './oauth-state.store';

const account = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const state = (linkUserId?: string): StoredOAuthState => ({
  payload: {
    provider: 'google',
    returnTo: 'https://ot.example.test',
    appScope: 'client-interface',
    issuedAt: Date.now(),
    codeVerifier: 'pkce',
    ...(linkUserId ? { linkUserId } : {}),
  },
  nonceHash: 'nonce',
  expiresAt: Date.now() + 60_000,
});
const grant = (userId: string): StoredOAuthCallbackGrant => ({
  userId,
  sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  profileId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  appId: 'local-hub',
  returnOrigin: 'https://ts.example.test',
  redemptionOrigin: 'https://ts.example.test',
  stateId: 'state',
  nonceHash: 'nonce',
  expiresAt: Date.now() + 60_000,
});
const consume = (store: OAuthStateStore, code: string) =>
  store.consumeCallbackGrant(code, 'https://ts.example.test', 'state', 'nonce');

async function seedAndPurge(store: OAuthStateStore) {
  await store.create('target-link', state(account.toUpperCase()));
  await store.create('foreign-link', state(other));
  await store.create('unbound', state());
  await store.createCallbackGrant('target-grant', grant(account.toUpperCase()));
  await store.createCallbackGrant('foreign-grant', grant(other));
  await expect(store.purgeAccount(account)).resolves.toEqual({ remaining: 0 });
  await expect(store.purgeAccount(account.toUpperCase())).resolves.toEqual({
    remaining: 0,
  });
  expect(await store.readbackAccount(account)).toBe(0);
  expect(await store.consume('target-link')).toBeUndefined();
  expect(await consume(store, 'target-grant')).toBeUndefined();
  expect(await store.consume('foreign-link')).toBeDefined();
  expect(await store.consume('unbound')).toBeDefined();
  expect(await consume(store, 'foreign-grant')).toBeDefined();
}

async function lateWrites(store: OAuthStateStore) {
  await expect(store.create('late-link', state(account))).rejects.toThrow(
    'OAUTH_ACCOUNT_DELETION_FENCED'
  );
  await expect(
    store.createCallbackGrant('late-grant', grant(account))
  ).rejects.toThrow('OAUTH_ACCOUNT_DELETION_FENCED');
  expect(await store.readbackAccount(account)).toBe(0);
}

describe('D25 local OAuth account purge', () => {
  it('removes account copies, preserves counterparts and fences late writes', async () => {
    const store = new LocalOAuthStateStore();
    await seedAndPurge(store);
    await lateWrites(store);
  });
  it('ordinary invalidation permits later login and cannot stand in for deletion proof', async () => {
    const store = new LocalOAuthStateStore();
    await store.invalidateAccount(account);
    await expect(
      store.createCallbackGrant('new-login', grant(account))
    ).resolves.toBeUndefined();
    await expect(store.readbackAccount(account)).rejects.toThrow(
      'OAUTH_DELETION_FENCE_REQUIRED'
    );
  });
  it('rejects invalid/nil account selectors without touching other entries', async () => {
    const store = new LocalOAuthStateStore();
    await store.createCallbackGrant('foreign', grant(other));
    for (const invalid of [
      '',
      'not-an-account',
      '00000000-0000-0000-0000-000000000000',
    ])
      await expect(store.purgeAccount(invalid)).rejects.toThrow(
        'Invalid account id'
      );
    expect(await consume(store, 'foreign')).toBeDefined();
  });
});

const privateDescribe =
  process.env.D25_PRIVATE_REDIS === 'd25-private-redis'
    ? describe
    : describe.skip;
privateDescribe('D25 real Redis OAuth account purge', () => {
  let a: RedisOAuthStateStore;
  let b: RedisOAuthStateStore;
  let inspector: ReturnType<typeof createClient>;
  const stores: RedisOAuthStateStore[] = [];
  let port: number;
  async function replica() {
    const store = new RedisOAuthStateStore('127.0.0.1', port);
    stores.push(store);
    const client = (
      store as unknown as { client: ReturnType<typeof createClient> }
    ).client;
    if (!client.isReady)
      await once(client, 'ready', { signal: AbortSignal.timeout(5000) });
    return store;
  }
  beforeAll(async () => {
    port = Number(process.env.D25_REDIS_PORT);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw Error('PRIVATE_REDIS_PORT_REQUIRED');
    inspector = createClient({ socket: { host: '127.0.0.1', port } });
    await inspector.connect();
    // This is a disposable private instance, never a shared Redis DB.
    if ((await inspector.dbSize()) !== 0)
      throw Error('PRIVATE_REDIS_NOT_EMPTY');
    a = await replica();
    b = await replica();
  }, 15000);
  afterAll(async () => {
    await Promise.all(stores.map((s) => s.onModuleDestroy()));
    if (inspector?.isOpen) await inspector.quit();
  });
  it('purges real keys atomically, preserves counterpart data and fences another replica', async () => {
    await seedAndPurge(a);
    await lateWrites(b);
    const key = createHash('sha256')
      .update(`ot:oauth-deletion:${account}`)
      .digest('hex');
    expect(await inspector.hGetAll('gateway:oauth-deletion:fences')).toEqual({
      [key]: '1',
    });
    expect(await inspector.exists('gateway:oauth-state:target-link')).toBe(0);
    expect(
      await inspector.exists('gateway:oauth-callback-grant:target-grant')
    ).toBe(0);
    expect(await inspector.zCard('gateway:oauth-state:index')).toBe(0);
    expect(await inspector.zCard('gateway:oauth-callback-grant:index')).toBe(0);
  });
  it('retains deletion fence after the original clients close and a new client connects', async () => {
    await a.onModuleDestroy();
    await b.onModuleDestroy();
    await lateWrites(await replica());
  });
  it('serializes concurrent creation against purge and independently reads zero target copies', async () => {
    const racingAccount = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const writer = await replica();
    const purger = await replica();
    const outcomes = await Promise.allSettled([
      ...Array.from({ length: 30 }, (_, i) =>
        writer.createCallbackGrant(`race-${i}`, grant(racingAccount))
      ),
      purger.purgeAccount(racingAccount),
    ]);
    expect(outcomes[30].status).toBe('fulfilled');
    expect(await purger.readbackAccount(racingAccount)).toBe(0);
    const raw = await inspector.mGet(
      Array.from(
        { length: 30 },
        (_, i) => `gateway:oauth-callback-grant:race-${i}`
      )
    );
    expect(raw.every((v) => v === null)).toBe(true);
  });
  it('fails closed on corrupt indexed copies, retains fence and retries after repair', async () => {
    await inspector.set(
      'gateway:oauth-state:orphan',
      JSON.stringify(state(other.toUpperCase()))
    );
    await inspector.set(
      'gateway:oauth-callback-grant:orphan',
      JSON.stringify(grant(other))
    );
    await inspector.set('gateway:oauth-state:corrupt', 'not-json');
    await inspector.zAdd('gateway:oauth-state:index', {
      score: Date.now() + 60000,
      value: 'corrupt',
    });
    await expect(b.purgeAccount(other)).rejects.toThrow(); // b was closed; no success on unavailable Redis
    const live = await replica();
    await expect(live.purgeAccount(other)).rejects.toThrow(
      'OAUTH_DELETION_UNVERIFIED'
    );
    await expect(
      live.createCallbackGrant('blocked-after-failure', grant(other))
    ).rejects.toThrow('OAUTH_ACCOUNT_DELETION_FENCED');
    await inspector.del('gateway:oauth-state:corrupt');
    await expect(live.purgeAccount(other)).resolves.toEqual({ remaining: 0 });
    expect(await inspector.exists('gateway:oauth-state:orphan')).toBe(0);
    expect(await inspector.exists('gateway:oauth-callback-grant:orphan')).toBe(
      0
    );
  });
});
