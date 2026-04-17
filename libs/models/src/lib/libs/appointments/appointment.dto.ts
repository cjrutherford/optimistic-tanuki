import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDate,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'User ID requesting the appointment' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ description: 'Associated product ID' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ description: 'Resource ID to book' })
  @IsUUID()
  @IsOptional()
  resourceId?: string;

  @ApiProperty({ description: 'Appointment title' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ description: 'Appointment description' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Start time of the appointment' })
  @IsDate()
  @Type(() => Date)
  startTime!: Date;

  @ApiProperty({ description: 'End time of the appointment' })
  @IsDate()
  @Type(() => Date)
  endTime!: Date;

  @ApiPropertyOptional({
    description: 'Is this a free consultation',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isFreeConsultation?: boolean;

  @ApiPropertyOptional({ description: 'Notes for the appointment' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ description: 'Appointment title' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Appointment description' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Start time of the appointment' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startTime?: Date;

  @ApiPropertyOptional({ description: 'End time of the appointment' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endTime?: Date;

  @ApiPropertyOptional({ description: 'Appointment status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Notes for the appointment' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}

export class ApproveAppointmentDto {
  @ApiPropertyOptional({ description: 'Hourly rate for the appointment' })
  @IsNumber()
  @IsOptional()
  hourlyRate?: number;

  @ApiPropertyOptional({ description: 'Notes for approval' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}

export class DenyAppointmentDto {
  @ApiProperty({ description: 'Reason for denial' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  denialReason!: string;
}
