import { CreateProjectJournalDto } from './create-project-journal.dto';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class UpdateProjectJournalDto extends PartialType(
  CreateProjectJournalDto
) {
  @ApiProperty({ description: 'Journal entry ID' })
  @IsUUID()
  id: string;
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
  createdAt?: [Date, Date];

  @ApiPropertyOptional({ type: [Date], description: 'Updated at range' })
  @IsOptional()
  updatedAt?: [Date, Date];
}
