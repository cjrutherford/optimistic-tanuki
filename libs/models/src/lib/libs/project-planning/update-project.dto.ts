import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';
import { PartialType } from '@nestjs/mapped-types';
import {
  IsUUID,
  IsOptional,
  IsBoolean,
  IsDate,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProjectDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appScope?: string;
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
