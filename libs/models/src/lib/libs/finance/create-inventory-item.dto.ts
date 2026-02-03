import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateInventoryItemDto {
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

  @ApiProperty({ description: 'The category of the inventory item' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'The ID of the user creating the inventory item' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'The ID of the profile creating the inventory item' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty({ description: 'App scope for the inventory item' })
  @IsString()
  @IsNotEmpty()
  appScope: string;

  @ApiProperty({ description: 'SKU of the inventory item' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({ description: 'Location of the inventory item' })
  @IsString()
  @IsOptional()
  location?: string;
}
