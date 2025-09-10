import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { CreateProjectDto } from './create-project.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiProperty()
  id: string;
}

export class QueryProjectDto extends PartialType(CreateProjectDto) {

  @ApiPropertyOptional()
  updatedBy?: string;

  @ApiPropertyOptional({ type: [Date], description: 'Range: [start, end]' })
  createdAt?: [Date, Date];

  @ApiPropertyOptional({ type: [Date], description: 'Range: [start, end]' })
  updatedAt?: [Date, Date];

  @ApiPropertyOptional()
  deleted?: boolean;
}