import { AppScopePolicyRegistry } from '@optimistic-tanuki/permissions-domain';

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
  appScope?: string;
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
  finance: ['finance_member'],
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
  'video-client': ['video_client_member'],
  finance: ['finance_member'],
};

export class RoleInitBuilder {
  private static readonly policyRegistry = new AppScopePolicyRegistry();

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
    appScope?: string,
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
      'Create asset for profile',
    );
    this.addPermission(
      'asset.read',
      'asset',
      'read',
      'Read asset owned by user',
    );
    this.addPermission(
      'asset.update',
      'asset',
      'update',
      'Update asset owned by user',
    );
    this.addPermission(
      'asset.delete',
      'asset',
      'delete',
      'Delete asset owned by user',
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
    const scopeName = this.opts.scopeName ?? 'global';

    if (scopeName === 'owner-console') {
      return this.addOwnerScopeDefaults();
    }

    const defaults = RoleInitBuilder.policyRegistry
      .get(scopeName)
      .buildDefaults(this.profile);

    for (const permission of defaults.permissions) {
      this.addPermission(
        permission.name,
        permission.resource,
        permission.action,
        permission.description || '',
        permission.targetId,
        permission.appScope,
      );
    }

    for (const role of defaults.roles) {
      this.addRole(role.name, role.description, role.permissions || []);
    }

    for (const assignment of defaults.assignments) {
      (this.opts.assignments ?? []).push({ ...assignment });
    }

    return this;
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
      appScope,
    );
    this.addPermission(
      'profile.update',
      'profile',
      'update',
      'Update profile',
      profileId,
      appScope,
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
