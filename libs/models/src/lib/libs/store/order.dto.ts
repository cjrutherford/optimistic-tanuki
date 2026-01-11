import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @ApiProperty({ description: 'The ID of the product' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'The quantity of the product' })
  @IsNumber()
  quantity: number;
}
export class CreateOrderDto {
  @ApiProperty({ description: 'The ID of the user creating the order' })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'The list of items in the order',
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class UpdateOrderDto {
  @ApiProperty({ description: 'The status of the order', required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
