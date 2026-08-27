import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantContextService } from '../tenant-context.service';

export const tenantRouteContextGuard: CanActivateFn = async (route, state) => {
  const tenantContext = inject(TenantContextService);
  const router = inject(Router);
  const routeTenantId = route.paramMap.get('tenantId');

  if (
    !routeTenantId ||
    !(await tenantContext.activateRouteTenant(routeTenantId))
  ) {
    return router.createUrlTree(['/onboarding']);
  }

  const activeTenant = tenantContext.activeTenant();
  if (!activeTenant) {
    return router.createUrlTree(['/onboarding']);
  }

  if (routeTenantId === 'active') {
    return router.parseUrl(
      state.url.replace(
        /^\/tenants\/active(?=\/|$)/,
        `/tenants/${activeTenant.id}`
      )
    );
  }
  return true;
};
