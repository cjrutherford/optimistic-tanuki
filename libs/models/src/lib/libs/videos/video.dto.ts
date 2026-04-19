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

export enum VideoProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
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
    description: 'Original uploaded asset ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  sourceAssetId?: string;

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
    description: 'Canonical community ID for the owning channel',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  communityId?: string;

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

  @ApiProperty({
    description: 'Video processing status',
    enum: VideoProcessingStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(VideoProcessingStatus)
  processingStatus?: VideoProcessingStatus;
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

  @ApiProperty({ description: 'Original source asset ID', required: false })
  sourceAssetId?: string;

  @ApiProperty({ description: 'Normalized MP4 playback asset ID', required: false })
  playbackAssetId?: string;

  @ApiProperty({ description: 'HLS manifest asset ID', required: false })
  hlsManifestAssetId?: string;

  @ApiProperty({ description: 'Thumbnail asset ID' })
  thumbnailAssetId?: string;

  @ApiProperty({ description: 'Channel ID' })
  channelId: string;

  @ApiProperty({ description: 'Canonical community ID for the owning channel' })
  communityId?: string;

  @ApiProperty({ description: 'Duration in seconds' })
  durationSeconds?: number;

  @ApiProperty({ description: 'Resolution' })
  resolution?: string;

  @ApiProperty({ description: 'Encoding' })
  encoding?: string;

  @ApiProperty({
    description: 'Current processing status',
    enum: VideoProcessingStatus,
  })
  processingStatus: VideoProcessingStatus;

  @ApiProperty({ description: 'Processing error message', required: false })
  processingError?: string;

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

export class CompleteVideoProcessingResultDto {
  @ApiProperty({ description: 'Normalized MP4 playback asset ID' })
  @IsUUID()
  playbackAssetId: string;

  @ApiProperty({ description: 'HLS manifest asset ID', required: false })
  @IsOptional()
  @IsUUID()
  hlsManifestAssetId?: string;

  @ApiProperty({ description: 'Video duration in seconds', required: false })
  @IsOptional()
  @IsInt()
  durationSeconds?: number;

  @ApiProperty({ description: 'Video resolution', required: false })
  @IsOptional()
  @IsString()
  resolution?: string;

  @ApiProperty({ description: 'Video encoding label', required: false })
  @IsOptional()
  @IsString()
  encoding?: string;

  @ApiProperty({
    description: 'Final processing status',
    enum: VideoProcessingStatus,
    default: VideoProcessingStatus.READY,
  })
  @IsEnum(VideoProcessingStatus)
  processingStatus: VideoProcessingStatus;
}

export class CompleteVideoProcessingDto {
  @ApiProperty({ description: 'Video ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ type: CompleteVideoProcessingResultDto })
  result: CompleteVideoProcessingResultDto;
}

export class FailVideoProcessingDto {
  @ApiProperty({ description: 'Video ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Processing error message' })
  @IsString()
  @IsNotEmpty()
  error: string;
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
