import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { BusinessSiteConfigStore } from '@optimistic-tanuki/business-data-access';
import { map } from 'rxjs';

export const bookingFeatureGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
) => {
  const siteConfig = inject(BusinessSiteConfigStore);
  const router = inject(Router);
  const siteSlug = route.paramMap.get('siteSlug');

  return siteConfig
    .fetch(false, siteSlug)
    .pipe(
      map((site) =>
        site.features.booking.enabled ? true : router.createUrlTree(['/'])
      )
    );
};
