import { RenderMode, ServerRoute } from '@angular/ssr';

const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'c/:slug',
    renderMode: RenderMode.Client,
  },
  {
    path: 'c/:slug/classifieds',
    renderMode: RenderMode.Client,
  },
];

export default serverRoutes;
