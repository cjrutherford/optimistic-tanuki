import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBlogCatalogDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class BlogCatalogScopeDto {
  @IsUUID()
  ownerId!: string;

  @IsUUID()
  workspaceId!: string;

  @IsString()
  appScope!: string;
}

export class BlogCatalogDto extends BlogCatalogScopeDto {
  @IsUUID()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}
