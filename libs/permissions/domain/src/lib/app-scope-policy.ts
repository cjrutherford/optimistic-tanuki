export type PolicyPermissionSpec = {
  name: string;
  description?: string;
  resource: string;
  action: string;
  targetId?: string;
  appScope?: string;
};

export type PolicyRoleSpec = {
  name: string;
  description?: string;
  permissions?: string[];
};

export type PolicyAssignmentSpec = {
  roleName: string;
  profileId?: string;
  userId?: string;
  appScope?: string;
};

export type PolicyRoleInitDefaults = {
  permissions: PolicyPermissionSpec[];
  roles: PolicyRoleSpec[];
  assignments: PolicyAssignmentSpec[];
};

export type PolicyPermissionMirrorSpec = {
  targetScope: string;
  permissionNames: string[];
};

export interface AppScopePolicy {
  scopeName: string;
  buildDefaults(profileId?: string): PolicyRoleInitDefaults;
  buildOwnerDefaults?(profileId?: string): PolicyRoleInitDefaults;
  buildPermissionMirrors?(
    permissions: PolicyPermissionSpec[],
  ): PolicyPermissionMirrorSpec[];
  buildCrossScopeMappings?(
    assignment: PolicyAssignmentSpec,
  ): PolicyAssignmentSpec[];
}
