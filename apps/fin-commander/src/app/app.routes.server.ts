import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'demo',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'commander/:planId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'commander/:planId/overview',
    renderMode: RenderMode.Client,
  },
  {
    path: 'commander/:planId/cash-flow',
    renderMode: RenderMode.Client,
  },
  {
    path: 'commander/:planId/goals',
    renderMode: RenderMode.Client,
  },
  {
    path: 'commander/:planId/scenarios',
    renderMode: RenderMode.Client,
  },
  {
    path: 'commander/:planId/imports',
    renderMode: RenderMode.Client,
  },
  {
    path: 'finance',
    renderMode: RenderMode.Client,
  },
  {
    path: 'finance/:workspace',
    renderMode: RenderMode.Client,
  },
  {
    path: 'finance/:workspace/:section',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
