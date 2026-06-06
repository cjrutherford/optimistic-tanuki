import { appRoutes } from './app.routes';

describe('appRoutes', () => {
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
