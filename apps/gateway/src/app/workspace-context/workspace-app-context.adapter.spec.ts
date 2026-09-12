import { ForbiddenException } from '@nestjs/common';
import type {
  PlatformAccountIdentity,
  ResolvedWorkspace,
  WorkspaceAppMembership,
} from '@optimistic-tanuki/models';
import { adaptAuthenticatedWorkspaceAppContext } from './workspace-app-context.adapter';

describe('adaptAuthenticatedWorkspaceAppContext', () => {
  const authenticatedUser: PlatformAccountIdentity = {
    userId: 'member-user-1',
    profileId: 'member-profile-1',
  };
  const resolvedWorkspace: ResolvedWorkspace = {
    workspaceId: '123e4567-e89b-12d3-a456-426614174000',
    kind: 'business-site',
    slug: 'north-star-coaching',
    displayName: 'North Star Coaching',
    appScope: 'business-site',
    ownerUserId: 'owner-user-1',
    ownerProfileId: 'owner-profile-1',
    status: 'active',
    source: { service: 'store', sourceId: 'site-config-1' },
  };
  const membership: Pick<
    WorkspaceAppMembership,
    | 'appInstanceId'
    | 'membershipId'
    | 'workspaceId'
    | 'appScope'
    | 'member'
    | 'role'
    | 'status'
  > = {
    appInstanceId: 'business-site-app-1',
    membershipId: 'membership-1',
    workspaceId: resolvedWorkspace.workspaceId,
    appScope: resolvedWorkspace.appScope,
    member: authenticatedUser,
    role: 'moderator',
    status: 'active',
  };

  it('derives the canonical context from authenticated identity and resolved membership', () => {
    const context = adaptAuthenticatedWorkspaceAppContext({
      appScope: 'business-site',
      authenticatedUser,
      resolvedWorkspace,
      membership,
    });

    expect(context).toEqual({
      user: authenticatedUser,
      workspaceId: resolvedWorkspace.workspaceId,
      appInstanceId: membership.appInstanceId,
      appScope: 'business-site',
      membershipId: membership.membershipId,
      role: 'moderator',
      status: 'active',
    });
    expect(context.workspaceId).not.toBe(context.appScope);
  });

  it('keeps the legacy app-scope header as the compatibility check while using resolved app scope', () => {
    expect(() =>
      adaptAuthenticatedWorkspaceAppContext({
        appScope: 'workspace:123e4567-e89b-12d3-a456-426614174000',
        authenticatedUser,
        resolvedWorkspace,
        membership,
      })
    ).toThrow(ForbiddenException);
  });

  it('rejects a membership without its authoritative member identity', () => {
    const { member: _member, ...membershipWithoutMember } = membership;

    expect(() =>
      adaptAuthenticatedWorkspaceAppContext({
        appScope: resolvedWorkspace.appScope,
        authenticatedUser,
        resolvedWorkspace,
        membership: membershipWithoutMember,
      })
    ).toThrow(ForbiddenException);
  });

  it.each(['workspaceId', 'appScope'] as const)(
    'rejects a membership without its %s association',
    (associationField) => {
      const membershipWithoutAssociation = {
        ...membership,
        [associationField]: undefined,
      };

      expect(() =>
        adaptAuthenticatedWorkspaceAppContext({
          appScope: resolvedWorkspace.appScope,
          authenticatedUser,
          resolvedWorkspace,
          membership: membershipWithoutAssociation,
        })
      ).toThrow(ForbiddenException);
    }
  );

  it('rejects a membership whose authoritative identity does not match the authenticated user and profile', () => {
    expect(() =>
      adaptAuthenticatedWorkspaceAppContext({
        appScope: resolvedWorkspace.appScope,
        authenticatedUser,
        resolvedWorkspace,
        membership: {
          ...membership,
          member: {
            userId: authenticatedUser.userId,
            profileId: 'different-profile',
          },
        },
      })
    ).toThrow(ForbiddenException);
  });

  it.each(['userId', 'profileId'] as const)(
    'rejects a membership whose %s does not exactly match the authenticated identity',
    (identityField) => {
      const membershipWithMismatchedIdentity = {
        ...membership,
        member: {
          ...authenticatedUser,
          [identityField]: `different-${identityField}`,
        },
      };

      expect(() =>
        adaptAuthenticatedWorkspaceAppContext({
          appScope: resolvedWorkspace.appScope,
          authenticatedUser,
          resolvedWorkspace,
          membership: membershipWithMismatchedIdentity,
        })
      ).toThrow(ForbiddenException);
    }
  );

  it.each(['workspaceId', 'appScope'] as const)(
    'rejects a membership whose %s does not exactly match the resolved workspace',
    (associationField) => {
      const membershipWithMismatchedAssociation = {
        ...membership,
        [associationField]: `different-${associationField}`,
      };

      expect(() =>
        adaptAuthenticatedWorkspaceAppContext({
          appScope: resolvedWorkspace.appScope,
          authenticatedUser,
          resolvedWorkspace,
          membership: membershipWithMismatchedAssociation,
        })
      ).toThrow(ForbiddenException);
    }
  );

  it('rejects an owner membership when authenticated identity is not the resolved owner', () => {
    expect(() =>
      adaptAuthenticatedWorkspaceAppContext({
        appScope: resolvedWorkspace.appScope,
        authenticatedUser,
        resolvedWorkspace,
        membership: { ...membership, role: 'owner' },
      })
    ).toThrow('owner role');
  });

  it('does not use request-supplied owner IDs to derive the authenticated context', () => {
    const context = adaptAuthenticatedWorkspaceAppContext({
      appScope: resolvedWorkspace.appScope,
      authenticatedUser,
      resolvedWorkspace: {
        ...resolvedWorkspace,
        ownerUserId: 'attacker-user-from-request-body',
        ownerProfileId: 'attacker-profile-from-request-body',
      },
      membership: { ...membership, role: 'member' },
    });

    expect(context.user).toEqual(authenticatedUser);
    expect(context.role).toBe('member');
  });
});
