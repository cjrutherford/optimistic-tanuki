import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'dashboard/app-config/designer/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => [
      { id: 'sample' }
    ],
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
