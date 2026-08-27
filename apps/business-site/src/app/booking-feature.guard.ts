import { createFeatureGuard } from './feature-guard.factory';

export const bookingFeatureGuard = createFeatureGuard({
  isFeatureEnabled: (site) => site.features.booking.enabled,
  redirectTo: ['/'],
  useRouteSlug: true,
});
