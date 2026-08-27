import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'app/:appName',
    renderMode: RenderMode.Client,
  },
  {
    path: '',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
