import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStoreCatalogDto {
  @ApiProperty({ description: 'Catalog name', example: 'Summer collection' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional catalog description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class StoreCatalogScopeDto {
  @IsUUID()
  ownerId!: string;

  @IsUUID()
  workspaceId!: string;

  @IsString()
  appScope!: string;
}

export class StoreCatalogDto extends StoreCatalogScopeDto {
  @IsUUID()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}
