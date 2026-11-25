import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { appRoutes } from './app.routes';

describe('christopherrutherford-net appRoutes', () => {
  it('registers the shared OAuth popup callback before the landing fallback', () => {
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

  it('serves the landing page at the root and a 404 page for anything else', async () => {
    const { LandingComponent } = await import('../landing/landing.component');
    const { NotFoundComponent } = await import(
      './not-found/not-found.component'
    );
    const root = appRoutes.find((route) => route.path === '');
    const fallback = appRoutes.find((route) => route.path === '**');

    expect(root?.pathMatch).toBe('full');
    expect(await root?.loadComponent?.()).toBe(LandingComponent);
    expect(await fallback?.loadComponent?.()).toBe(NotFoundComponent);
  });
});
