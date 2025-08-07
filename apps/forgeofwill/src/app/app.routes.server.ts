import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Defines server-side routes for the Forge of Will application.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
