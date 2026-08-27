import { createFeatureGuard } from './feature-guard.factory';

export const invoicesFeatureGuard = createFeatureGuard({
  isFeatureEnabled: (site) => site.features.invoices.enabled,
  redirectTo: ['/client/dashboard'],
});
