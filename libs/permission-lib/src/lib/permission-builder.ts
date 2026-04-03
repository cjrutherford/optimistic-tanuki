export type PermissionSpec = {
  name: string;
  description?: string;
  resource: string;
  action: string;
  targetId?: string; // maps to CreatePermissionDto.targetId
  appScope?: string; // for uniqueness
};

export type RoleSpec = {
  name: string;
  description?: string;
  permissions?: string[]; // permission names
};

export type AssignmentSpec = {
  roleName: string;
  profileId?: string; // will map to RoleAssignment.profileId
  userId?: string;
};

export interface RoleInitOptions {
  scopeName?: string;
  scopeResourceId?: string;
  permissions?: PermissionSpec[];
  roles?: RoleSpec[];
  assignments?: AssignmentSpec[];
}

/**
 * Common resources that owner permissions should cover.
 * Used by addOwnerPermissions() to grant full CRUD access.
 */
export const OWNER_PERMISSION_RESOURCES = [
  'profile',
  'asset',
  'blog',
  'post',
  'comment',
  'project',
  'task',
  'social',
  'product',
  'order',
  'store',
] as const;

/**
 * Common actions for owner permissions.
 */
export const OWNER_PERMISSION_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'admin',
] as const;

const ALL_OWNER_ROLES: { [key: string]: string[] } = {
  global: ['owner', 'forum_moderator'],
  'digital-homestead': ['digital_homesteader', 'forum_moderator'],
  'client-interface': [
    'client_profile_owner',
    'client_asset_manager',
    'forum_moderator',
  ],
  forgeofwill: ['forgeofwill_planner', 'forum_moderator'],
  'leads-app': ['leads_app_admin'],
  blogging: ['blog_author'],
  assets: ['asset_owner'],
  social: ['social_user'],
  'christopherrutherford-net': [
    'christopherrutherford_owner_user',
    'forum_moderator',
  ],
  'owner-console': ['owner_console_owner', 'forum_moderator'],
  store: ['store_manager'],
};

const ALL_USER_ROLES: { [key: string]: string[] } = {
  'digital-homestead': ['digital_standard_user'],
  'client-interface': ['client_interface_user'],
  forgeofwill: ['forgeofwill_standard_user'],
  'leads-app': ['leads_app_member'],
  blogging: ['blog_reader'],
  assets: ['asset_viewer'],
  social: ['social_user'],
  'christopherrutherford-net': ['christopherrutherford_standard_user'],
  store: ['store_customer'],
  'local-hub': ['local_hub_member'],
};

export class RoleInitBuilder {
  private opts: RoleInitOptions = {
    permissions: [],
    roles: [],
    assignments: [],
  };

  private userId?: string;
  private profile?: string;

  setScopeName(name: string) {
    this.opts.scopeName = name;
    return this;
  }
  setScopeResourceId(id: string) {
    this.opts.scopeResourceId = id;
    return this;
  }

  setUserId(userId: string) {
    this.userId = userId;
    return this;
  }

  setProfile(profileId: string) {
    this.profile = profileId;
    return this;
  }

  addPermission(
    name: string,
    resource: string,
    action: string,
    description = '',
    targetId?: string,
    appScope?: string
  ) {
    this.opts.permissions?.push({
      name,
      resource,
      action,
      description,
      targetId,
      appScope: appScope || this.opts.scopeName,
    });
    return this;
  }

  addAssetOwnerPermissions() {
    this.addPermission(
      'asset.create',
      'asset',
      'create',
      'Create asset for profile'
    );
    this.addPermission(
      'asset.read',
      'asset',
      'read',
      'Read asset owned by user'
    );
    this.addPermission(
      'asset.update',
      'asset',
      'update',
      'Update asset owned by user'
    );
    this.addPermission(
      'asset.delete',
      'asset',
      'delete',
      'Delete asset owned by user'
    );
    // Create an AssetUser role and assign it so the permissions are linked
    this.addRole('AssetUser', 'User with asset upload permissions', [
      'asset.create',
      'asset.read',
      'asset.update',
      'asset.delete',
    ]);
    this.assignRoleToProfile('AssetUser');
    return this;
  }

  /**
   * Adds owner-level permissions for an app scope.
   * Used when registering via owner-console to grant full control.
   */
  // addOwnerPermissions() {
  //   const appScope = this.opts.scopeName;

  //   // Add full CRUD permissions for all common resources
  //   for (const resource of OWNER_PERMISSION_RESOURCES) {
  //     for (const action of OWNER_PERMISSION_ACTIONS) {
  //       this.addPermission(
  //         `${resource}.${action}`,
  //         resource,
  //         action,
  //         `${action} ${resource} (owner permission)`,
  //         undefined,
  //         appScope
  //       );
  //     }
  //   }

  //   return this;
  // }

  /**
   * Assigns the owner role for the current app scope only.
   * Owner role grants full control over all resources in the scope.
   */
  assignOwnerRole() {
    const scopeName = this.opts.scopeName || 'global';
    const roleNames = ALL_OWNER_ROLES[scopeName];
    if (roleNames) {
      for (const roleName of roleNames) {
        this.assignRoleToProfile(roleName);
      }
    }
    return this;
  }

  addRole(name: string, description?: string, permissionNames: string[] = []) {
    (this.opts.roles ?? []).push({
      name,
      description,
      permissions: permissionNames,
    });
    return this;
  }

  assignRoleToProfile(roleName: string) {
    (this.opts.assignments ?? []).push({ roleName, profileId: this.profile });
    return this;
  }

  assignRoleToUser(roleName: string) {
    (this.opts.assignments ?? []).push({ roleName, userId: this.userId });
    return this;
  }

  addAppScopeDefaults() {
    switch (this.opts.scopeName) {
      // Angular Applications - assign standard user roles
      case 'forgeofwill':
        this.assignRoleToProfile('forgeofwill_standard_user');
        this.assignRoleToProfile('forgeofwill_planner');
        this.assignRoleToProfile('forgeofwill_profile_owner');
        return this;
      case 'digital-homestead':
        this.assignRoleToProfile('digital_standard_user');
        this.assignRoleToProfile('digital_follower');
        return this;
      case 'client-interface':
        this.addPermission(
          'community.create',
          'community',
          'create',
          'Create community',
          undefined,
          'client-interface'
        );
        this.addPermission(
          'community.read',
          'community',
          'read',
          'Read community',
          undefined,
          'client-interface'
        );
        this.addPermission(
          'community.update',
          'community',
          'update',
          'Update community',
          undefined,
          'client-interface'
        );
        this.addPermission(
          'community.delete',
          'community',
          'delete',
          'Delete community',
          undefined,
          'client-interface'
        );
        this.addPermission(
          'community.invite',
          'community',
          'invite',
          'Invite to community',
          undefined,
          'client-interface'
        );
        this.addRole(
          'community_owner',
          'Community owner with full control over community features',
          [
            'community.create',
            'community.read',
            'community.update',
            'community.delete',
            'community.invite',
          ]
        );
        this.assignRoleToProfile('client_interface_user');
        this.assignRoleToProfile('forum_user');
        this.assignRoleToProfile('community_owner');
        return this;
      case 'leads-app':
        this.addPermission(
          'lead.read',
          'lead',
          'read',
          'Read leads and overview metrics',
          undefined,
          'leads-app'
        );
        this.addPermission(
          'lead.topic.read',
          'lead.topic',
          'read',
          'Read lead topics',
          undefined,
          'leads-app'
        );
        this.addPermission(
          'lead.onboarding.update',
          'lead.onboarding',
          'update',
          'Complete and update onboarding for leads workspace',
          undefined,
          'leads-app'
        );
        this.addRole('leads_app_member', 'Standard user for Lead Command', [
          'lead.read',
          'lead.topic.read',
          'lead.onboarding.update',
        ]);
        this.assignRoleToProfile('leads_app_member');
        return this;
      case 'christopherrutherford-net':
        this.assignRoleToProfile('christopherrutherford_standard_user');
        return this;
      case 'owner-console':
        this.addOwnerScopeDefaults();
        return this;
      case 'store':
        this.assignRoleToProfile('store_customer');
        return this;
      case 'global':
        this.assignRoleToProfile('standard_user');
        return this;
      case 'local-hub':
        // Add classifieds permissions and assign local_hub_member role
        this.addPermission(
          'classified.create',
          'classified',
          'create',
          'Create classified ad',
          undefined,
          'local-hub'
        );
        this.addPermission(
          'classified.read',
          'classified',
          'read',
          'Read classified ad',
          undefined,
          'local-hub'
        );
        this.addPermission(
          'classified.update',
          'classified',
          'update',
          'Update classified ad',
          undefined,
          'local-hub'
        );
        this.addPermission(
          'classified.delete',
          'classified',
          'delete',
          'Delete classified ad',
          undefined,
          'local-hub'
        );
        this.addRole('local_hub_member', 'Local Hub community member', [
          'classified.create',
          'classified.read',
          'classified.update',
          'classified.delete',
        ]);
        this.assignRoleToProfile('local_hub_member');
        return this;
      case 'social':
        // Add social permissions and assign social_user role
        this.addPermission(
          'social.post.create',
          'social',
          'post',
          'Create social post',
          undefined,
          'social'
        );
        this.addPermission(
          'social.post.read',
          'social',
          'post',
          'Read social post',
          undefined,
          'social'
        );
        this.addPermission(
          'social.post.update',
          'social',
          'post',
          'Update social post',
          undefined,
          'social'
        );
        this.addPermission(
          'social.post.delete',
          'social',
          'post',
          'Delete social post',
          undefined,
          'social'
        );
        this.addPermission(
          'social.vote.create',
          'social',
          'vote',
          'Create vote',
          undefined,
          'social'
        );
        this.addPermission(
          'social.comment.create',
          'social',
          'comment',
          'Create comment',
          undefined,
          'social'
        );
        this.addPermission(
          'social.follow',
          'social',
          'follow',
          'Follow/unfollow users',
          undefined,
          'social'
        );
        this.addRole('SocialUser', 'Social user with basic permissions', [
          'social.post.create',
          'social.post.read',
          'social.post.update',
          'social.post.delete',
          'social.vote.create',
          'social.comment.create',
          'social.follow',
        ]);
        this.assignRoleToProfile('social_standard_user');
        return this;
      // Backend Services - no default role assignment needed
      case 'authentication':
      case 'profile':
      case 'blogging':
      case 'social':
      case 'assets':
      case 'project-planning':
        // Backend services don't assign default roles
        return this;
      default:
        // Fallback for unknown scopes
        return this;
    }
  }

  /**
   * Adds owner-level defaults for an app scope when registering via owner-console.
   * This grants full control permissions instead of standard user roles.
   */
  addOwnerScopeDefaults() {
    // this.addOwnerPermissions();
    this.assignOwnerRole();
    return this;
  }

  addDefaultProfileOwner(profileId: string, appScope?: string) {
    this.setScopeResourceId(profileId);
    this.addPermission(
      'profile.read',
      'profile',
      'read',
      'Read profile',
      profileId,
      appScope
    );
    this.addPermission(
      'profile.update',
      'profile',
      'update',
      'Update profile',
      profileId,
      appScope
    );
    this.addRole('ProfileOwner', 'Owner of profile', [
      'profile.read',
      'profile.update',
    ]);
    this.assignRoleToProfile('ProfileOwner');
    return this;
  }

  build(): RoleInitOptions {
    return JSON.parse(JSON.stringify(this.opts));
  }
}
