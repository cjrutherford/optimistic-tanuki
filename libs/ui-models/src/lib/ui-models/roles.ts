export interface RoleDto {
  id: string;
  name: string;
  description: string;
  appScope?: any;
  permissions?: any[];
  created_at?: Date;
}

export interface CreateRoleDto {
  name: string;
  description: string;
  appScopeId: string;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  appScopeId?: string;
}

export interface AssignRoleDto {
  roleId: string;
  profileId: string;
  appScopeId: string;
}
