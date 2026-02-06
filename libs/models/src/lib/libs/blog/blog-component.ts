import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BlogComponentDto {
  @ApiProperty({ description: 'Component ID' })
  id: string;

  @ApiProperty({ description: 'Blog Post ID' })
  blogPostId: string;

  @ApiProperty({ description: 'Instance ID of the component' })
  instanceId: string;

  @ApiProperty({ description: 'Type of component' })
  componentType: string;

  @ApiProperty({ description: 'Component configuration data' })
  componentData: Record<string, any>;

  @ApiProperty({ description: 'Position of component in post' })
  position: number;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}

export class CreateBlogComponentDto {
  @ApiProperty({ description: 'Blog Post ID' })
  @IsString()
  @IsUUID()
  blogPostId: string;

  @ApiProperty({ description: 'Instance ID of the component' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  instanceId: string;

  @ApiProperty({ description: 'Type of component' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  componentType: string;

  @ApiProperty({ description: 'Component configuration data' })
  @IsObject()
  componentData: Record<string, any>;

  @ApiProperty({ description: 'Position of component in post' })
  @IsNumber()
  @Min(0)
  position: number;
}

export class UpdateBlogComponentDto {
  @ApiProperty({ description: 'Component configuration data', required: false })
  @IsOptional()
  @IsObject()
  componentData?: Record<string, any>;

  @ApiProperty({ description: 'Position of component in post', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  position?: number;
}

export class BlogComponentQueryDto {
  @ApiProperty({ description: 'Component ID', required: false })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Blog Post ID', required: false })
  @IsOptional()
  @IsUUID()
  blogPostId?: string;

  @ApiProperty({ description: 'Instance ID', required: false })
  @IsOptional()
  @IsString()
  instanceId?: string;

  @ApiProperty({ description: 'Component type', required: false })
  @IsOptional()
  @IsString()
  componentType?: string;
}

export interface ComponentExtractionResult {
  instanceId: string;
  componentType: string;
  componentData: Record<string, any>;
  position: number;
  domNode: HTMLElement;
}