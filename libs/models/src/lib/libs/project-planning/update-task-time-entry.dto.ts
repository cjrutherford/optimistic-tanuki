import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskTimeEntryDto } from './create-task-time-entry.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsDateString, IsNumber, IsDate } from 'class-validator';

export class UpdateTaskTimeEntryDto extends PartialType(
  CreateTaskTimeEntryDto
) {
  @ApiProperty({ description: 'Time entry ID' })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({ description: 'End time of the time entry' })
  @IsOptional()
  @IsDate()
  endTime?: Date;

  @ApiPropertyOptional({ description: 'Elapsed time in seconds' })
  @IsOptional()
  @IsNumber()
  elapsedSeconds?: number;

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

  @ApiPropertyOptional({ description: 'User who created the time entry' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
