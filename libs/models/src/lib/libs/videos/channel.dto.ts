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
  IsNumber,
  Min,
  Max,
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

  @ApiProperty({ description: 'Optional owned business page', required: false })
  @IsOptional()
  @IsUUID()
  businessPageId?: string;

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

  @ApiProperty({
    description: 'Latitude for this channel anchor',
    required: false,
    example: 32.0809,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  anchorLat?: number;

  @ApiProperty({
    description: 'Longitude for this channel anchor',
    required: false,
    example: -81.0912,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  anchorLng?: number;
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

  @ApiProperty({ description: 'Optional owned business page', required: false })
  @IsOptional()
  @IsUUID()
  businessPageId?: string | null;

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

  @ApiProperty({ description: 'Channel anchor latitude', required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  anchorLat?: number;

  @ApiProperty({ description: 'Channel anchor longitude', required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  anchorLng?: number;
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

  @ApiProperty({ description: 'Optional owned business page' })
  businessPageId?: string | null;

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

  @ApiProperty({ description: 'Channel anchor latitude' })
  anchorLat?: number;

  @ApiProperty({ description: 'Channel anchor longitude' })
  anchorLng?: number;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;
}

export class LiveHandoffDto {
  @ApiProperty({ example: 'ready' })
  status: 'idle' | 'standby' | 'ready' | 'ended';

  @ApiProperty({ required: false, example: '/watch/live/ot-live' })
  playbackPath?: string | null;

  @ApiProperty()
  requiresAuth: boolean;

  @ApiProperty({ example: 'gateway-token-exchange' })
  tokenContract: 'none' | 'gateway-token-exchange';

  @ApiProperty({ example: 'planned-channel-anchor' })
  localityPolicy: 'none' | 'planned-channel-anchor';
}

export class LiveMediaTransportDto {
  @ApiProperty({ example: 'livekit' })
  type: 'livekit';

  @ApiProperty({ example: 'wss://live.example.com' })
  serverUrl: string;

  @ApiProperty({ example: 'metrocast-community-session' })
  roomName: string;

  @ApiProperty()
  token: string;

  @ApiProperty()
  expiresAt: Date;
}

export class LivePlaybackTokenDto {
  @ApiProperty({ example: 'ready' })
  status: 'ready' | 'unavailable';

  @ApiProperty({ required: false })
  token: string | null;

  @ApiProperty({ required: false })
  sessionId: string | null;

  @ApiProperty({ required: false })
  playbackUrl: string | null;

  @ApiProperty({ required: false, type: () => LiveMediaTransportDto })
  mediaTransport?: LiveMediaTransportDto | null;

  @ApiProperty({ required: false })
  expiresAt: Date | null;
}

export class LivePlaybackTokenValidationDto {
  @ApiProperty()
  valid: boolean;

  @ApiProperty({ required: false })
  sessionId?: string;

  @ApiProperty({ required: false })
  playbackUrl?: string | null;

  @ApiProperty({ required: false, type: () => LiveMediaTransportDto })
  mediaTransport?: LiveMediaTransportDto | null;

  @ApiProperty({ required: false })
  expiresAt?: Date;
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

export class PlaylistItemDto {
  @ApiProperty({ example: 'scheduled' })
  kind: 'live' | 'scheduled' | 'rerun' | 'ad' | 'filler' | 'offline';

  @ApiProperty()
  reason: string;

  @ApiProperty({ required: false })
  sessionId?: string | null;

  @ApiProperty({ required: false })
  blockId?: string | null;

  @ApiProperty({ required: false })
  videoId?: string | null;

  @ApiProperty({ required: false })
  placementType?: 'pre-roll' | 'mid-roll' | 'post-roll' | null;

  @ApiProperty({ required: false })
  mediaUrl?: string | null;

  @ApiProperty({ required: false })
  decidedAt?: Date | null;
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
  currentMode: 'offline' | 'scheduled' | 'live' | 'replay';

  @ApiProperty({ required: false })
  activeProgramBlockId?: string | null;

  @ApiProperty({ required: false })
  activeLiveSessionId?: string | null;

  @ApiProperty({ required: false })
  activeVideoId?: string | null;

  @ApiProperty({ required: false, type: () => PlaylistItemDto })
  activePlaylistItem?: PlaylistItemDto | null;

  @ApiProperty({ required: false, type: () => LiveSessionDto })
  activeLiveSession?: LiveSessionDto | null;

  @ApiProperty({ required: false, type: () => LiveHandoffDto })
  liveHandoff?: LiveHandoffDto | null;

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
