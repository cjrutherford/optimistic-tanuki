import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
  IsNotEmpty,
  IsInt,
  IsEnum,
  IsDateString,
} from 'class-validator';

export enum VideoVisibility {
  PUBLIC = 'public',
  UNLISTED = 'unlisted',
  PRIVATE = 'private',
}

export class CreateVideoDto {
  @ApiProperty({
    description: 'Video title',
    example: 'How to build a NestJS app',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Video description',
    example: 'In this tutorial, we will build a NestJS application from scratch',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Asset ID of the video file' })
  @IsString()
  @IsUUID()
  assetId: string;

  @ApiProperty({
    description: 'Thumbnail asset ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  thumbnailAssetId?: string;

  @ApiProperty({ description: 'Channel ID' })
  @IsString()
  @IsUUID()
  channelId: string;

  @ApiProperty({
    description: 'Video duration in seconds',
    required: false,
  })
  @IsOptional()
  @IsInt()
  durationSeconds?: number;

  @ApiProperty({
    description: 'Video resolution',
    example: '1920x1080',
    required: false,
  })
  @IsOptional()
  @IsString()
  resolution?: string;

  @ApiProperty({
    description: 'Video encoding format',
    example: 'H.264',
    required: false,
  })
  @IsOptional()
  @IsString()
  encoding?: string;

  @ApiProperty({
    description: 'Video visibility',
    enum: VideoVisibility,
    default: VideoVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;
}

export class UpdateVideoDto {
  @ApiProperty({ description: 'Video title', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiProperty({ description: 'Video description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Thumbnail asset ID', required: false })
  @IsOptional()
  @IsUUID()
  thumbnailAssetId?: string;

  @ApiProperty({ description: 'Video visibility', required: false })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;

  @ApiProperty({ description: 'Published at timestamp', required: false })
  @IsOptional()
  @IsDateString()
  publishedAt?: Date;
}

export class VideoDto {
  @ApiProperty({ description: 'Video ID' })
  id: string;

  @ApiProperty({ description: 'Video title' })
  title: string;

  @ApiProperty({ description: 'Video description' })
  description?: string;

  @ApiProperty({ description: 'Asset ID' })
  assetId: string;

  @ApiProperty({ description: 'Thumbnail asset ID' })
  thumbnailAssetId?: string;

  @ApiProperty({ description: 'Channel ID' })
  channelId: string;

  @ApiProperty({ description: 'Duration in seconds' })
  durationSeconds?: number;

  @ApiProperty({ description: 'Resolution' })
  resolution?: string;

  @ApiProperty({ description: 'Encoding' })
  encoding?: string;

  @ApiProperty({ description: 'View count' })
  viewCount: number;

  @ApiProperty({ description: 'Like count' })
  likeCount: number;

  @ApiProperty({ description: 'Visibility' })
  visibility: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  @ApiProperty({ description: 'Published at' })
  publishedAt?: Date;
}

export class RecordVideoViewDto {
  @ApiProperty({ description: 'Video ID' })
  @IsString()
  @IsUUID()
  videoId: string;

  @ApiProperty({ description: 'User ID', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'Profile ID', required: false })
  @IsOptional()
  @IsUUID()
  profileId?: string;

  @ApiProperty({
    description: 'Watch duration in seconds',
    required: false,
  })
  @IsOptional()
  @IsInt()
  watchDurationSeconds?: number;
}

export class CreateChannelSubscriptionDto {
  @ApiProperty({ description: 'Channel ID to subscribe to' })
  @IsString()
  @IsUUID()
  channelId: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Profile ID' })
  @IsString()
  @IsUUID()
  profileId: string;
}
