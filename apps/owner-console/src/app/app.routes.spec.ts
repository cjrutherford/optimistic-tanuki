import { Route, Router, UrlTree } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { runInInjectionContext, Injector, Type } from '@angular/core';

import { appRoutes } from './app.routes';
import { authGuard } from './guards/auth.guard';
import { ownerAccessGuard } from './guards/owner-access.guard';
import { AuthService } from './services/auth.service';

type AnyRoute = Route & { children?: AnyRoute[] };

const flatten = (routes: AnyRoute[]): AnyRoute[] =>
  routes.flatMap((route) => [route, ...flatten(route.children ?? [])]);

const findRoute = (path: string): AnyRoute => {
  const match = flatten(appRoutes as AnyRoute[]).find((r) => r.path === path);
  if (!match) {
    throw new Error(`No route registered for path "${path}"`);
  }
  return match;
};

describe('appRoutes', () => {
  it('registers a dashboard shell guarded by the auth guard', () => {
    const dashboard = appRoutes.find((r) => r.path === 'dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard?.canActivate).toEqual([authGuard]);
    expect(dashboard?.children?.length).toBeGreaterThan(0);
  });

  it('sends the bare path to the dashboard, which gates on sign-in', () => {
    const root = appRoutes.find((r) => r.path === '' && !r.children);
    expect(root?.redirectTo).toBe('/dashboard');
    expect(root?.pathMatch).toBe('full');
  });

  it('defaults the dashboard to Home', () => {
    const dashboard = appRoutes.find((r) => r.path === 'dashboard');
    const fallback = dashboard?.children?.find((r) => r.path === '');
    expect(fallback?.redirectTo).toBe('home');
    expect(fallback?.pathMatch).toBe('full');
  });

  it('gates the dashboard shell on owner access', () => {
    const dashboard = appRoutes.find((r) => r.path === 'dashboard');
    expect(dashboard?.canActivateChild).toEqual([ownerAccessGuard]);
  });

  it.each([
    ['overview', 'home'],
    ['control-center', 'deployments'],
    ['governance', 'users'],
    ['experience', 'app-config'],
    ['commerce', 'store/overview'],
    ['crm', 'contacts'],
  ])('keeps the retired /dashboard/%s URL as a redirect to %s', (from, to) => {
    const dashboard = appRoutes.find((r) => r.path === 'dashboard');
    const route = dashboard?.children?.find((r) => r.path === from);
    expect(route?.redirectTo).toBe(to);
    expect(route?.pathMatch).toBe('full');
  });

  describe('public /control-center', () => {
    const resolve = (signedIn: boolean): string => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          {
            provide: AuthService,
            useValue: { isAuthenticated: () => signedIn },
          },
        ],
      });
      const route = appRoutes.find((r) => r.path === 'control-center');
      const redirect = route?.redirectTo as () => string;
      return TestBed.runInInjectionContext(() => redirect());
    };

    it('sends anonymous visitors to the login page', () => {
      expect(resolve(false)).toBe('/login');
    });

    it('sends signed-in owners to Home', () => {
      expect(resolve(true)).toBe('/dashboard/home');
    });
  });

  it('keeps the legacy business-site catalog path redirecting to the store route', () => {
    const legacy = findRoute('business-site/catalog');
    expect(legacy.redirectTo).toBe('store/business-site');
    expect(legacy.pathMatch).toBe('full');
  });

  it('marks the guided and studio app-config designer routes distinctly', () => {
    const guidedRoute = findRoute('app-config/designer');
    const studioRoute = findRoute('app-config/designer/:id');

    expect(guidedRoute.data).toEqual({
      editorMode: 'guided',
      workspaceKind: 'app-config',
    });
    expect(studioRoute.data).toEqual({
      editorMode: 'studio',
      workspaceKind: 'app-config',
    });
    expect(guidedRoute?.canDeactivate).toHaveLength(1);
    expect(studioRoute?.canDeactivate).toHaveLength(1);
  });

  it('redirects register to login with the provisioning query flag', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const injector = TestBed.inject(Injector);
    const router = TestBed.inject(Router);

    const register = appRoutes.find((r) => r.path === 'register');
    const redirect = register?.redirectTo as () => UrlTree;
    expect(typeof redirect).toBe('function');

    const tree = runInInjectionContext(injector, () => redirect());
    expect(tree instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(tree)).toBe('/login?provisioning=required');
  });

  it('resolves every lazily loaded component to a real class', async () => {
    const lazyRoutes = flatten(appRoutes as AnyRoute[]).filter(
      (r) => typeof r.loadComponent === 'function'
    );

    expect(lazyRoutes.length).toBeGreaterThan(20);

    for (const route of lazyRoutes) {
      const loaded = await (
        route.loadComponent as () => Promise<Type<unknown>>
      )();
      expect(typeof loaded).toBe('function');
      expect(loaded.name).toBeTruthy();
    }
  }, 60000);
});
