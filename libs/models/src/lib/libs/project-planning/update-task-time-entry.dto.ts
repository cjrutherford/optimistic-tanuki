import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskTimeEntryDto } from './create-task-time-entry.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsUUID, IsOptional, IsDate } from 'class-validator';

export class UpdateTaskTimeEntryDto extends PartialType(
  CreateTaskTimeEntryDto
) {
  @ApiProperty({ description: 'Time entry ID' })
  @IsUUID()
  id!: string;

  /**
   * When the work stopped.
   *
   * The elapsed time is computed from this and the start, not sent alongside
   * it. elapsedSeconds used to be accepted from the caller and stored
   * unchecked, so a three minute entry could claim forty hours, or minus five
   * hundred seconds, and the column meant nothing.
   */
  @ApiPropertyOptional({ description: 'When the work stopped' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endTime?: Date;

  @ApiPropertyOptional({ description: 'User who last updated the time entry' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}

export class QueryTaskTimeEntryDto {
  @ApiPropertyOptional({ description: 'Task ID to filter by' })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  /**
   * Everything recorded against one project.
   *
   * A screen showing time per task needs the whole project's entries, and
   * asking task by task would be one request per row.
   */
  @ApiPropertyOptional({ description: 'Project ID to filter by' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'User who created the time entry' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
