import type {
  AppConfigReleaseState,
  AppConfiguration,
} from '@optimistic-tanuki/app-config-models';

export interface ScopedAppConfiguration extends AppConfiguration {
  workspaceId: string;
  appInstanceId: string;
  appScope: string;
  revision: number;
  release: AppConfigReleaseState;
}

export function isScopedAppConfiguration(
  value: unknown
): value is ScopedAppConfiguration {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScopedAppConfiguration>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.trim().length > 0 &&
    typeof candidate.workspaceId === 'string' &&
    candidate.workspaceId.trim().length > 0 &&
    typeof candidate.appInstanceId === 'string' &&
    candidate.appInstanceId.trim().length > 0 &&
    typeof candidate.appScope === 'string' &&
    candidate.appScope.trim().length > 0 &&
    typeof candidate.revision === 'number' &&
    Number.isFinite(candidate.revision) &&
    isValidRelease(candidate.release)
  );
}

function isValidRelease(value: unknown): value is AppConfigReleaseState {
  if (!value || typeof value !== 'object') return false;
  const release = value as Partial<AppConfigReleaseState>;
  return (
    (release.status === 'draft' ||
      release.status === 'published' ||
      release.status === 'changes-pending') &&
    Array.isArray(release.history)
  );
}
