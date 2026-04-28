import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('exposes landing, create, and results routes', () => {
    expect(appRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining(['', 'create', 'results', '**'])
    );
  });
});
