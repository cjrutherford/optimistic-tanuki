import { Route } from '@angular/router';

import { appRoutes } from './app.routes';

/**
 * The spec beside this one asserts the shape of the route table. This one
 * resolves every lazy `loadComponent`, which the shape tests never invoke.
 *
 * A renamed or removed export in one of the feature libraries leaves the route
 * table type-correct — the import is inside a callback — and only fails when a
 * user navigates to that page. Running each loader turns that into a test
 * failure instead.
 */
describe('appRoutes lazy loaders', () => {
  const collect = (routes: Route[], trail = ''): [string, Route][] =>
    routes.flatMap((route) => {
      const path = [trail, route.path ?? ''].filter(Boolean).join('/');
      return [
        ...(route.loadComponent
          ? ([[path || '(root)', route]] as [string, Route][])
          : []),
        ...(route.children ? collect(route.children, path) : []),
      ];
    });

  const lazyRoutes = collect(appRoutes);

  it('has lazy routes to check', () => {
    expect(lazyRoutes.length).toBeGreaterThan(0);
  });

  it.each(lazyRoutes)('resolves the component for %s', async (_path, route) => {
    const loaded = await (route.loadComponent as () => Promise<unknown>)();

    expect(loaded).toBeInstanceOf(Function);
  });
});
