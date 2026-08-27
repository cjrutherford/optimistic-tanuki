import { createFeatureGuard } from './feature-guard.factory';

export const clientPortalFeatureGuard = createFeatureGuard({
  isFeatureEnabled: (site) => site.features.clientPortal.enabled,
  redirectTo: ['/'],
});
