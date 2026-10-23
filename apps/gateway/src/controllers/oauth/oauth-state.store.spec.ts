import {
  assertOAuthStateEnvironment,
  LocalOAuthStateStore,
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
