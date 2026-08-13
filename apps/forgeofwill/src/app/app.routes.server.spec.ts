import { RenderMode } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

jest.mock('@angular/ssr', () => ({
  RenderMode: {
    Client: 0,
    Prerender: 1,
    Server: 2,
  },
}));

describe('Forge server rendering policy', () => {
  it('keeps login and protected application routes client-rendered before public prerendering', () => {
    const clientPaths = serverRoutes
      .filter((route) => route.renderMode === RenderMode.Client)
      .map((route) => route.path);
    const publicFallback = serverRoutes.find((route) => route.path === '**');

    expect(clientPaths).toEqual(
      expect.arrayContaining([
        'login',
        'register',
        'projects',
        'profile',
        'settings',
        'messages',
        'messages/new',
        'oauth/callback',
        'oauth/callback/:provider',
      ])
    );
    expect(publicFallback?.renderMode).toBe(RenderMode.Prerender);
    expect(serverRoutes.indexOf(publicFallback!)).toBe(serverRoutes.length - 1);
  });
});
