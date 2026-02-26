import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsEnum,
  MaxLength,
  MinLength,
  IsArray,
  IsOptional,
} from 'class-validator';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  ARCHIVED = 'ARCHIVED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM_LOW = 'MEDIUM_LOW',
  MEDIUM = 'MEDIUM',
  MEDIUM_HIGH = 'MEDIUM_HIGH',
  HIGH = 'HIGH',
}

export class CreateTaskDto {
  @ApiProperty({
    description: 'Title of the task',
    example: 'Design homepage mockup',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    description: 'Description of the task',
    example: 'Create initial mockup for homepage redesign',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ description: 'Status of the task', enum: TaskStatus })
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @ApiProperty({ description: 'Priority of the task', enum: TaskPriority })
  @IsEnum(TaskPriority)
  priority!: TaskPriority;

  @ApiProperty({ description: 'User who created the task' })
  @IsString()
  @IsUUID()
  createdBy!: string;

  @ApiProperty({ description: 'ID of the related project' })
  @IsString()
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({
    description: 'Array of tag IDs to associate with the task',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
