import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'Wireless Mouse' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
  @ApiProperty({
    description: 'Product description',
    example: 'A high-quality wireless mouse',
  })
  @IsString()
  @MinLength(0)
  @MaxLength(2000)
  description?: string;
  @ApiProperty({ description: 'Product price', example: 29.99 })
  @IsNumber()
  price!: number;
  @ApiProperty({ description: 'Product type', example: 'physical' })
  @IsString()
  type!: string;
  @ApiPropertyOptional({
    description: 'Product image URL',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsOptional()
  @MinLength(0)
  @MaxLength(1000)
  imageUrl?: string;
  @ApiPropertyOptional({ description: 'Product stock quantity', example: 100 })
  @IsNumber()
  @IsOptional()
  stock?: number;
  @ApiProperty({
    description: 'Is product active',
    example: true,
    default: true,
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Owner user id for owner-scoped store products',
    example: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
  })
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Wireless Mouse',
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
  @ApiPropertyOptional({
    description: 'Product description',
    example: 'A high-quality wireless mouse',
  })
  @IsString()
  @IsOptional()
  @MinLength(0)
  @MaxLength(2000)
  description?: string;
  @ApiPropertyOptional({ description: 'Product price', example: 29.99 })
  @IsNumber()
  @IsOptional()
  price?: number;
  @ApiPropertyOptional({ description: 'Product type', example: 'physical' })
  @IsString()
  @IsOptional()
  type?: string;
  @ApiPropertyOptional({
    description: 'Product image URL',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsOptional()
  @MinLength(0)
  @MaxLength(1000)
  imageUrl?: string;
  @ApiPropertyOptional({ description: 'Product stock quantity', example: 100 })
  @IsNumber()
  @IsOptional()
  stock?: number;
  @ApiPropertyOptional({
    description: 'Is product active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
