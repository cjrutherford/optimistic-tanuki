import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * `ProductCommands.FIND_ALL_PRODUCTS` — gateway sends
 * `{ catalogId: trimmed, public: true }` and rejects a missing catalog.
 */
export class CatalogProductsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  catalogId!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  public?: boolean;
}

/**
 * `ProductCommands.FIND_ONE_PRODUCT` — gateway sends
 * `{ id, catalogId: trimmed, public: true }`.
 */
export class ProductRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  catalogId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  public?: boolean;
}
