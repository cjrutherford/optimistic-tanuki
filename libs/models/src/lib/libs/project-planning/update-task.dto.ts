import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiProperty({ description: 'The unique identifier of the task' })
  id: string;
}

export class QueryTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ description: 'User who last updated the task' })
  updatedBy?: string;

  @ApiPropertyOptional({ type: [Date], description: 'Created at date range [from, to]' })
  createdAt?: [Date, Date];

  @ApiPropertyOptional({ type: [Date], description: 'Updated at date range [from, to]' })
  updatedAt?: [Date, Date];

  @ApiPropertyOptional({ description: 'Whether the task is deleted' })
  deleted?: boolean;
}