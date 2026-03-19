import { RenderMode, ServerRoute } from '@angular/ssr';

const serverRoutes: ServerRoute[] = [
  {
    path: 'c/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: 'c/:slug/classifieds',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];

export default serverRoutes;
