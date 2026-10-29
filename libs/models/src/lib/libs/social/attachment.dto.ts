import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUrl,
  IsNumber,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';

export class AttachmentDto {
  @ApiProperty({ description: 'Unique identifier for the attachment' })
  id!: string;

  @ApiProperty({ description: 'Name of the attachment' })
  name!: string;

  @ApiProperty({ description: 'URL of the attachment' })
  url!: string;

  @ApiProperty({ description: 'Type of the attachment' })
  type!: string;

  @ApiProperty({ description: 'Size of the attachment in bytes' })
  size!: number;

  @ApiProperty({ description: 'Date when the attachment was created' })
  createdAt!: Date;

  @ApiProperty({ description: 'Date when the attachment was last updated' })
  updatedAt!: Date;
}

export class CreateAttachmentDto {
  @ApiProperty({
    description: 'Name of the attachment',
    example: 'document.pdf',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: 'URL of the attachment',
    example: 'https://cdn.example.com/file.pdf',
  })
  @IsUrl({}, { message: 'Must be a valid URL' })
  @MaxLength(2048)
  url!: string;

  @ApiProperty({
    description: 'MIME type of the attachment',
    example: 'application/pdf',
  })
  @IsString()
  @MaxLength(255)
  type!: string;

  @ApiProperty({
    description: 'Size of the attachment in bytes',
    example: 1024000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100 * 1024 * 1024) // 100MB max
  size?: number;

  @ApiProperty({
    description: 'ID of the Social post that owns this attachment',
    format: 'uuid',
  })
  @IsUUID()
  postId!: string;
}
