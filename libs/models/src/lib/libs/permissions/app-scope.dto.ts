import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateAppScopeDto {
    @IsString()
    name: string;

    @IsString()
    description: string;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

export class UpdateAppScopeDto {
    @IsString()
    id: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
}

export class AppScopeDto {
    id: string;
    name: string;
    description: string;
    active: boolean;
    created_at: Date;
    updated_at?: Date;
}
