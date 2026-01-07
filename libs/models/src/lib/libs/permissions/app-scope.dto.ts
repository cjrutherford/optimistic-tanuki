import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppScopeDto {
    @IsString()
    @ApiProperty()
    name!: string;

    @IsString()
    @ApiProperty()
    description!: string;

    @IsOptional()
    @IsBoolean()
    @ApiPropertyOptional()
    active?: boolean;
}

export class UpdateAppScopeDto {
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
    @IsBoolean()
    @ApiPropertyOptional()
    active?: boolean;
}

export class AppScopeDto {
    @ApiProperty()
    id!: string;
    @ApiProperty()
    name!: string;
    @ApiProperty()
    description!: string;
    @ApiProperty()
    active!: boolean;
    @ApiProperty()
    created_at!: Date;
    @ApiPropertyOptional()
    updated_at?: Date;
}
