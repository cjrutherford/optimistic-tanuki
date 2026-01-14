import { DateRange } from '../util/date-range';
import { IsString, IsOptional, IsUUID, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlogDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  description!: string;
  @ApiProperty()
  ownerId!: string;
  @ApiProperty()
  createdAt!: Date;
  @ApiProperty()
  updatedAt!: Date;
}

export class CreateBlogDto {
  @IsString()
  @ApiProperty()
  name!: string;

  @IsString()
  @ApiProperty()
  description!: string;

  @IsString()
  @IsUUID()
  @ApiProperty()
  ownerId!: string;
}

export class UpdateBlogDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  description?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  @ApiPropertyOptional()
  ownerId?: string;
}

export class BlogQueryDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  @ApiPropertyOptional()
  id?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  description?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  @ApiPropertyOptional()
  ownerId?: string;

  @IsOptional()
  @ApiPropertyOptional()
  createdAt?: DateRange;

  @IsOptional()
  @ApiPropertyOptional()
  updatedAt?: DateRange;
}
