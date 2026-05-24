import { appRoutes } from './app.routes';

describe('business-configurator appRoutes', () => {
  it('loads the consolidated workspace in guided mode at the root path', () => {
    const rootRoute = appRoutes.find((route) => route.path === '');

    expect(rootRoute).toBeDefined();
    expect(rootRoute?.data).toEqual(
      expect.objectContaining({
        editorMode: 'guided',
        workspaceKind: 'business-site',
      })
    );
    expect(rootRoute?.loadComponent).toBeDefined();
  });
});
