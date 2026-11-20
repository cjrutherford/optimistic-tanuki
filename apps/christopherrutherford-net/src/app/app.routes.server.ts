import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'oauth/callback',
    renderMode: RenderMode.Client,
  },
  {
    path: 'oauth/callback/:provider',
    renderMode: RenderMode.Client,
  },
  {
    path: 'forum/topic/:topicId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'forum/thread/:threadId',
    renderMode: RenderMode.Client,
  },
  {
    // Render on the server for every request. The marketing page is the
    // crawler- and link-preview-facing surface, so it must return real HTML
    // rather than the client-only shell.
    path: '**',
    renderMode: RenderMode.Server,
  },
];
