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
    path: 'blog/:id',
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
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
