import {
  assertOAuthStateEnvironment,
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
