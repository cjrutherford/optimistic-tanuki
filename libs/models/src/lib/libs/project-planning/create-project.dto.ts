import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDate,
  IsUUID,
  IsArray,
  MaxLength,
  MinLength,
  IsEnum,
  IsBoolean,
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
  /**
   * Who owns the project.
   *
   * Optional because the gateway sets it from the session and overwrites
   * whatever arrives. Requiring it meant every client had to send a value that
   * was then discarded, and the clients that forgot simply could not create
   * anything. Identity belongs to the session, never the body.
   */
  @ApiPropertyOptional({ description: 'Set from the session by the gateway' })
  @IsOptional()
  @IsUUID()
  owner?: string;

  /**
   * Who created the project.
   *
   * Optional because the gateway sets it from the session and overwrites
   * whatever arrives. Requiring it meant every client had to send a value that
   * was then discarded, and the clients that forgot simply could not create
   * anything. Identity belongs to the session, never the body.
   */
  @ApiPropertyOptional({ description: 'Set from the session by the gateway' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiProperty({
    type: [String],
    description: 'Array of member IDs',
    isArray: true,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  members!: string[];

  @ApiProperty({
    type: String,
    description: 'Name of the project',
    example: 'Website Redesign',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    type: String,
    description: 'Description of the project',
    example: 'Complete redesign of company website',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({
    type: Date,
    description: 'Start date of the project',
    example: '2026-01-01T00:00:00Z',
  })
  @IsDate()
  @Type(() => Date)
  startDate!: Date;

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
  status!: string;

  @ApiProperty({
    description: 'App scope for the project',
    required: false,
    example: 'project-planning',
  })
  @IsOptional()
  @IsString()
  appScope?: string;

  @ApiProperty({
    description: 'Whether the project can be discovered by non-members',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({
    description: 'Whether AI-proposed changes require human approval',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  requireHumanApproval?: boolean;
}
