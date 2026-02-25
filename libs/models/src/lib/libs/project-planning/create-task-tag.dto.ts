import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateTaskTagDto {
  @ApiProperty({
    description: 'Name of the tag',
    example: 'frontend',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({
    description: 'Color for the tag (hex code)',
    example: '#3498db',
  })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @ApiPropertyOptional({
    description: 'Description of the tag',
    example: 'Frontend development tasks',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ description: 'User who created the tag' })
  @IsString()
  @IsUUID()
  createdBy!: string;
}
