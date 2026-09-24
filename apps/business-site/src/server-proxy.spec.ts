import { shouldPreserveClientOrigin } from './server-proxy';

describe('shouldPreserveClientOrigin', () => {
  it('preserves the browser origin for the OAuth redeem endpoint', () => {
    // The gateway redeem check requires Origin to equal the grant's app
    // origin. Rewriting it to the gateway origin 401s every business-site
    // OAuth redeem and bounces the login back to /login.
    expect(shouldPreserveClientOrigin('/api/oauth/callback/redeem')).toBe(true);
  });

  it('preserves the browser origin for all OAuth API paths', () => {
    expect(shouldPreserveClientOrigin('/api/oauth/start/google')).toBe(true);
    expect(shouldPreserveClientOrigin('/api/oauth/callback/google')).toBe(true);
    expect(
      shouldPreserveClientOrigin('/api/oauth/config?domain=example.com')
    ).toBe(true);
    expect(shouldPreserveClientOrigin('/api/oauth')).toBe(true);
  });

  it('keeps the existing gateway-origin rewrite for non-OAuth API paths', () => {
    expect(shouldPreserveClientOrigin('/api/authentication/session')).toBe(
      false
    );
    expect(shouldPreserveClientOrigin('/api/authentication/login')).toBe(false);
    expect(shouldPreserveClientOrigin('/api/profiles')).toBe(false);
    expect(shouldPreserveClientOrigin('/api/')).toBe(false);
  });
});
