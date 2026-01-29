import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class UpdateInventoryItemDto {
  @ApiProperty({ description: 'The name of the inventory item', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Description of the inventory item', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The quantity of the inventory item', required: false })
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiProperty({ description: 'The unit value of the inventory item', required: false })
  @IsNumber()
  @IsOptional()
  unitValue?: number;

  @ApiProperty({ description: 'The category of the inventory item', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Whether the inventory item is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'SKU of the inventory item', required: false })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({ description: 'Location of the inventory item', required: false })
  @IsString()
  @IsOptional()
  location?: string;
}
