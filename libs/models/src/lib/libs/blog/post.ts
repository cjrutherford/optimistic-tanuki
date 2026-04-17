import { DateRange } from '../util/date-range';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDate,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PostDto {
  @ApiProperty({ description: 'Post ID' })
  id!: string;

  @ApiProperty({ description: 'Post title' })
  title!: string;

  @ApiProperty({ description: 'Post content' })
  content!: string;

  @ApiProperty({ description: 'Author ID' })
  authorId!: string;

  @ApiProperty({ description: 'Is draft' })
  isDraft!: boolean;

  @ApiProperty({ description: 'Published timestamp', nullable: true })
  publishedAt!: Date | null;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}

export class CreateBlogPostDto {
  @ApiProperty({ description: 'Post title', example: 'My First Blog Post' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  title!: string;

  @ApiProperty({ description: 'Post content in HTML format' })
  @IsString()
  @MinLength(10)
  @MaxLength(100000)
  content!: string;

  @ApiProperty({ description: 'Author ID' })
  @IsString()
  @IsUUID()
  authorId!: string;

  @ApiProperty({ description: 'Is draft', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}

export class UpdateBlogPostDto {
  @ApiProperty({ description: 'Post ID' })
  @IsString()
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'Post title', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  title?: string;

  @ApiProperty({ description: 'Post content', required: false })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(100000)
  content?: string;

  @ApiProperty({ description: 'Author ID', required: false })
  @IsOptional()
  @IsString()
  @IsUUID()
  authorId?: string;

  @ApiProperty({ description: 'Is draft', required: false })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}

export class PostQueryDto {
  @ApiProperty({ description: 'Post ID', required: false })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Post title', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiProperty({ description: 'Post content', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  content?: string;

  @ApiProperty({ description: 'Author ID', required: false })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiProperty({ description: 'Is draft', required: false })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @ApiProperty({ description: 'Created date range', required: false })
  @IsOptional()
  createdAt?: DateRange;

  @ApiProperty({ description: 'Updated date range', required: false })
  @IsOptional()
  updatedAt?: DateRange;
}
