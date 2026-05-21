import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { BusinessSiteConfigStore } from '@optimistic-tanuki/business-data-access';
import { map } from 'rxjs';

export const invoicesFeatureGuard: CanActivateFn = () => {
  const siteConfig = inject(BusinessSiteConfigStore);
  const router = inject(Router);

  return siteConfig
    .fetch()
    .pipe(
      map((site) =>
        site.features.invoices.enabled
          ? true
          : router.createUrlTree(['/client/dashboard'])
      )
    );
};
