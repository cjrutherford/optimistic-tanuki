import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export class CreateInventoryItemDto {
  @ApiProperty({ description: 'The name of the inventory item' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Description of the inventory item' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The quantity of the inventory item' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ description: 'The unit value of the inventory item' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  unitValue: number;

  @ApiProperty({ description: 'The category of the inventory item' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({
    description: 'The ID of the user creating the inventory item',
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'The ID of the profile creating the inventory item',
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  profileId?: string;

  @ApiPropertyOptional({ description: 'The ID of the finance tenant' })
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'App scope for the inventory item' })
  @IsString()
  @IsOptional()
  appScope?: string;

  @ApiPropertyOptional({ description: 'SKU of the inventory item' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ description: 'Location of the inventory item' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description: 'Workspace for the inventory item',
    required: false,
    default: 'net-worth',
  })
  @IsString()
  @IsOptional()
  workspace?: FinanceWorkspace;
}
