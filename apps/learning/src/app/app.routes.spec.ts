import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { appRoutes } from './app.routes';

describe('learning appRoutes', () => {
  it('registers the shared OAuth popup callback', () => {
    expect(appRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining(['oauth/callback'])
    );
    expect(appRoutes.find((route) => route.path === 'oauth/callback')).toBe(
      oauthCallbackRoutes[0]
    );
  });

  it.each(['sign-in', 'about', 'docs'])(
    'lazy loads the Section 7 route: %s',
    (path) => {
      const route = appRoutes.find((candidate) => candidate.path === path);

      expect(route?.component).toBeUndefined();
      expect(route?.loadComponent).toEqual(expect.any(Function));
    }
  );

  it.each(['sign-in', 'about', 'docs'])(
    'resolves the %s route component through its lazy loader',
    async (path) => {
      const route = appRoutes.find((candidate) => candidate.path === path);

      await expect(route?.loadComponent?.()).resolves.toEqual(
        expect.any(Function)
      );
    }
  );
});
