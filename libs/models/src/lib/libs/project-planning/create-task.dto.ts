import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsEnum,
  MaxLength,
  MinLength,
  IsArray,
  IsOptional,
  IsDate,
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

  @ApiPropertyOptional({ description: 'User assigned to the task' })
  @IsOptional()
  @IsUUID()
  assignee?: string;

  // IsDate with a Type transform, not IsDateString. The gateway's
  // ValidationPipe runs with enableImplicitConversion, so a string arriving
  // for a property declared as Date is converted to a Date before validation.
  // IsDateString then rejects it for not being a string, and no due date could
  // be set through the gateway at all. startDate on CreateProjectDto already
  // does it this way.
  @ApiPropertyOptional({ description: 'Due date of the task' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  /**
   * Who created the task.
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
