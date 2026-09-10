import { createFeatureGuard } from './feature-guard.factory';

export const invoicesFeatureGuard = createFeatureGuard({
  isFeatureEnabled: (site) => site.features.invoices.enabled,
  redirectTo: (route) => {
    const siteSlug =
      route.paramMap?.get('siteSlug') ?? route.parent?.paramMap.get('siteSlug');
    return siteSlug
      ? ['/sites', siteSlug, 'client', 'dashboard']
      : ['/client/dashboard'];
  },
  useRouteSlug: true,
});
