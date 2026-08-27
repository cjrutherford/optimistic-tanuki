import { createFeatureGuard } from './feature-guard.factory';

// Gates the owner-side `/owner/finance` route. Shares the `invoices`
// feature flag with the client-side `/client/billing` route (see
// invoices-feature.guard.ts) — invoicing is one feature with an owner
// management side and a client-facing side, not two separate flags.
export const ownerFinanceFeatureGuard = createFeatureGuard({
  isFeatureEnabled: (site) => site.features.invoices.enabled,
  redirectTo: ['/owner/dashboard'],
});
