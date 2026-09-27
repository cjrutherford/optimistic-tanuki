import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'projects/:id/milestones',
    renderMode: RenderMode.Server,
  },
  {
    path: 'projects/:id/drawings',
    renderMode: RenderMode.Server,
  },
  {
    path: 'projects/:id/photos',
    renderMode: RenderMode.Server,
  },
  {
    path: 'projects/:id/change-orders',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
