import {
  MEMBERSHIP_LIFECYCLE_STATES,
  type MembershipLifecycleState,
} from './membership-lifecycle';

/** Stable identifiers are opaque strings; their meaning comes from their field. */
export type StableId = string;
export type WorkspaceId = StableId;
export type WorkspaceAppInstanceId = StableId;
export type WorkspaceAppMembershipId = StableId;

export const WORKSPACE_APP_MEMBERSHIP_ROLES = [
  'owner',
  'admin',
  'moderator',
  'member',
] as const;
export type WorkspaceAppMembershipRole =
  (typeof WORKSPACE_APP_MEMBERSHIP_ROLES)[number];

/** App membership status intentionally reuses the existing lifecycle vocabulary. */
export const WORKSPACE_APP_LIFECYCLE_STATES = MEMBERSHIP_LIFECYCLE_STATES;
export const WORKSPACE_APP_MEMBERSHIP_STATUSES = MEMBERSHIP_LIFECYCLE_STATES;
export const WORKSPACE_APP_STATUSES = WORKSPACE_APP_MEMBERSHIP_STATUSES;
export type WorkspaceAppLifecycleState = MembershipLifecycleState;
export type WorkspaceAppMembershipStatus = MembershipLifecycleState;

/** Persistence must enforce one app instance for each workspace. */
export const WORKSPACE_APP_INSTANCE_UNIQUE_BY = ['workspaceId'] as const;
/** A profile can have at most one membership in a given app instance. */
export const WORKSPACE_APP_MEMBERSHIP_UNIQUE_BY = [
  'appInstanceId',
  'profileId',
] as const;

export interface PlatformAccountIdentity {
  userId: StableId;
  profileId: StableId;
}

export interface WorkspaceAppInstance {
  appInstanceId: WorkspaceAppInstanceId;
  workspaceId: WorkspaceId;
  /** Permission/product scope; this is deliberately not a workspace ID. */
  appScope: string;
  owner: PlatformAccountIdentity;
  status: WorkspaceAppLifecycleState;
}

export interface WorkspaceAppMembership {
  membershipId: WorkspaceAppMembershipId;
  workspaceId: WorkspaceId;
  appInstanceId: WorkspaceAppInstanceId;
  /** Copied from the app instance for app-scoped authorization and transport. */
  appScope: string;
  member: PlatformAccountIdentity;
  role: WorkspaceAppMembershipRole;
  status: WorkspaceAppMembershipStatus;
}

export interface AuthenticatedWorkspaceAppContext {
  user: PlatformAccountIdentity;
  workspaceId: WorkspaceId;
  appInstanceId: WorkspaceAppInstanceId;
  appScope: string;
  membershipId: WorkspaceAppMembershipId;
  role: WorkspaceAppMembershipRole;
  status: WorkspaceAppMembershipStatus;
}

export interface CreateWorkspaceAppInstanceInput
  extends Omit<WorkspaceAppInstance, 'appInstanceId'> {
  appInstanceId: WorkspaceAppInstanceId;
}

export interface CreateWorkspaceAppMembershipInput {
  membershipId: WorkspaceAppMembershipId;
  member: PlatformAccountIdentity;
  role: WorkspaceAppMembershipRole;
  status: WorkspaceAppMembershipStatus;
}

export function isStableId(value: unknown): value is StableId {
  return (
    typeof value === 'string' && value.length > 0 && value.trim() === value
  );
}

export function assertStableId(value: unknown, label = 'stable ID'): StableId {
  if (!isStableId(value)) {
    throw new Error(`${label} is required`);
  }
  return value;
}

export function isPlatformAccountIdentity(
  value: unknown
): value is PlatformAccountIdentity {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const identity = value as Partial<PlatformAccountIdentity>;
  return isStableId(identity.userId) && isStableId(identity.profileId);
}

export function createPlatformAccountIdentity(
  userId: string,
  profileId: string
): PlatformAccountIdentity {
  return {
    userId: assertStableId(userId, 'userId'),
    profileId: assertStableId(profileId, 'profileId'),
  };
}

export function isWorkspaceAppMembershipRole(
  value: unknown
): value is WorkspaceAppMembershipRole {
  return (
    typeof value === 'string' &&
    (WORKSPACE_APP_MEMBERSHIP_ROLES as readonly string[]).includes(value)
  );
}

export function isWorkspaceAppLifecycleState(
  value: unknown
): value is WorkspaceAppLifecycleState {
  return (
    typeof value === 'string' &&
    (WORKSPACE_APP_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export function createWorkspaceAppInstance(
  input: CreateWorkspaceAppInstanceInput
): WorkspaceAppInstance {
  const workspaceId = assertStableId(input.workspaceId, 'workspaceId');
  const appScope = assertStableId(input.appScope, 'appScope');
  if (appScope === workspaceId) {
    throw new Error('appScope must differ from workspaceId');
  }
  if (!isWorkspaceAppLifecycleState(input.status)) {
    throw new Error('app status is invalid');
  }

  return {
    appInstanceId: assertStableId(input.appInstanceId, 'appInstanceId'),
    workspaceId,
    appScope,
    owner: createPlatformAccountIdentity(
      input.owner.userId,
      input.owner.profileId
    ),
    status: input.status,
  };
}

export function workspaceAppInstanceUniquenessKey(
  instance: Pick<WorkspaceAppInstance, 'workspaceId' | 'appScope'>
): string {
  return assertStableId(instance.workspaceId, 'workspaceId');
}

export function createWorkspaceAppMembership(
  instance: WorkspaceAppInstance,
  input: CreateWorkspaceAppMembershipInput
): WorkspaceAppMembership {
  assertStableId(instance.appInstanceId, 'appInstanceId');
  assertStableId(instance.workspaceId, 'workspaceId');
  assertStableId(instance.appScope, 'appScope');
  assertStableId(input.membershipId, 'membershipId');
  if (!isPlatformAccountIdentity(input.member)) {
    throw new Error('member identity requires userId and profileId');
  }
  if (!isWorkspaceAppMembershipRole(input.role)) {
    throw new Error('membership role is invalid');
  }
  if (!isWorkspaceAppLifecycleState(input.status)) {
    throw new Error('membership status is invalid');
  }
  if (input.role === 'owner' && !sameIdentity(input.member, instance.owner)) {
    throw new Error('owner role must match the app instance owner');
  }

  return {
    membershipId: input.membershipId,
    workspaceId: instance.workspaceId,
    appInstanceId: instance.appInstanceId,
    appScope: instance.appScope,
    member: input.member,
    role: input.role,
    status: input.status,
  };
}

export function workspaceAppMembershipUniquenessKey(
  membership: Pick<WorkspaceAppMembership, 'appInstanceId' | 'member'>
): string {
  return `${assertStableId(
    membership.appInstanceId,
    'appInstanceId'
  )}::${assertStableId(membership.member.profileId, 'profileId')}`;
}

export function isWorkspaceAppOwner(
  membership: Pick<WorkspaceAppMembership, 'role' | 'member'>,
  instance: Pick<WorkspaceAppInstance, 'owner'>
): boolean {
  return (
    membership.role === 'owner' &&
    sameIdentity(membership.member, instance.owner)
  );
}

export function createAuthenticatedWorkspaceAppContext(
  instance: WorkspaceAppInstance,
  membership: WorkspaceAppMembership
): AuthenticatedWorkspaceAppContext {
  if (instance.status !== 'active') {
    throw new Error('app instance must be active');
  }
  if (membership.status !== 'active') {
    throw new Error('membership must be active');
  }
  if (
    membership.workspaceId !== instance.workspaceId ||
    membership.appInstanceId !== instance.appInstanceId ||
    membership.appScope !== instance.appScope
  ) {
    throw new Error('membership does not belong to the app instance');
  }

  return {
    user: membership.member,
    workspaceId: instance.workspaceId,
    appInstanceId: instance.appInstanceId,
    appScope: instance.appScope,
    membershipId: membership.membershipId,
    role: membership.role,
    status: membership.status,
  };
}

export function isAuthenticatedWorkspaceAppContext(
  value: unknown
): value is AuthenticatedWorkspaceAppContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const context = value as Partial<AuthenticatedWorkspaceAppContext>;
  return (
    isPlatformAccountIdentity(context.user) &&
    isStableId(context.workspaceId) &&
    isStableId(context.appInstanceId) &&
    isStableId(context.appScope) &&
    context.appScope !== context.workspaceId &&
    isStableId(context.membershipId) &&
    isWorkspaceAppMembershipRole(context.role) &&
    context.status === 'active'
  );
}

function sameIdentity(
  left: PlatformAccountIdentity,
  right: PlatformAccountIdentity
): boolean {
  return left.userId === right.userId && left.profileId === right.profileId;
}
