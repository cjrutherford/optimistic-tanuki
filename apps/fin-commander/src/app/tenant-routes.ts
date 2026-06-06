export function resolveTenantRouteId(tenantId?: string | null): string {
  return tenantId?.trim() || 'active';
}

export function tenantOverviewRoute(tenantId?: string | null): string[] {
  return ['/tenants', resolveTenantRouteId(tenantId), 'overview'];
}

export function tenantPlansRoute(tenantId?: string | null): string[] {
  return ['/tenants', resolveTenantRouteId(tenantId), 'plans'];
}

export function tenantPlanRoute(
  tenantId: string | null | undefined,
  planId: string,
  section:
    | 'overview'
    | 'cash-flow'
    | 'goals'
    | 'scenarios'
    | 'imports' = 'overview'
): string[] {
  return ['/tenants', resolveTenantRouteId(tenantId), 'plans', planId, section];
}

export function tenantAccountsRoute(
  tenantId?: string | null,
  workspace?: string | null,
  section?: string | null
): string[] {
  const route = ['/tenants', resolveTenantRouteId(tenantId), 'accounts'];

  if (workspace) {
    route.push(workspace);
  }

  if (section) {
    route.push(section);
  }

  return route;
}
