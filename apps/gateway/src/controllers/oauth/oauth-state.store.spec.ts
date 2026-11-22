import {
  assertOAuthStateEnvironment,
  LocalOAuthStateStore,
  StoredPendingOAuthIntent,
  selectOAuthStateStore,
} from './oauth-state.store';

describe('OAuth state environment', () => {
  const required = { OAUTH_STATE_SECRET: 'state-secret' };

  it('allows a local state store only in explicit development or test environments', () => {
    expect(
      selectOAuthStateStore({
        ...required,
        NODE_ENV: 'development',
        OAUTH_STATE_STORE: 'local',
      })
    ).toBe('local');
    expect(
      selectOAuthStateStore({
        ...required,
        NODE_ENV: 'test',
        OAUTH_STATE_STORE: 'local',
      })
    ).toBe('local');
    expect(() =>
      selectOAuthStateStore({
        ...required,
        NODE_ENV: 'staging',
        OAUTH_STATE_STORE: 'local',
      })
    ).toThrow(
      'OAUTH_STATE_STORE=local is only permitted in development or test'
    );
  });

  it('requires Redis outside explicit development and test environments', () => {
    expect(
      selectOAuthStateStore({
        ...required,
        NODE_ENV: 'staging',
        REDIS_HOST: 'redis',
      })
    ).toBe('redis');
    expect(() =>
      selectOAuthStateStore({ ...required, NODE_ENV: 'staging' })
    ).toThrow('REDIS_HOST is required for the OAuth state store');
  });

  it('requires a dedicated OAuth state secret during startup', () => {
    expect(() =>
      assertOAuthStateEnvironment({
        NODE_ENV: 'production',
        REDIS_HOST: 'redis',
      })
    ).toThrow('OAUTH_STATE_SECRET is required');
  });
});

describe('LocalOAuthStateStore account invalidation', () => {
  it('invalidates matching linked states and callback grants while preserving unrelated entries', async () => {
    const store = new LocalOAuthStateStore();
    const state = (linkUserId?: string) => ({
      payload: {
        provider: 'google',
        returnTo: 'https://example.test',
        appScope: 'client-interface',
        issuedAt: Date.now(),
        codeVerifier: 'pkce',
        ...(linkUserId ? { linkUserId } : {}),
      },
      nonceHash: 'nonce-hash',
      expiresAt: Date.now() + 60_000,
    });
    const account = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await store.create('linked', state(account));
    await store.create('unbound', state());
    const grant = (userId: string) => ({
      sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      userId,
      profileId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      appId: 'client-interface',
      returnOrigin: 'https://example.test',
      redemptionOrigin: 'https://example.test',
      stateId: 'callback-state',
      nonceHash: 'nonce-hash',
      expiresAt: Date.now() + 60_000,
    });
    await store.createCallbackGrant('matching', grant(account));
    await store.createCallbackGrant(
      'unrelated',
      grant('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
    );

    await store.invalidateAccount(account.toUpperCase());

    expect(await store.consume('linked')).toBeUndefined();
    expect(await store.consume('unbound')).toBeDefined();
    expect(
      await store.consumeCallbackGrant(
        'matching',
        'https://example.test',
        'callback-state',
        'nonce-hash'
      )
    ).toBeUndefined();
    expect(
      await store.consumeCallbackGrant(
        'unrelated',
        'https://example.test',
        'callback-state',
        'nonce-hash'
      )
    ).toBeDefined();
  });
});

describe('LocalOAuthStateStore pending intents', () => {
  const binding = { stateId: 'state-1', nonceHash: 'nonce-hash' };
  const intent = (
    overrides: Partial<StoredPendingOAuthIntent> = {}
  ): StoredPendingOAuthIntent => ({
    kind: 'link_account',
    provider: 'google',
    providerUserId: 'g-1',
    email: 'a@example.com',
    emailVerified: true,
    displayName: 'A',
    firstName: 'A',
    lastName: 'B',
    appScope: 'client-interface',
    returnTo: 'https://app.example.com/',
    userId: 'b2222222-b222-4222-8222-b22222222222',
    hasPassword: true,
    ...binding,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  });

  it('reads without consuming, then consumes exactly once', async () => {
    const store = new LocalOAuthStateStore();
    await store.createPendingIntent('p1', intent());
    expect(await store.getPendingIntent('p1', binding)).toBeDefined();
    expect(await store.getPendingIntent('p1', binding)).toBeDefined();
    expect(await store.consumePendingIntent('p1', binding)).toBeDefined();
    expect(await store.consumePendingIntent('p1', binding)).toBeUndefined();
  });

  it('is bound to the nonce cookie and never leaks to another browser', async () => {
    const store = new LocalOAuthStateStore();
    await store.createPendingIntent('p1', intent());
    const other = { ...binding, nonceHash: 'someone-else' };
    expect(await store.getPendingIntent('p1', other)).toBeUndefined();
    expect(await store.consumePendingIntent('p1', other)).toBeUndefined();
    expect(await store.recordPendingAttempt('p1', other, 5)).toBeUndefined();
    expect(await store.getPendingIntent('p1', binding)).toBeDefined();
  });

  it('expires and deletes after the attempt limit', async () => {
    const store = new LocalOAuthStateStore();
    await store.createPendingIntent(
      'old',
      intent({ expiresAt: Date.now() - 1 })
    );
    expect(await store.getPendingIntent('old', binding)).toBeUndefined();
    await store.createPendingIntent('p1', intent());
    for (const expected of [1, 2, 3, 4])
      expect(await store.recordPendingAttempt('p1', binding, 5)).toBe(expected);
    expect(await store.recordPendingAttempt('p1', binding, 5)).toBe(5);
    expect(await store.getPendingIntent('p1', binding)).toBeUndefined();
  });

  it('keeps an email link code only while the intent is bound and alive', async () => {
    const store = new LocalOAuthStateStore();
    await store.createPendingIntent('p1', intent());
    expect(
      await store.setPendingLinkCode('p1', binding, {
        codeHash: 'h',
        expiresAt: 1,
      })
    ).toBe(true);
    expect(await store.getPendingLinkCode('p1', binding)).toEqual({
      codeHash: 'h',
      expiresAt: 1,
    });
    await store.consumePendingIntent('p1', binding);
    expect(await store.getPendingLinkCode('p1', binding)).toBeUndefined();
  });

  it('refuses intents that carry provider tokens', async () => {
    const store = new LocalOAuthStateStore();
    await expect(
      store.createPendingIntent('p1', {
        ...intent(),
        accessToken: 'x',
      } as StoredPendingOAuthIntent)
    ).rejects.toThrow();
  });

  it('drops link intents when the account is invalidated', async () => {
    const store = new LocalOAuthStateStore();
    await store.createPendingIntent('p1', intent());
    await store.invalidateAccount('b2222222-b222-4222-8222-b22222222222');
    expect(await store.getPendingIntent('p1', binding)).toBeUndefined();
  });
});
