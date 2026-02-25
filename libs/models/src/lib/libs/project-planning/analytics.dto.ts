import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsArray, IsDateString } from 'class-validator';

export class TaskAnalyticsDto {
  @ApiProperty({ description: 'Task ID' })
  taskId!: string;

  @ApiProperty({ description: 'Task title' })
  taskTitle!: string;

  @ApiProperty({ description: 'Total time spent in seconds' })
  totalTimeSeconds!: number;

  @ApiProperty({ description: 'Number of time entries' })
  entryCount!: number;

  @ApiProperty({ description: 'Tags associated with the task' })
  tags!: string[];
}

export class ProjectAnalyticsDto {
  @ApiProperty({ description: 'Project ID' })
  projectId!: string;

  @ApiProperty({ description: 'Project name' })
  projectName!: string;

  @ApiProperty({ description: 'Total time spent in seconds' })
  totalTimeSeconds!: number;

  @ApiProperty({ description: 'Number of tasks' })
  taskCount!: number;

  @ApiProperty({ description: 'Task breakdown by time' })
  tasks!: TaskAnalyticsDto[];
}

export class TagAnalyticsDto {
  @ApiProperty({ description: 'Tag ID' })
  tagId!: string;

  @ApiProperty({ description: 'Tag name' })
  tagName!: string;

  @ApiProperty({ description: 'Total time spent in seconds' })
  totalTimeSeconds!: number;

  @ApiProperty({ description: 'Number of tasks with this tag' })
  taskCount!: number;
}

export class QueryAnalyticsDto {
  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter by task IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  taskIds?: string[];

  @ApiPropertyOptional({ description: 'Filter by tag IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ description: 'Start date for time range' })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for time range' })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
