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
  targetId?: string;
}

export interface BulkRoleMutationDto {
  operation: 'assign' | 'unassign';
  roleId: string;
  profileIds: string[];
  appScopeId: string;
  targetId?: string;
}

export interface BulkRoleMutationPermissionChangeDto {
  permissionName: string;
  resource: string;
  action: string;
  status: 'added' | 'removed' | 'retained' | 'already-present';
  reason?: string;
  affectedProfileCount?: number;
}

export interface BulkRoleMutationProfileImpactDto {
  profileId: string;
  profileName?: string;
  permissionChanges: BulkRoleMutationPermissionChangeDto[];
}

export interface BulkRoleMutationPreviewDto {
  operation: 'assign' | 'unassign';
  roleId: string;
  roleName: string;
  appScopeId: string;
  targetId?: string;
  totalSelected: number;
  affectedCount: number;
  unchangedCount: number;
  affectedProfileIds: string[];
  unchangedProfileIds: string[];
  existingAssignmentIds: string[];
  permissionChangeSummary: BulkRoleMutationPermissionChangeDto[];
  profileImpacts: BulkRoleMutationProfileImpactDto[];
}

export interface BulkRoleMutationResultDto extends BulkRoleMutationPreviewDto {
  completedCount: number;
}
