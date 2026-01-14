// filepath: /home/cjrutherford/workspace/optimistic-tanuki/libs/models/src/lib/libs/blog/event.ts
import { DateRange } from '../util/date-range';
import {
  IsString,
  IsOptional,
  IsDate,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EventDto {
  @ApiProperty({ description: 'Event ID' })
  id: string;

  @ApiProperty({ description: 'Event name' })
  name: string;

  @ApiProperty({ description: 'Event description' })
  description: string;

  @ApiProperty({ description: 'Event location' })
  location: string;

  @ApiProperty({ description: 'Event start time' })
  startTime: Date;

  @ApiProperty({ description: 'Event end time' })
  endTime: Date;

  @ApiProperty({ description: 'Organizer ID' })
  organizerId: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export class CreateEventDto {
  @ApiProperty({ description: 'Event name', example: 'Tech Conference 2026' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Event description',
    example: 'A conference about...',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiProperty({ description: 'Event location', example: 'San Francisco, CA' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  location: string;

  @ApiProperty({
    description: 'Event start time',
    example: '2026-06-01T09:00:00Z',
  })
  @IsDate()
  @Type(() => Date)
  startTime: Date;

  @ApiProperty({
    description: 'Event end time',
    example: '2026-06-03T17:00:00Z',
  })
  @IsDate()
  @Type(() => Date)
  endTime: Date;

  @ApiProperty({ description: 'Organizer ID' })
  @IsString()
  @IsUUID()
  organizerId: string;
}

export class UpdateEventDto {
  @ApiProperty({ description: 'Event name', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @ApiProperty({ description: 'Event description', required: false })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Event location', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  location?: string;

  @ApiProperty({ description: 'Event start time', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startTime?: Date;

  @ApiProperty({ description: 'Event end time', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endTime?: Date;

  @ApiProperty({ description: 'Organizer ID', required: false })
  @IsOptional()
  @IsString()
  @IsUUID()
  organizerId?: string;
}

export class EventQueryDto {
  @ApiProperty({ description: 'Event ID', required: false })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Event name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ description: 'Event description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Event location', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiProperty({ description: 'Event start time range', required: false })
  @IsOptional()
  startTime?: DateRange;

  @ApiProperty({ description: 'Event end time range', required: false })
  @IsOptional()
  endTime?: DateRange;

  @ApiProperty({ description: 'Organizer ID', required: false })
  @IsOptional()
  @IsUUID()
  organizerId?: string;

  @ApiProperty({ description: 'Created date range', required: false })
  @IsOptional()
  createdAt?: DateRange;

  @ApiProperty({ description: 'Updated date range', required: false })
  @IsOptional()
  updatedAt?: DateRange;
}
