import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export enum AvailabilityOverrideMode {
  AVAILABLE = 'available',
  BLOCKED = 'blocked',
}

export class CreateAvailabilityOverrideDto {
  @ApiPropertyOptional({ description: 'Owner user ID' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @ApiProperty({ description: 'Override start time' })
  @IsDateString()
  startTime!: string;

  @ApiProperty({ description: 'Override end time' })
  @IsDateString()
  endTime!: string;

  @ApiProperty({
    description: 'Whether the override creates availability or blocks it',
    enum: AvailabilityOverrideMode,
  })
  @IsEnum(AvailabilityOverrideMode)
  mode!: AvailabilityOverrideMode;

  @ApiPropertyOptional({ description: 'Service type' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Hourly rate', minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  hourlyRate?: number;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAvailabilityOverrideDto {
  @ApiPropertyOptional({ description: 'Override start time' })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Override end time' })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Whether the override creates availability or blocks it',
    enum: AvailabilityOverrideMode,
  })
  @IsEnum(AvailabilityOverrideMode)
  @IsOptional()
  mode?: AvailabilityOverrideMode;

  @ApiPropertyOptional({ description: 'Service type' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  serviceType?: string;

  @ApiPropertyOptional({ description: 'Hourly rate', minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  hourlyRate?: number;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
