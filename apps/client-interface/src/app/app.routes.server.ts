import { RenderMode, ServerRoute } from '@angular/ssr';

const serverRoutes: ServerRoute[] = [
  ...[
    '',
    'login',
    'register',
    'auth/verify',
    'auth/magic-link',
    'auth/reset-password',
  ].map(
    (path): ServerRoute => ({
      path,
      renderMode: RenderMode.Prerender,
    })
  ),
  {
    path: 'oauth/callback',
    renderMode: RenderMode.Client,
  },
  {
    path: 'oauth/callback/:provider',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];

export default serverRoutes;
