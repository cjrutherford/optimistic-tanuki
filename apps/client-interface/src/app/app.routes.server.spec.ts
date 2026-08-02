import { RenderMode } from '@angular/ssr';
import serverRoutes from './app.routes.server';

jest.mock('@angular/ssr', () => ({
  RenderMode: {
    Client: 0,
    Prerender: 1,
    Server: 2,
  },
}));

describe('client-interface server routes', () => {
  it.each([
    '',
    'login',
    'register',
    'auth/verify',
    'auth/magic-link',
    'auth/reset-password',
  ])('prerenders the public route "%s"', (path) => {
    expect(serverRoutes).toContainEqual({
      path,
      renderMode: RenderMode.Prerender,
    });
  });

  it.each(['oauth/callback', 'oauth/callback/:provider'])(
    'renders the browser-only OAuth route "%s" on the client',
    (path) => {
      expect(serverRoutes).toContainEqual({
        path,
        renderMode: RenderMode.Client,
      });
    }
  );

  it('uses the client shell for protected and future routes', () => {
    expect(serverRoutes.at(-1)).toEqual({
      path: '**',
      renderMode: RenderMode.Client,
    });
  });
});
