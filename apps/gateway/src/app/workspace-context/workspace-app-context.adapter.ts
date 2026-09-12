import { ForbiddenException } from '@nestjs/common';
import {
  createAuthenticatedWorkspaceAppContext,
  createPlatformAccountIdentity,
  createWorkspaceAppInstance,
  createWorkspaceAppMembership,
  type AuthenticatedWorkspaceAppContext,
  type PlatformAccountIdentity,
  type ResolvedWorkspace,
  type WorkspaceAppMembership,
} from '@optimistic-tanuki/models';

type WorkspaceAppMembershipInput = Pick<
  WorkspaceAppMembership,
  'appInstanceId' | 'membershipId' | 'role' | 'status'
> &
  Partial<Pick<WorkspaceAppMembership, 'workspaceId' | 'appScope' | 'member'>>;

export interface AdaptAuthenticatedWorkspaceAppContextInput {
  /** The compatibility app-scope header supplied with the authenticated request. */
  appScope: string;
  authenticatedUser: PlatformAccountIdentity;
  resolvedWorkspace: ResolvedWorkspace;
  membership: WorkspaceAppMembershipInput;
}

export function adaptAuthenticatedWorkspaceAppContext({
  appScope,
  authenticatedUser,
  resolvedWorkspace,
  membership,
}: AdaptAuthenticatedWorkspaceAppContextInput): AuthenticatedWorkspaceAppContext {
  if (appScope !== resolvedWorkspace.appScope) {
    throw new ForbiddenException(
      'App scope does not match the resolved workspace'
    );
  }

  if (resolvedWorkspace.status !== 'active') {
    throw new ForbiddenException('Resolved workspace is not active');
  }

  if (membership.status !== 'active') {
    throw new ForbiddenException('Workspace app membership is not active');
  }

  if (membership.workspaceId !== resolvedWorkspace.workspaceId) {
    throw new ForbiddenException(
      'Membership does not belong to the resolved workspace'
    );
  }

  if (
    membership.appScope !== resolvedWorkspace.appScope ||
    membership.appScope !== appScope
  ) {
    throw new ForbiddenException(
      'Membership does not belong to the resolved app scope'
    );
  }

  if (
    !membership.member ||
    membership.member.userId !== authenticatedUser.userId ||
    membership.member.profileId !== authenticatedUser.profileId
  ) {
    throw new ForbiddenException(
      'Membership does not belong to the authenticated user'
    );
  }

  const owner = createPlatformAccountIdentity(
    resolvedWorkspace.ownerUserId,
    resolvedWorkspace.ownerProfileId
  );
  if (
    membership.role === 'owner' &&
    (authenticatedUser.userId !== owner.userId ||
      authenticatedUser.profileId !== owner.profileId)
  ) {
    throw new ForbiddenException(
      'owner role must match the resolved workspace owner'
    );
  }

  const instance = createWorkspaceAppInstance({
    appInstanceId: membership.appInstanceId,
    workspaceId: resolvedWorkspace.workspaceId,
    appScope: resolvedWorkspace.appScope,
    owner,
    status: resolvedWorkspace.status,
  });
  const resolvedMembership = createWorkspaceAppMembership(instance, {
    membershipId: membership.membershipId,
    member: authenticatedUser,
    role: membership.role,
    status: membership.status,
  });

  return createAuthenticatedWorkspaceAppContext(instance, resolvedMembership);
}
