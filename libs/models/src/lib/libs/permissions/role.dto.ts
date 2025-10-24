import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateRoleDto {
    @IsString()
    name: string;

    @IsString()
    description: string;

    @IsString()
    appScope: string;
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
    appScope?: string;
}

export class AssignRoleDto {
    @IsString()
    roleId: string;

    @IsString()
    profileId: string;

    @IsString()
    appScope: string;
}

export class RoleDto {
    id: string;
    name: string;
    description: string;
    appScope: string;
    created_at: Date;
    permissions?: any[];
}

export class RoleAssignmentDto {
    id: string;
    profileId: string;
    appScope: string;
    role: RoleDto;
    created_at: Date;
}
