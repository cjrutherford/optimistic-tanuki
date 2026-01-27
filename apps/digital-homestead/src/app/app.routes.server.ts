import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
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
