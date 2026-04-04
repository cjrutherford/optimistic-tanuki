import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('exposes operator workspace routes under the dashboard shell', () => {
    const dashboardRoute = appRoutes.find((route) => route.path === 'dashboard');

    expect(dashboardRoute).toBeDefined();

    const childPaths = (dashboardRoute?.children ?? []).map((route) => route.path);

    expect(childPaths).toEqual(
      expect.arrayContaining([
        'overview',
        'governance',
        'experience',
        'commerce',
        'community-ops',
        'operations',
      ])
    );
  });

  it('defaults the dashboard shell to the overview workspace', () => {
    const dashboardRoute = appRoutes.find((route) => route.path === 'dashboard');
    const defaultChild = dashboardRoute?.children?.find((route) => route.path === '');

    expect(defaultChild?.redirectTo).toBe('overview');
  });
});
