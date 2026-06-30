import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('does not expose the legacy setup route', () => {
    const setupRoute = appRoutes.find((route) => route.path === 'setup');

    expect(setupRoute).toBeUndefined();
  });

  it('exposes an anonymous control-center status route outside the dashboard shell', () => {
    const controlCenterRoute = appRoutes.find(
      (route) => route.path === 'control-center'
    );

    expect(controlCenterRoute).toBeDefined();
    expect(controlCenterRoute?.canActivate).toBeUndefined();
  });

  it('exposes operator workspace routes under the dashboard shell', () => {
    const dashboardRoute = appRoutes.find(
      (route) => route.path === 'dashboard'
    );

    expect(dashboardRoute).toBeDefined();

    const childPaths = (dashboardRoute?.children ?? []).map(
      (route) => route.path
    );

    expect(childPaths).toEqual(
      expect.arrayContaining([
        'overview',
        'governance',
        'experience',
        'commerce',
        'crm',
        'community-ops',
        'contacts',
        'operations',
        'control-center',
        'oauth-inspector',
        'registry',
        'social-governance',
        'forum-governance',
        'app-config',
        'app-config/designer',
        'app-config/designer/:id',
      ])
    );
  });

  it('exposes dedicated social and forum governance routes for community ops', () => {
    const dashboardRoute = appRoutes.find(
      (route) => route.path === 'dashboard'
    );

    const childPaths = (dashboardRoute?.children ?? []).map(
      (route) => route.path
    );

    expect(childPaths).toEqual(
      expect.arrayContaining(['social-governance', 'forum-governance'])
    );
  });

  it('defaults the dashboard shell to the overview workspace', () => {
    const dashboardRoute = appRoutes.find(
      (route) => route.path === 'dashboard'
    );
    const defaultChild = dashboardRoute?.children?.find(
      (route) => route.path === ''
    );

    expect(defaultChild?.redirectTo).toBe('overview');
  });

  it('redirects the app root to the public control-center entry', () => {
    const rootRoute = appRoutes.find((route) => route.path === '');

    expect(rootRoute?.redirectTo).toBe('/control-center');
  });

  it('assigns guided and studio workspace modes to app-config designer routes', () => {
    const dashboardRoute = appRoutes.find(
      (route) => route.path === 'dashboard'
    );
    const guidedRoute = dashboardRoute?.children?.find(
      (route) => route.path === 'app-config/designer'
    );
    const studioRoute = dashboardRoute?.children?.find(
      (route) => route.path === 'app-config/designer/:id'
    );

    expect(guidedRoute?.data).toMatchObject({
      editorMode: 'guided',
      workspaceKind: 'app-config',
    });
    expect(studioRoute?.data).toMatchObject({
      editorMode: 'studio',
      workspaceKind: 'app-config',
    });
  });
});
