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

export class SocialComponentDto {
  @ApiProperty({ description: 'Component ID' })
  id!: string;

  @ApiProperty({ description: 'Social Post ID' })
  postId!: string;

  @ApiProperty({ description: 'Instance ID of the component' })
  instanceId!: string;

  @ApiProperty({ description: 'Type of component' })
  componentType!: string;

  @ApiProperty({ description: 'Component configuration data' })
  componentData!: Record<string, any>;

  @ApiProperty({ description: 'Position of component in post' })
  position!: number;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}

export class CreateSocialComponentDto {
  @ApiProperty({ description: 'Social Post ID' })
  @IsString()
  @IsUUID()
  postId!: string;

  @ApiProperty({ description: 'Instance ID of the component' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  instanceId!: string;

  @ApiProperty({ description: 'Type of component' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  componentType!: string;

  @ApiProperty({ description: 'Component configuration data' })
  @IsObject()
  componentData!: Record<string, any>;

  @ApiProperty({ description: 'Position of component in post' })
  @IsNumber()
  @Min(0)
  position!: number;
}

export class UpdateSocialComponentDto {
  @ApiProperty({ description: 'Component configuration data', required: false })
  @IsOptional()
  @IsObject()
  componentData?: Record<string, any>;

  @ApiProperty({
    description: 'Position of component in post',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  position?: number;
}

export class SocialComponentQueryDto {
  @ApiProperty({ description: 'Component ID', required: false })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Social Post ID', required: false })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiProperty({ description: 'Instance ID', required: false })
  @IsOptional()
  @IsString()
  instanceId?: string;

  @ApiProperty({ description: 'Component type', required: false })
  @IsOptional()
  @IsString()
  componentType?: string;
}
