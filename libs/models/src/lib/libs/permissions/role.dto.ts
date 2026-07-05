import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @IsString()
  @ApiProperty()
  name!: string;

  @IsString()
  @ApiProperty()
  description!: string;

  @IsString()
  @ApiProperty()
  appScopeId!: string;

  @ApiPropertyOptional()
  targetId?: string;
}

export class UpdateRoleDto {
  @IsString()
  @ApiProperty()
  id!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  description?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  appScopeId?: string;
}

export class AssignRoleDto {
  @IsString()
  @ApiProperty()
  roleId!: string;

  @IsString()
  @ApiProperty()
  profileId!: string;

  @IsString()
  @ApiProperty()
  appScopeId!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  targetId?: string;
}

export class BulkRoleMutationDto {
  @IsString()
  @ApiProperty()
  operation!: 'assign' | 'unassign';

  @IsString()
  @ApiProperty()
  roleId!: string;

  @IsArray()
  @ApiProperty({ type: [String] })
  profileIds!: string[];

  @IsString()
  @ApiProperty()
  appScopeId!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  targetId?: string;
}

export class BulkRoleMutationPermissionChangeDto {
  @ApiProperty()
  permissionName!: string;

  @ApiProperty()
  resource!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  status!: 'added' | 'removed' | 'retained' | 'already-present';

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  affectedProfileCount?: number;
}

export class BulkRoleMutationProfileImpactDto {
  @ApiProperty()
  profileId!: string;

  @ApiPropertyOptional()
  profileName?: string;

  @ApiProperty({ type: [BulkRoleMutationPermissionChangeDto] })
  permissionChanges!: BulkRoleMutationPermissionChangeDto[];
}

export class BulkRoleMutationPreviewDto {
  @ApiProperty()
  operation!: 'assign' | 'unassign';

  @ApiProperty()
  roleId!: string;

  @ApiProperty()
  roleName!: string;

  @ApiProperty()
  appScopeId!: string;

  @ApiPropertyOptional()
  targetId?: string;

  @ApiProperty()
  totalSelected!: number;

  @ApiProperty()
  affectedCount!: number;

  @ApiProperty()
  unchangedCount!: number;

  @ApiProperty({ type: [String] })
  affectedProfileIds!: string[];

  @ApiProperty({ type: [String] })
  unchangedProfileIds!: string[];

  @ApiProperty({ type: [String] })
  existingAssignmentIds!: string[];

  @ApiProperty({ type: [BulkRoleMutationPermissionChangeDto] })
  permissionChangeSummary!: BulkRoleMutationPermissionChangeDto[];

  @ApiProperty({ type: [BulkRoleMutationProfileImpactDto] })
  profileImpacts!: BulkRoleMutationProfileImpactDto[];
}

export class BulkRoleMutationResultDto extends BulkRoleMutationPreviewDto {
  @ApiProperty()
  completedCount!: number;
}

export class RoleDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  description!: string;
  @ApiPropertyOptional()
  appScope?: any;
  @ApiProperty()
  created_at!: Date;
  @IsOptional()
  @IsArray()
  @ApiPropertyOptional()
  permissions?: any[];
}

export class RoleAssignmentDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  profileId!: string;
  @ApiPropertyOptional()
  appScope?: any;
  @ApiProperty()
  role!: RoleDto;
  @ApiProperty()
  created_at!: Date;
  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  targetId?: string;
}
