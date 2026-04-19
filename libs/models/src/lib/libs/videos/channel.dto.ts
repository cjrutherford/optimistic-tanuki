import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  MinLength,
  IsNotEmpty,
  IsInt,
  IsBoolean,
} from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({ description: 'Channel name', example: 'My Gaming Channel' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Channel description',
    example: 'Gaming videos and tutorials',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Profile ID of the channel owner' })
  @IsString()
  @IsUUID()
  profileId: string;

  @ApiProperty({ description: 'User ID of the channel owner' })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Banner asset ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  bannerAssetId?: string;

  @ApiProperty({
    description: 'Avatar asset ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  avatarAssetId?: string;

  @ApiProperty({
    description: 'Canonical social community ID for this channel',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiProperty({
    description: 'Canonical social community slug for this channel',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  communitySlug?: string;

  @ApiProperty({
    description: 'Community join policy',
    required: false,
    example: 'public',
  })
  @IsOptional()
  @IsString()
  joinPolicy?: string;

  @ApiProperty({
    description: 'Channel community timezone',
    required: false,
    example: 'America/New_York',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateChannelDto {
  @ApiProperty({ description: 'Channel name', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: 'Channel description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Banner asset ID', required: false })
  @IsOptional()
  @IsUUID()
  bannerAssetId?: string;

  @ApiProperty({ description: 'Avatar asset ID', required: false })
  @IsOptional()
  @IsUUID()
  avatarAssetId?: string;

  @ApiProperty({ description: 'Community slug', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  communitySlug?: string;

  @ApiProperty({ description: 'Community join policy', required: false })
  @IsOptional()
  @IsString()
  joinPolicy?: string;

  @ApiProperty({ description: 'Channel community timezone', required: false })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class ChannelDto {
  @ApiProperty({ description: 'Channel ID' })
  id: string;

  @ApiProperty({ description: 'Channel name' })
  name: string;

  @ApiProperty({ description: 'Channel description' })
  description?: string;

  @ApiProperty({ description: 'Profile ID' })
  profileId: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Banner asset ID' })
  bannerAssetId?: string;

  @ApiProperty({ description: 'Avatar asset ID' })
  avatarAssetId?: string;

  @ApiProperty({ description: 'Canonical community ID' })
  communityId: string;

  @ApiProperty({ description: 'Canonical community slug' })
  communitySlug?: string;

  @ApiProperty({ description: 'Community join policy' })
  joinPolicy?: string;

  @ApiProperty({ description: 'Community app scope' })
  appScope?: string;

  @ApiProperty({ description: 'Community member count' })
  memberCount?: number;

  @ApiProperty({ description: 'Whether feed/video viewing is public' })
  isPublic?: boolean;

  @ApiProperty({ description: 'Channel community timezone' })
  timezone?: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;
}

export class ChannelFeedDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  channelId: string;

  @ApiProperty()
  communityId: string;

  @ApiProperty({ example: 'America/New_York' })
  timezone: string;

  @ApiProperty({ example: 'scheduled' })
  currentMode: 'offline' | 'scheduled' | 'live';

  @ApiProperty({ required: false })
  activeProgramBlockId?: string | null;

  @ApiProperty({ required: false })
  activeLiveSessionId?: string | null;

  @ApiProperty({ required: false })
  activeVideoId?: string | null;

  @ApiProperty()
  lastTransitionAt: Date;
}

export class CreateProgramBlockDto {
  @ApiProperty()
  @IsUUID()
  communityId: string;

  @ApiProperty()
  @IsUUID()
  channelId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  videoId?: string;

  @ApiProperty({ example: 'prerecorded' })
  @IsString()
  blockType: 'prerecorded' | 'live_window';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty()
  @IsString()
  startsAt: string;

  @ApiProperty()
  @IsString()
  endsAt: string;
}

export class UpdateProgramBlockDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  videoId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  blockType?: 'prerecorded' | 'live_window';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  startsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endsAt?: string;
}

export class ProgramBlockDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  communityId: string;

  @ApiProperty()
  channelId: string;

  @ApiProperty({ required: false })
  videoId?: string | null;

  @ApiProperty({ example: 'prerecorded' })
  blockType: 'prerecorded' | 'live_window';

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ example: 'scheduled' })
  status: 'scheduled' | 'live' | 'completed' | 'interrupted' | 'cancelled';

  @ApiProperty()
  startsAt: Date;

  @ApiProperty()
  endsAt: Date;

  @ApiProperty({ required: false })
  actualStartAt?: Date | null;

  @ApiProperty({ required: false })
  actualEndAt?: Date | null;
}

export class StartLiveSessionDto {
  @ApiProperty()
  @IsUUID()
  communityId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  channelId?: string;

  @ApiProperty()
  @IsUUID()
  startedByUserId: string;

  @ApiProperty()
  @IsUUID()
  startedByProfileId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  thumbnailAssetId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  liveSourceUrl?: string;
}

export class StopLiveSessionDto {
  @ApiProperty()
  @IsUUID()
  communityId: string;
}

export class LiveSessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  communityId: string;

  @ApiProperty({ required: false })
  channelId?: string | null;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ example: 'live' })
  status: 'live' | 'ended';

  @ApiProperty()
  startedByUserId: string;

  @ApiProperty()
  startedByProfileId: string;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty({ required: false })
  endedAt?: Date | null;

  @ApiProperty({ required: false })
  thumbnailAssetId?: string | null;

  @ApiProperty({ required: false })
  liveSourceUrl?: string | null;
}
