import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';

export const clientAuthGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
) => {
  const auth = inject(BusinessAuthService);
  const router = inject(Router);
  if (auth.isClientAuthenticated()) {
    return true;
  }

  const siteSlug = route.paramMap.get('siteSlug');

  return router.createUrlTree(
    siteSlug ? ['/sites', siteSlug, 'client', 'login'] : ['/client/login']
  );
};
