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
        this.assignRoleToProfile('client_interface_user');
        return this;
      case 'christopherrutherford-net':
        this.assignRoleToProfile('christopherrutherford_standard_user');
        return this;
      case 'owner-console':
        this.assignRoleToProfile('owner_console_owner');
        return this;
      case 'global':
        this.assignRoleToProfile('standard_user');
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

  addDefaultProfileOwner(profileId: string, appScope?: string) {
    this.setScopeName('profile').setScopeResourceId(profileId);
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
    return this;
  }

  build(): RoleInitOptions {
    return JSON.parse(JSON.stringify(this.opts));
  }
}
// ...existing code...
