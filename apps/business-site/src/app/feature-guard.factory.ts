import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import {
  BusinessSiteConfig,
  BusinessSiteConfigStore,
} from '@optimistic-tanuki/business-data-access';
import { map } from 'rxjs';

export interface FeatureGuardOptions {
  /** Selects the feature flag to check off the resolved site config. */
  isFeatureEnabled: (site: BusinessSiteConfig) => boolean;
  /** Router commands used to build the redirect UrlTree when the feature is disabled. */
  redirectTo: string[];
  /**
   * When true, reads the `siteSlug` route param and forwards it to
   * `BusinessSiteConfigStore.fetch(false, siteSlug)` so hosted (slug-scoped)
   * routes resolve the correct tenant's config.
   */
  useRouteSlug?: boolean;
}

/**
 * Builds a `CanActivateFn` that gates a route on a `BusinessSiteConfig`
 * feature flag, redirecting to `redirectTo` when the feature is disabled.
 */
export function createFeatureGuard({
  isFeatureEnabled,
  redirectTo,
  useRouteSlug = false,
}: FeatureGuardOptions): CanActivateFn {
  return (route: ActivatedRouteSnapshot) => {
    const siteConfig = inject(BusinessSiteConfigStore);
    const router = inject(Router);
    const siteSlug = useRouteSlug ? route.paramMap.get('siteSlug') : undefined;

    return siteConfig
      .fetch(false, siteSlug)
      .pipe(
        map((site) =>
          isFeatureEnabled(site) ? true : router.createUrlTree(redirectTo)
        )
      );
  };
}
