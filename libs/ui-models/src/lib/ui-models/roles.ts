import { AppScopeDto } from './app-scopes';
import { PermissionDto } from './permissions';

export interface UserRoleDto {
  id: string;
  profileId: string;
  targetId?: string;
  roleId: string;
  appScopeId: string;
  role?: RoleDto;
  created_at?: Date;
  appScope: AppScopeDto;
}

export interface RoleDto {
  id: string;
  name: string;
  description: string;
  appScope?: any;
  permissions?: PermissionDto[];
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
