import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { appRoutes } from './app.routes';

describe('appRoutes', () => {
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

  it('exposes landing, offer index, offer brief, and offer workspace routes', () => {
    expect(appRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        '',
        'offers',
        'offers/new',
        'offers/:offerId',
        'create',
        'results',
        '**',
      ])
    );
  });

  it('keeps legacy create and results paths as redirects into the offer flow', () => {
    expect(appRoutes.find((route) => route.path === 'create')?.redirectTo).toBe(
      '/offers/new'
    );
    expect(
      appRoutes.find((route) => route.path === 'results')?.redirectTo
    ).toBe('/offers');
  });
});
