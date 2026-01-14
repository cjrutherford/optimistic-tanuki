import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDate,
  IsUUID,
  IsArray,
  MaxLength,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreateProjectDto {
  @ApiProperty({ type: String, description: 'Owner ID of the project' })
  @IsString()
  @IsUUID()
  owner: string;

  @ApiProperty({ type: String, description: 'Creator ID of the project' })
  @IsString()
  @IsUUID()
  createdBy: string;

  @ApiProperty({
    type: [String],
    description: 'Array of member IDs',
    isArray: true,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  members: string[];

  @ApiProperty({
    type: String,
    description: 'Name of the project',
    example: 'Website Redesign',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    type: String,
    description: 'Description of the project',
    example: 'Complete redesign of company website',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiProperty({
    type: Date,
    description: 'Start date of the project',
    example: '2026-01-01T00:00:00Z',
  })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'End date of the project',
    example: '2026-06-30T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiProperty({
    type: String,
    description: 'Status of the project',
    enum: ProjectStatus,
  })
  @IsString()
  @MaxLength(50)
  status: string;
}
