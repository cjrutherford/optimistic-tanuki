import { Route, Router, UrlTree } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { runInInjectionContext, Injector, Type } from '@angular/core';

import { appRoutes } from './app.routes';
import { authGuard } from './guards/auth.guard';
import { OPERATOR_WORKSPACES } from './operator-workspaces';

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

  it('sends the bare path to the public control center', () => {
    const root = appRoutes.find((r) => r.path === '' && !r.children);
    expect(root?.redirectTo).toBe('/control-center');
    expect(root?.pathMatch).toBe('full');
  });

  it('defaults the dashboard to the overview workspace', () => {
    const dashboard = appRoutes.find((r) => r.path === 'dashboard');
    const fallback = dashboard?.children?.find((r) => r.path === '');
    expect(fallback?.redirectTo).toBe('overview');
    expect(fallback?.pathMatch).toBe('full');
  });

  it('keeps the legacy business-site catalog path redirecting to the store route', () => {
    const legacy = findRoute('business-site/catalog');
    expect(legacy.redirectTo).toBe('store/business-site');
    expect(legacy.pathMatch).toBe('full');
  });

  it('generates a workspace landing route for every operator workspace', () => {
    const paths = flatten(appRoutes as AnyRoute[]).map((r) => r.path);
    for (const workspace of OPERATOR_WORKSPACES) {
      expect(paths).toContain(workspace.path);
    }
  });

  it('carries workspace metadata onto the generated landing routes', () => {
    const generated = OPERATOR_WORKSPACES.find(
      (w) => w.path !== 'community-ops' && w.path !== 'experience'
    );
    expect(generated).toBeDefined();
    const route = findRoute(generated!.path);
    expect(route.data).toEqual({
      title: generated!.label,
      description: generated!.description,
      summary: generated!.summary,
      checklist: generated!.checklist,
      cards: generated!.cards,
    });
  });

  it('marks the guided and studio app-config designer routes distinctly', () => {
    expect(findRoute('app-config/designer').data).toEqual({
      editorMode: 'guided',
      workspaceKind: 'app-config',
    });
    expect(findRoute('app-config/designer/:id').data).toEqual({
      editorMode: 'studio',
      workspaceKind: 'app-config',
    });
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
