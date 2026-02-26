import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateResourceDto {
  @ApiProperty({ description: 'Resource name' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Resource type', example: 'room' })
  @IsString()
  type!: string; // 'room', 'equipment', 'vehicle', 'other'

  @ApiPropertyOptional({ description: 'Resource description' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Resource location' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ description: 'Resource capacity' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ description: 'Resource amenities' })
  @IsArray()
  @IsOptional()
  amenities?: string[];

  @ApiPropertyOptional({ description: 'Hourly rate for resource' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional({ description: 'Is resource active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Resource image URL' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  imageUrl?: string;
}

export class UpdateResourceDto {
  @ApiPropertyOptional({ description: 'Resource name' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Resource type' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Resource description' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Resource location' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ description: 'Resource capacity' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ description: 'Resource amenities' })
  @IsArray()
  @IsOptional()
  amenities?: string[];

  @ApiPropertyOptional({ description: 'Hourly rate for resource' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional({ description: 'Is resource active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Resource image URL' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  imageUrl?: string;
}
