import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AssetType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
}

export enum StorageStrategy {
  LOCAL_BLOCK_STORAGE = 'local_block_storage',
  REMOTE_BLOCK_STORAGE = 'remote_block_storage',
  DATABASE_STORAGE = 'database_storage',
}

export class CreateAssetDto {
  @ApiProperty({ description: 'Asset ID', required: false })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({
    description: 'Asset filename',
    example: 'profile-picture.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Profile ID of the asset owner' })
  @IsString()
  @IsUUID()
  profileId!: string;

  @ApiProperty({ description: 'Asset type', enum: AssetType })
  @IsEnum(AssetType)
  type!: AssetType;

  @ApiProperty({
    description: 'Optional content for in-memory operations',
    required: false,
  })
  @IsOptional()
  content?: Buffer | string;

  @ApiProperty({
    description: 'Optional existing file path to ingest without inline content',
    required: false,
  })
  @IsOptional()
  @IsString()
  sourcePath?: string;

  @ApiProperty({
    description: 'File extension',
    example: 'jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  fileExtension?: string;
}

export class AssetDto {
  @ApiProperty({ description: 'Asset ID' })
  id!: string;

  @ApiProperty({ description: 'Asset filename' })
  name!: string;

  @ApiProperty({ description: 'Asset type', enum: AssetType })
  type!: AssetType;

  @ApiProperty({ description: 'Storage strategy', enum: StorageStrategy })
  storageStrategy!: StorageStrategy;

  @ApiProperty({ description: 'Storage path' })
  storagePath!: string;

  @ApiProperty({ description: 'Profile ID of owner' })
  profileId!: string;

  @ApiProperty({ description: 'Optional content', required: false })
  content?: Buffer;
}

export class AssetHandle {
  @ApiProperty({ description: 'Asset ID' })
  @IsString()
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'Profile ID', required: false })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}
