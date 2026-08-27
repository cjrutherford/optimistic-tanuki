import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { appRoutes } from './app.routes';

describe('business-configurator appRoutes', () => {
  it('registers the shared OAuth popup callback before the fallback route', () => {
    expect(appRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining(['oauth/callback'])
    );
    expect(appRoutes.find((route) => route.path === 'oauth/callback')).toBe(
      oauthCallbackRoutes[0]
    );
    expect(
      appRoutes.findIndex((route) => route.path === 'oauth/callback')
    ).toBeLessThan(appRoutes.findIndex((route) => route.path === '**'));
  });

  it('loads the consolidated workspace in guided mode at the root path', () => {
    const rootRoute = appRoutes.find((route) => route.path === '');

    expect(rootRoute).toBeDefined();
    expect(rootRoute?.data).toEqual(
      expect.objectContaining({
        editorMode: 'guided',
        workspaceKind: 'business-site',
      })
    );
    expect(rootRoute?.loadComponent).toBeDefined();
  });
});
