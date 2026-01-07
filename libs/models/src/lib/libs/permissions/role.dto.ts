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
}
