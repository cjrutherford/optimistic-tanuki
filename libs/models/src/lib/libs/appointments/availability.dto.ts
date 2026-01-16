import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
  IsUUID,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateAvailabilityDto {
  @ApiProperty({ description: 'Owner user ID' })
  @IsUUID()
  ownerId: string;

  @ApiProperty({ description: 'Day of week (0-6, Sunday-Saturday)' })
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Start time (HH:MM:SS format)' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'End time (HH:MM:SS format)' })
  @IsString()
  endTime: string;

  @ApiProperty({ description: 'Hourly rate' })
  @IsNumber()
  @Min(0)
  hourlyRate: number;

  @ApiPropertyOptional({ description: 'Service type' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({ description: 'Day of week (0-6, Sunday-Saturday)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({ description: 'Start time (HH:MM:SS format)' })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ description: 'End time (HH:MM:SS format)' })
  @IsString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Hourly rate' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional({ description: 'Service type' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
