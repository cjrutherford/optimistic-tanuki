import { Route } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  DASHBOARD_NAV_ENTRIES,
  BESPOKE_WORKSPACE_PATHS,
  activeNavRoute,
} from './dashboard-nav';
import { OPERATOR_WORKSPACES } from './operator-workspaces';

const dashboardChildren: Route[] =
  appRoutes.find((route) => route.path === 'dashboard')?.children ?? [];

/**
 * Routed pages that must be reachable from the sidebar. Redirects, the empty
 * path and parameterised children are excluded. Login, register and OAuth
 * routes live outside `/dashboard`, so they are not in this set.
 */
const routedPages = dashboardChildren
  .filter((route) => !route.redirectTo)
  .map((route) => route.path ?? '')
  .filter((path) => path !== '' && !path.includes(':'));

/** Routes the sidebar links to directly or through a rendered workspace landing. */
const reachableRoutes = (): string[] => [
  ...DASHBOARD_NAV_ENTRIES.map((entry) => entry.route),
  ...OPERATOR_WORKSPACES.filter(
    (workspace) => !BESPOKE_WORKSPACE_PATHS.includes(workspace.path)
  ).flatMap((workspace) => workspace.cards.map((card) => card.route)),
];

describe('dashboard navigation coverage', () => {
  it('finds routed pages to check', () => {
    expect(routedPages.length).toBeGreaterThan(20);
  });

  it.each(routedPages)(
    '/dashboard/%s is reachable from the sidebar',
    (path) => {
      const target = `/dashboard/${path}`;
      const reachable = reachableRoutes().some(
        (route) => target === route || target.startsWith(`${route}/`)
      );
      expect(reachable).toBe(true);
    }
  );

  it('does not keep the oauth-inspector alias route', () => {
    expect(routedPages).not.toContain('oauth-inspector');
  });

  it('gives every nav entry a unique label and route that is routed', () => {
    const labels = DASHBOARD_NAV_ENTRIES.map((entry) => entry.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const entry of DASHBOARD_NAV_ENTRIES) {
      expect(routedPages).toContain(entry.route.replace('/dashboard/', ''));
    }
  });

  it('prefers the most specific nav entry for the active route', () => {
    expect(activeNavRoute('/dashboard/directory-taxonomy-runs')).toBe(
      '/dashboard/directory-taxonomy-runs'
    );
    expect(activeNavRoute('/dashboard/directory-taxonomy?x=1')).toBe(
      '/dashboard/directory-taxonomy'
    );
    expect(activeNavRoute('/dashboard/app-config/designer/abc')).toBe(
      '/dashboard/app-config/designer'
    );
    expect(activeNavRoute('/login')).toBeUndefined();
  });
});
