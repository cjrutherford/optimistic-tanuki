import { createFeatureGuard } from './feature-guard.factory';

export const clientTasksFeatureGuard = createFeatureGuard({
  isFeatureEnabled: (site) => site.features.clientTasks.enabled,
  redirectTo: ['/client/dashboard'],
});
