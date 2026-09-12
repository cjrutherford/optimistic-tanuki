import {
  assertStableId,
  createAuthenticatedWorkspaceAppContext,
  createPlatformAccountIdentity,
  createWorkspaceAppInstance,
  createWorkspaceAppMembership,
  isAuthenticatedWorkspaceAppContext,
  isPlatformAccountIdentity,
  isWorkspaceAppOwner,
  workspaceAppInstanceUniquenessKey,
  workspaceAppMembershipUniquenessKey,
  type AuthenticatedWorkspaceAppContext,
  type PlatformAccountIdentity,
} from './workspace-app.contract';

describe('canonical workspace-app contract', () => {
  const owner: PlatformAccountIdentity = {
    userId: 'user-owner',
    profileId: 'profile-owner',
  };
  const member: PlatformAccountIdentity = {
    userId: 'user-member',
    profileId: 'profile-member',
  };

  it('models a platform account identity and rejects blank stable IDs', () => {
    expect(createPlatformAccountIdentity('user-1', 'profile-1')).toEqual({
      userId: 'user-1',
      profileId: 'profile-1',
    });
    expect(isPlatformAccountIdentity(owner)).toBe(true);
    expect(isPlatformAccountIdentity({ userId: 'user-1' })).toBe(false);
    expect(assertStableId('workspace-1')).toBe('workspace-1');
    expect(() => assertStableId('  ')).toThrow('stable ID is required');
  });

  it('keys one app instance by workspace ID regardless of app scope', () => {
    const instance = createWorkspaceAppInstance({
      appInstanceId: 'app-instance-1',
      workspaceId: 'workspace-1',
      appScope: 'business-site',
      owner,
      status: 'active',
    });

    expect(instance.workspaceId).toBe('workspace-1');
    expect(instance.appScope).toBe('business-site');
    expect(workspaceAppInstanceUniquenessKey(instance)).toBe('workspace-1');
    expect(
      workspaceAppInstanceUniquenessKey({
        ...instance,
        appScope: 'social',
      })
    ).toBe(workspaceAppInstanceUniquenessKey(instance));
    expect(
      workspaceAppInstanceUniquenessKey({
        ...instance,
        workspaceId: 'workspace-2',
      })
    ).not.toBe(workspaceAppInstanceUniquenessKey(instance));
  });

  it('rejects an app scope that is the workspace ID', () => {
    expect(() =>
      createWorkspaceAppInstance({
        appInstanceId: 'app-instance-1',
        workspaceId: 'workspace-1',
        appScope: 'workspace-1',
        owner,
        status: 'active',
      })
    ).toThrow('appScope must differ from workspaceId');
  });

  it('rejects an invalid app lifecycle status at runtime', () => {
    expect(() =>
      createWorkspaceAppInstance({
        appInstanceId: 'app-instance-1',
        workspaceId: 'workspace-1',
        appScope: 'business-site',
        owner,
        status: 'invalid' as never,
      })
    ).toThrow('app status is invalid');
  });

  it('creates membership scoped to the app instance and supports all contract roles', () => {
    const instance = createWorkspaceAppInstance({
      appInstanceId: 'app-instance-1',
      workspaceId: 'workspace-1',
      appScope: 'business-site',
      owner,
      status: 'active',
    });
    const membership = createWorkspaceAppMembership(instance, {
      membershipId: 'membership-1',
      member,
      role: 'moderator',
      status: 'active',
    });

    expect(membership).toMatchObject({
      workspaceId: 'workspace-1',
      appInstanceId: 'app-instance-1',
      appScope: 'business-site',
      member,
      role: 'moderator',
      status: 'active',
    });
    expect(
      ['owner', 'admin', 'moderator', 'member'].map(
        (role) =>
          createWorkspaceAppMembership(instance, {
            membershipId: `membership-${role}`,
            member: role === 'owner' ? owner : member,
            role: role as 'owner' | 'admin' | 'moderator' | 'member',
            status: 'pending',
          }).role
      )
    ).toEqual(['owner', 'admin', 'moderator', 'member']);
    expect(workspaceAppMembershipUniquenessKey(membership)).toBe(
      'app-instance-1::profile-member'
    );
  });

  it('enforces that only the app instance owner can hold the owner role', () => {
    const instance = createWorkspaceAppInstance({
      appInstanceId: 'app-instance-1',
      workspaceId: 'workspace-1',
      appScope: 'business-site',
      owner,
      status: 'active',
    });
    const ownerMembership = createWorkspaceAppMembership(instance, {
      membershipId: 'membership-owner',
      member: owner,
      role: 'owner',
      status: 'active',
    });

    expect(isWorkspaceAppOwner(ownerMembership, instance)).toBe(true);
    expect(() =>
      createWorkspaceAppMembership(instance, {
        membershipId: 'membership-forged-owner',
        member,
        role: 'owner',
        status: 'active',
      })
    ).toThrow('owner role');
  });

  it('derives the canonical authenticated context without conflating appScope and workspaceId', () => {
    const instance = createWorkspaceAppInstance({
      appInstanceId: 'app-instance-1',
      workspaceId: 'workspace-1',
      appScope: 'business-site',
      owner,
      status: 'active',
    });
    const membership = createWorkspaceAppMembership(instance, {
      membershipId: 'membership-1',
      member,
      role: 'member',
      status: 'active',
    });
    const context: AuthenticatedWorkspaceAppContext =
      createAuthenticatedWorkspaceAppContext(instance, membership);

    expect(context).toEqual({
      user: member,
      workspaceId: 'workspace-1',
      appInstanceId: 'app-instance-1',
      appScope: 'business-site',
      membershipId: 'membership-1',
      role: 'member',
      status: 'active',
    });
    expect(context.workspaceId).not.toBe(context.appScope);
    expect(isAuthenticatedWorkspaceAppContext(context)).toBe(true);
    expect(
      isAuthenticatedWorkspaceAppContext({ ...context, workspaceId: undefined })
    ).toBe(false);
  });

  it('rejects a non-active membership when creating an authenticated context', () => {
    const instance = createWorkspaceAppInstance({
      appInstanceId: 'app-instance-1',
      workspaceId: 'workspace-1',
      appScope: 'business-site',
      owner,
      status: 'active',
    });
    const membership = createWorkspaceAppMembership(instance, {
      membershipId: 'membership-1',
      member,
      role: 'member',
      status: 'pending',
    });

    expect(() =>
      createAuthenticatedWorkspaceAppContext(instance, membership)
    ).toThrow('membership must be active');
  });

  it('rejects an active membership when the app instance is not active', () => {
    const instance = createWorkspaceAppInstance({
      appInstanceId: 'app-instance-1',
      workspaceId: 'workspace-1',
      appScope: 'business-site',
      owner,
      status: 'suspended',
    });
    const membership = createWorkspaceAppMembership(instance, {
      membershipId: 'membership-1',
      member,
      role: 'member',
      status: 'active',
    });

    expect(() =>
      createAuthenticatedWorkspaceAppContext(instance, membership)
    ).toThrow('app instance must be active');
  });

  it('only recognizes authenticated contexts with active membership status', () => {
    const context = {
      user: member,
      workspaceId: 'workspace-1',
      appInstanceId: 'app-instance-1',
      appScope: 'business-site',
      membershipId: 'membership-1',
      role: 'member' as const,
      status: 'pending' as const,
    };

    expect(isAuthenticatedWorkspaceAppContext(context)).toBe(false);
  });

  it('rejects an authenticated context whose app scope equals its workspace ID', () => {
    const context: AuthenticatedWorkspaceAppContext = {
      user: member,
      workspaceId: 'workspace-1',
      appInstanceId: 'app-instance-1',
      appScope: 'workspace-1',
      membershipId: 'membership-1',
      role: 'member',
      status: 'active',
    };

    expect(isAuthenticatedWorkspaceAppContext(context)).toBe(false);
  });
});
