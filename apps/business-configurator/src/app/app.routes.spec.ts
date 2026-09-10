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

  it('loads the entitled workspace picker at the root path', async () => {
    const rootRoute = appRoutes.find((route) => route.path === '');

    expect(rootRoute).toBeDefined();
    expect(rootRoute?.loadComponent).toBeDefined();
    await expect(rootRoute?.loadComponent?.()).resolves.toEqual(
      expect.objectContaining({ name: 'WorkspacePickerPageComponent' })
    );
  });

  it('loads a native owner sign-in surface for recoverable session expiry', async () => {
    const loginRoute = appRoutes.find((route) => route.path === 'login');

    expect(loginRoute?.title).toBe('Sign in to Configurator');
    await expect(loginRoute?.loadComponent?.()).resolves.toEqual(
      expect.objectContaining({ name: 'ConfiguratorLoginPageComponent' })
    );
  });

  it('loads the existing Business Site editor only at a canonical workspace route', async () => {
    const editorRoute = appRoutes.find(
      (route) => route.path === 'workspaces/:workspaceId/sites/:siteSlug'
    );

    expect(editorRoute?.data).toEqual(
      expect.objectContaining({
        editorMode: 'guided',
        workspaceKind: 'business-site',
      })
    );
    await expect(editorRoute?.loadComponent?.()).resolves.toEqual(
      expect.objectContaining({ name: 'BusinessSiteEditorPageComponent' })
    );
  });

  it('loads product authoring through a canonical workspace route', async () => {
    const route = appRoutes.find(
      (candidate) =>
        candidate.path === 'workspaces/:workspaceId/authoring/:product'
    );

    await expect(route?.loadComponent?.()).resolves.toEqual(
      expect.objectContaining({ name: 'ProductAuthoringPageComponent' })
    );
  });
});
