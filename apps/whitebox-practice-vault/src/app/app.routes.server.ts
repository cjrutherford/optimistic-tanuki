import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'drop',
    renderMode: RenderMode.Server,
  },
  {
    path: 'drop/:token',
    renderMode: RenderMode.Server,
  },
  {
    path: 'escrow-verify',
    renderMode: RenderMode.Server,
  },
  {
    path: 'escrow-verify/:token',
    renderMode: RenderMode.Server,
  },
  {
    path: 'admin/compliance',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
