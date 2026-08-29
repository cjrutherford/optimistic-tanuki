import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsBoolean,
  IsString,
  IsArray,
} from 'class-validator';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiProperty({ description: 'The unique identifier of the task' })
  @IsUUID()
  id!: string;

  @ApiPropertyOptional({ description: 'User who last updated the task' })
  @IsOptional()
  @IsString()
  @IsUUID()
  updatedBy?: string;

  @ApiPropertyOptional({
    description: 'Array of tag IDs to associate with the task',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  override tagIds?: string[];
}

export class QueryTaskDto extends OmitType(PartialType(CreateTaskDto), [
  'dueDate',
] as const) {
  @ApiPropertyOptional({ description: 'User who last updated the task' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  // `assignee` moved onto CreateTaskDto, so this redeclaration now overrides a
  // base member and needs saying so, the same way tagIds does above.
  @ApiPropertyOptional({ description: 'User assigned to the task' })
  @IsOptional()
  @IsUUID()
  override assignee?: string;

  @ApiPropertyOptional({
    type: [Date],
    description: 'Due date range [from, to]',
  })
  @IsOptional()
  dueDate?: [Date, Date];

  @ApiPropertyOptional({
    type: [Date],
    description: 'Created at date range [from, to]',
  })
  @IsOptional()
  createdAt?: [Date, Date];

  @ApiPropertyOptional({
    type: [Date],
    description: 'Updated at date range [from, to]',
  })
  @IsOptional()
  updatedAt?: [Date, Date];

  @ApiPropertyOptional({ description: 'Whether the task is deleted' })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by tag IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  override tagIds?: string[];
}
