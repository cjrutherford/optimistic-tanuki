import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsBoolean, IsString, IsDateString } from 'class-validator';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiProperty({ description: 'The unique identifier of the task' })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({ description: 'User assigned to the task' })
  @IsOptional()
  @IsString()
  @IsUUID()
  assignee?: string;

  @ApiPropertyOptional({ description: 'Due date of the task' })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @ApiPropertyOptional({ description: 'User who last updated the task' })
  @IsOptional()
  @IsString()
  @IsUUID()
  updatedBy?: string;
}

export class QueryTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ description: 'User who last updated the task' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  @ApiPropertyOptional({ type: [Date], description: 'Created at date range [from, to]' })
  @IsOptional()
  createdAt?: [Date, Date];

  @ApiPropertyOptional({ type: [Date], description: 'Updated at date range [from, to]' })
  @IsOptional()
  updatedAt?: [Date, Date];

  @ApiPropertyOptional({ description: 'Whether the task is deleted' })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}