import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { BusinessSiteConfigStore } from '@optimistic-tanuki/business-data-access';
import { map } from 'rxjs';

export const clientTasksFeatureGuard: CanActivateFn = () => {
  const siteConfig = inject(BusinessSiteConfigStore);
  const router = inject(Router);

  return siteConfig
    .fetch()
    .pipe(
      map((site) =>
        site.features.clientTasks.enabled
          ? true
          : router.createUrlTree(['/client/dashboard'])
      )
    );
};
