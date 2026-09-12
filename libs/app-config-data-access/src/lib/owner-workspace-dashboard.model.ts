import type {
  AppConfigReleaseRevision,
  AppConfigReleaseStatus,
  AppConfiguration,
} from '@optimistic-tanuki/app-config-models';

export type OwnerDashboardMembershipRole =
  | 'owner'
  | 'admin'
  | 'moderator'
  | 'member';

export type OwnerWorkspaceDashboardState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'unavailable'
  | 'error';
export type OwnerDashboardReleaseStatus =
  | 'draft'
  | 'published'
  | 'pending'
  | 'rolled-back';

/**
 * `draft` is the existing app-config contract for saved, unpublished changes.
 * It is intentionally not a new backend release status.
 */

export interface OwnerWorkspaceDashboard {
  workspace: { id: string; slug: string; name: string; status: string };
  app: { id: string; name: string; scope: string };
  membership: {
    role: OwnerDashboardMembershipRole;
    status: string;
    canEdit: boolean;
    canPublish: boolean;
  };
  configuration: {
    id: string;
    revision: number;
    active: boolean;
    releaseStatus: OwnerDashboardReleaseStatus;
    publishedVersion?: number | null;
    releaseHistory?: ReadonlyArray<
      Pick<
        AppConfigReleaseRevision,
        'version' | 'action' | 'releaseNotes' | 'changeSummary' | 'releasedAt'
      >
    >;
    updatedAt?: Date;
  };
  links: { preview: string; edit: string };
}

export function dashboardReleaseStatus(
  configuration: AppConfiguration
): OwnerDashboardReleaseStatus {
  const status: AppConfigReleaseStatus | undefined =
    configuration.release?.status;
  const history = configuration.release?.history ?? [];
  if (history[history.length - 1]?.action === 'rollback') return 'rolled-back';
  if (status === 'published') return 'published';
  if (status === 'changes-pending') return 'pending';
  return 'draft';
}

export function canEditWorkspace(role: OwnerDashboardMembershipRole): boolean {
  // P7 owner actions are deliberately narrower than general workspace administration.
  return role === 'owner';
}

export function canPublishWorkspace(
  role: OwnerDashboardMembershipRole
): boolean {
  // Publishing is an owner-only release operation; admins and members remain read-only.
  return role === 'owner';
}
