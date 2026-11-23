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
  // Every per-town page needs the browser session.
  {
    path: 'dashboard/towns/**',
    renderMode: RenderMode.Client,
  },
  // S7 operator pages need the browser session, so they never render on the server.
  ...[
    'dashboard/directory-rights',
    'dashboard/directory-withdrawals',
    'dashboard/directory-exports',
    'dashboard/directory-operations',
    'dashboard/directory-taxonomy',
    'dashboard/directory-taxonomy-runs',
    'dashboard/directory-runs',
    'dashboard/directory-suspended-bindings',
    'dashboard/directory-jobs',
  ].map((path): ServerRoute => ({ path, renderMode: RenderMode.Client })),
  {
    path: 'dashboard/cities/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/performance',
    renderMode: RenderMode.Client,
  },
  {
    path: '',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
