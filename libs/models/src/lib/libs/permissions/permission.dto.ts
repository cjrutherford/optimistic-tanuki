import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
    @IsString()
    @ApiProperty()
    name!: string;

    @IsString()
    @ApiProperty()
    description!: string;

    @IsString()
    @ApiProperty()
    resource!: string;

    @IsString()
    @ApiProperty()
    action!: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional()
    targetId?: string;
}

export class UpdatePermissionDto {
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
    resource?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional()
    action?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional()
    targetId?: string;
}

export class PermissionDto {
    @ApiProperty()
    id!: string;
    @ApiProperty()
    name!: string;
    @ApiProperty()
    description!: string;
    @ApiProperty()
    resource!: string;
    @ApiProperty()
    action!: string;
    @ApiPropertyOptional()
    targetId?: string;
    @ApiProperty()
    created_at!: Date;
}
