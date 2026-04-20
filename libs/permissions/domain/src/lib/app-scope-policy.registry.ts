import {
  AppScopePolicy,
  PolicyAssignmentSpec,
  PolicyPermissionMirrorSpec,
  PolicyPermissionSpec,
  PolicyRoleInitDefaults,
  PolicyRoleSpec,
} from './app-scope-policy';

const emptyDefaults = (): PolicyRoleInitDefaults => ({
  permissions: [],
  roles: [],
  assignments: [],
});

const withAssignments = (
  roleNames: string[],
  profileId?: string,
): PolicyRoleInitDefaults => ({
  permissions: [],
  roles: [],
  assignments: roleNames.map((roleName) => ({ roleName, profileId })),
});

class StaticPolicy implements AppScopePolicy {
  constructor(
    public readonly scopeName: string,
    private readonly build: (profileId?: string) => PolicyRoleInitDefaults,
    private readonly permissionMirrors?: (
      permissions: PolicyPermissionSpec[],
    ) => PolicyPermissionMirrorSpec[],
    private readonly crossScope?: (
      assignment: PolicyAssignmentSpec,
    ) => PolicyAssignmentSpec[],
  ) {}

  buildDefaults(profileId?: string): PolicyRoleInitDefaults {
    return this.build(profileId);
  }

  buildPermissionMirrors?(
    permissions: PolicyPermissionSpec[],
  ): PolicyPermissionMirrorSpec[] {
    return this.permissionMirrors ? this.permissionMirrors(permissions) : [];
  }

  buildCrossScopeMappings?(
    assignment: PolicyAssignmentSpec,
  ): PolicyAssignmentSpec[] {
    return this.crossScope ? this.crossScope(assignment) : [];
  }
}

const clientInterfaceDefaults = (
  profileId?: string,
): PolicyRoleInitDefaults => {
  const permissions: PolicyPermissionSpec[] = [
    {
      name: 'community.create',
      resource: 'community',
      action: 'create',
      description: 'Create community',
      appScope: 'client-interface',
    },
    {
      name: 'community.read',
      resource: 'community',
      action: 'read',
      description: 'Read community',
      appScope: 'client-interface',
    },
    {
      name: 'community.update',
      resource: 'community',
      action: 'update',
      description: 'Update community',
      appScope: 'client-interface',
    },
    {
      name: 'community.delete',
      resource: 'community',
      action: 'delete',
      description: 'Delete community',
      appScope: 'client-interface',
    },
    {
      name: 'community.invite',
      resource: 'community',
      action: 'invite',
      description: 'Invite to community',
      appScope: 'client-interface',
    },
  ];

  const roles: PolicyRoleSpec[] = [
    {
      name: 'community_owner',
      description: 'Community owner with full control over community features',
      permissions: permissions.map((permission) => permission.name),
    },
  ];

  return {
    permissions,
    roles,
    assignments: [
      { roleName: 'client_interface_user', profileId },
      { roleName: 'forum_user', profileId },
      { roleName: 'community_owner', profileId },
    ],
  };
};

const leadsDefaults = (profileId?: string): PolicyRoleInitDefaults => {
  const permissions: PolicyPermissionSpec[] = [
    {
      name: 'lead.read',
      resource: 'lead',
      action: 'read',
      description: 'Read leads and overview metrics',
      appScope: 'leads-app',
    },
    {
      name: 'lead.topic.read',
      resource: 'lead.topic',
      action: 'read',
      description: 'Read lead topics',
      appScope: 'leads-app',
    },
    {
      name: 'lead.onboarding.update',
      resource: 'lead.onboarding',
      action: 'update',
      description: 'Complete and update onboarding for leads workspace',
      appScope: 'leads-app',
    },
  ];

  return {
    permissions,
    roles: [
      {
        name: 'leads_app_member',
        description: 'Standard user for Lead Command',
        permissions: permissions.map((permission) => permission.name),
      },
    ],
    assignments: [{ roleName: 'leads_app_member', profileId }],
  };
};

const financeDefaults = (profileId?: string): PolicyRoleInitDefaults => ({
  permissions: [],
  roles: [
    {
      name: 'finance_member',
      description: 'Finance solo user for own tenant and workspace data',
      permissions: [
        'finance.account.create',
        'finance.account.read',
        'finance.account.update',
        'finance.transaction.create',
        'finance.transaction.read',
        'finance.transaction.update',
        'finance.inventory.read',
        'finance.budget.create',
        'finance.budget.read',
        'finance.budget.update',
        'finance.recurring.create',
        'finance.recurring.read',
        'finance.recurring.update',
        'finance.summary.read',
        'finance.bank.manage',
        'finance.onboarding.manage',
        'finance.tenant.manage',
      ],
    },
  ],
  assignments: [{ roleName: 'finance_member', profileId }],
});

const localHubDefaults = (profileId?: string): PolicyRoleInitDefaults => {
  const permissions: PolicyPermissionSpec[] = [
    {
      name: 'classified.create',
      resource: 'classified',
      action: 'create',
      description: 'Create classified ad',
      appScope: 'local-hub',
    },
    {
      name: 'classified.read',
      resource: 'classified',
      action: 'read',
      description: 'Read classified ad',
      appScope: 'local-hub',
    },
    {
      name: 'classified.update',
      resource: 'classified',
      action: 'update',
      description: 'Update classified ad',
      appScope: 'local-hub',
    },
    {
      name: 'classified.delete',
      resource: 'classified',
      action: 'delete',
      description: 'Delete classified ad',
      appScope: 'local-hub',
    },
  ];

  return {
    permissions,
    roles: [
      {
        name: 'local_hub_member',
        description: 'Local Hub community member',
        permissions: permissions.map((permission) => permission.name),
      },
    ],
    assignments: [{ roleName: 'local_hub_member', profileId }],
  };
};

const socialDefaults = (profileId?: string): PolicyRoleInitDefaults => {
  const permissions: PolicyPermissionSpec[] = [
    {
      name: 'social.post.create',
      resource: 'social',
      action: 'post',
      description: 'Create social post',
      appScope: 'social',
    },
    {
      name: 'social.post.read',
      resource: 'social',
      action: 'post',
      description: 'Read social post',
      appScope: 'social',
    },
    {
      name: 'social.post.update',
      resource: 'social',
      action: 'post',
      description: 'Update social post',
      appScope: 'social',
    },
    {
      name: 'social.post.delete',
      resource: 'social',
      action: 'post',
      description: 'Delete social post',
      appScope: 'social',
    },
    {
      name: 'social.vote.create',
      resource: 'social',
      action: 'vote',
      description: 'Create vote',
      appScope: 'social',
    },
    {
      name: 'social.comment.create',
      resource: 'social',
      action: 'comment',
      description: 'Create comment',
      appScope: 'social',
    },
    {
      name: 'social.follow',
      resource: 'social',
      action: 'follow',
      description: 'Follow/unfollow users',
      appScope: 'social',
    },
  ];

  return {
    permissions,
    roles: [
      {
        name: 'SocialUser',
        description: 'Social user with basic permissions',
        permissions: permissions.map((permission) => permission.name),
      },
    ],
    assignments: [{ roleName: 'social_standard_user', profileId }],
  };
};

export class AppScopePolicyRegistry {
  private readonly fallbackPolicy = new StaticPolicy('default', () =>
    emptyDefaults(),
  );

  private readonly policies = new Map<string, AppScopePolicy>([
    [
      'forgeofwill',
      new StaticPolicy('forgeofwill', (profileId) =>
        withAssignments(
          [
            'forgeofwill_standard_user',
            'forgeofwill_planner',
            'forgeofwill_profile_owner',
          ],
          profileId,
        ),
      ),
    ],
    [
      'digital-homestead',
      new StaticPolicy('digital-homestead', (profileId) =>
        withAssignments(
          ['digital_standard_user', 'digital_follower'],
          profileId,
        ),
      ),
    ],
    [
      'client-interface',
      new StaticPolicy(
        'client-interface',
        clientInterfaceDefaults,
        (permissions) => {
          const communityPermissionNames = permissions
            .filter((permission) => permission.name.startsWith('community.'))
            .map((permission) => permission.name);

          if (!communityPermissionNames.length) {
            return [];
          }

          return [
            {
              targetScope: 'social',
              permissionNames: communityPermissionNames,
            },
          ];
        },
        (assignment) => {
          if (
            assignment.profileId &&
            (assignment.roleName === 'client_interface_user' ||
              assignment.roleName === 'community_owner')
          ) {
            return [{ ...assignment, appScope: 'social' }];
          }
          return [];
        },
      ),
    ],
    ['leads-app', new StaticPolicy('leads-app', leadsDefaults)],
    [
      'christopherrutherford-net',
      new StaticPolicy('christopherrutherford-net', (profileId) =>
        withAssignments(['christopherrutherford_standard_user'], profileId),
      ),
    ],
    ['owner-console', new StaticPolicy('owner-console', () => emptyDefaults())],
    [
      'store',
      new StaticPolicy('store', (profileId) =>
        withAssignments(['store_customer'], profileId),
      ),
    ],
    ['finance', new StaticPolicy('finance', financeDefaults)],
    [
      'global',
      new StaticPolicy('global', (profileId) =>
        withAssignments(['standard_user'], profileId),
      ),
    ],
    ['local-hub', new StaticPolicy('local-hub', localHubDefaults)],
    [
      'video-client',
      new StaticPolicy('video-client', (profileId) =>
        withAssignments(
          ['video_client_member', 'video_channel_creator'],
          profileId,
        ),
      ),
    ],
    ['social', new StaticPolicy('social', socialDefaults)],
    [
      'authentication',
      new StaticPolicy('authentication', () => emptyDefaults()),
    ],
    ['profile', new StaticPolicy('profile', () => emptyDefaults())],
    ['blogging', new StaticPolicy('blogging', () => emptyDefaults())],
    ['assets', new StaticPolicy('assets', () => emptyDefaults())],
    [
      'project-planning',
      new StaticPolicy('project-planning', () => emptyDefaults()),
    ],
  ]);

  get(scopeName: string): AppScopePolicy {
    return this.policies.get(scopeName) ?? this.fallbackPolicy;
  }
}
