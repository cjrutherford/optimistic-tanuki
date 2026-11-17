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
    path: 'dashboard/directory-link-review/:communityId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/directory-address-review/:communityId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/directory-identity-review/:communityId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/directory-listing-suppressions/:communityId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/directory-listing-reports/:communityId',
    renderMode: RenderMode.Client,
  },
  // S7 operator pages need the browser session, so they never render on the server.
  ...[
    'dashboard/directory-rights',
    'dashboard/directory-withdrawals',
    'dashboard/directory-taxonomy',
    'dashboard/directory-taxonomy-runs',
    'dashboard/directory-runs',
  ].map((path): ServerRoute => ({ path, renderMode: RenderMode.Client })),
  {
    path: 'dashboard/boundary-review/:communityId',
    renderMode: RenderMode.Client,
  },
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
