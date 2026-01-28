import { CreateProjectJournalDto } from './create-project-journal.dto';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class UpdateProjectJournalDto extends PartialType(
  CreateProjectJournalDto
) {
  @ApiProperty({ description: 'Journal entry ID' })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({ description: 'User who last updated the journal' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}

export class QueryProjectJournalDto extends PartialType(
  CreateProjectJournalDto
) {
  @ApiPropertyOptional({ description: 'Created by user ID' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  @ApiPropertyOptional({ type: [Date], description: 'Created at range' })
  @IsOptional()
  @IsDateString({}, { each: true })
  createdAt?: [Date, Date];

  @ApiPropertyOptional({ type: [Date], description: 'Updated at range' })
  @IsOptional()
  @IsDateString({}, { each: true })
  updatedAt?: [Date, Date];

  @ApiPropertyOptional({ description: 'Whether the journal entry is deleted' })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}
