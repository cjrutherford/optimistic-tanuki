import { IsString, IsOptional } from 'class-validator';

export class CreatePermissionDto {
    @IsString()
    name: string;

    @IsString()
    description: string;

    @IsString()
    resource: string;

    @IsString()
    action: string;

    @IsOptional()
    @IsString()
    targetId?: string;
}

export class UpdatePermissionDto {
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
    resource?: string;

    @IsOptional()
    @IsString()
    action?: string;

    @IsOptional()
    @IsString()
    targetId?: string;
}

export class PermissionDto {
    id: string;
    name: string;
    description: string;
    resource: string;
    action: string;
    targetId?: string;
    created_at: Date;
}
