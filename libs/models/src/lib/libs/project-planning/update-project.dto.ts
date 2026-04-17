import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';
import { PartialType } from '@nestjs/mapped-types';
import { IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  id!: string;
}

export class QueryProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ description: 'Updated by user ID' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  @ApiPropertyOptional({ type: [Date], description: 'Range: [start, end]' })
  @IsOptional()
  createdAt?: [Date, Date];

  @ApiPropertyOptional({ type: [Date], description: 'Range: [start, end]' })
  @IsOptional()
  updatedAt?: [Date, Date];

  @ApiPropertyOptional({ description: 'Deleted flag' })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}
