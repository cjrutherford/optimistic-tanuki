import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateRoleDto {
    @IsString()
    name: string;

    @IsString()
    description: string;

    @IsString()
    appScopeId: string;
}

export class UpdateRoleDto {
    @IsString()
    id: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    appScopeId?: string;
}

export class AssignRoleDto {
    @IsString()
    roleId: string;

    @IsString()
    profileId: string;

    @IsString()
    appScopeId: string;
}

export class RoleDto {
    id: string;
    name: string;
    description: string;
    appScope?: any;
    created_at: Date;
    permissions?: any[];
}

export class RoleAssignmentDto {
    id: string;
    profileId: string;
    appScope?: any;
    role: RoleDto;
    created_at: Date;
}
