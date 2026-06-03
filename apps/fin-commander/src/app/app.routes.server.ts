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
    path: 'tenants/active',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId/overview',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId/plans',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId/plans/:planId/overview',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId/plans/:planId/cash-flow',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId/plans/:planId/goals',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId/plans/:planId/scenarios',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId/plans/:planId/imports',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId/accounts',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId/accounts/:workspace',
    renderMode: RenderMode.Client,
  },
  {
    path: 'tenants/:tenantId/accounts/:workspace/:section',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
