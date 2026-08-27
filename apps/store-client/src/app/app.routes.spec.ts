import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { appRoutes } from './app.routes';

describe('store-client appRoutes', () => {
  it('registers the shared OAuth popup callback before the root redirect', () => {
    expect(appRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining(['oauth/callback'])
    );
    expect(appRoutes.find((route) => route.path === 'oauth/callback')).toBe(
      oauthCallbackRoutes[0]
    );
    expect(
      appRoutes.findIndex((route) => route.path === 'oauth/callback')
    ).toBeLessThan(appRoutes.findIndex((route) => route.path === ''));
  });
});
