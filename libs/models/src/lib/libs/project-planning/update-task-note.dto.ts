import { CreateTaskNoteDto } from './create-task-note.dto';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class UpdateTaskNoteDto extends PartialType(CreateTaskNoteDto) {
  @ApiProperty({ description: 'Note ID' })
  @IsUUID()
  id!: string;

  @ApiPropertyOptional({ description: 'User who last updated the note' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}

export class QueryTaskNoteDto extends PartialType(CreateTaskNoteDto) {
  @ApiPropertyOptional({ description: 'Filter by task ID' })
  @IsOptional()
  @IsUUID()
  override taskId?: string;

  @ApiPropertyOptional({ description: 'Filter by profile ID' })
  @IsOptional()
  @IsUUID()
  override profileId?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  @ApiPropertyOptional({ type: [Date], description: 'Created at range' })
  @IsOptional()
  createdAt?: [Date, Date];

  @ApiPropertyOptional({ type: [Date], description: 'Updated at range' })
  @IsOptional()
  updatedAt?: [Date, Date];

  @ApiPropertyOptional({ description: 'Whether the note is deleted' })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}
