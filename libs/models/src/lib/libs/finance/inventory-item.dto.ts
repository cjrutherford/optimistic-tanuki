import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { FinanceWorkspace } from './finance-workspace.type';

export class InventoryItemDto {
  @ApiProperty({ description: 'The unique identifier of the inventory item' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'The name of the inventory item' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Description of the inventory item' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The quantity of the inventory item' })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ description: 'The unit value of the inventory item' })
  @IsNumber()
  @IsNotEmpty()
  unitValue: number;

  @ApiProperty({ description: 'The total value of the inventory item' })
  @IsNumber()
  @IsNotEmpty()
  totalValue: number;

  @ApiProperty({ description: 'The category of the inventory item' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'The ID of the user who owns the inventory item',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'The ID of the profile associated with the inventory item',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty({ description: 'The ID of the finance tenant' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ description: 'App scope for the inventory item' })
  @IsString()
  @IsNotEmpty()
  appScope: string;

  @ApiProperty({ description: 'Workspace for the inventory item' })
  @IsString()
  @IsNotEmpty()
  workspace: FinanceWorkspace;

  @ApiProperty({ description: 'SKU of the inventory item' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({ description: 'Location of the inventory item' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: 'The date the inventory item was created' })
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;

  @ApiProperty({ description: 'The date the inventory item was last updated' })
  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;

  @ApiProperty({ description: 'Whether the inventory item is active' })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
