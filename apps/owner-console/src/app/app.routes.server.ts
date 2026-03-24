import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'dashboard/app-config/designer/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => [{ id: 'sample' }],
  },
  {
    path: 'dashboard/communities/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/communities/:id/members',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/cities/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
