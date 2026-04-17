import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskTagDto } from './create-task-tag.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class UpdateTaskTagDto extends PartialType(CreateTaskTagDto) {
  @ApiProperty({ description: 'Tag ID' })
  @IsUUID()
  id!: string;

  @ApiPropertyOptional({ description: 'User who last updated the tag' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}

export class QueryTaskTagDto {
  @ApiPropertyOptional({ description: 'Filter by tag name' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Whether the tag is deleted' })
  @IsOptional()
  @IsBoolean()
  deleted?: boolean;
}
