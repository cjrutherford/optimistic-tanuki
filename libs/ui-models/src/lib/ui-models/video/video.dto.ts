/**
 * Video Data Transfer Objects
 * Unified video-related interfaces for the video streaming platform
 */

/**
 * Video entity interface
 * Represents a video in the system with all metadata
 */
export type VideoProcessingStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed';

export interface VideoDto {
  id: string;
  title: string;
  description?: string;
  assetId: string;
  sourceAssetId?: string;
  playbackAssetId?: string;
  hlsManifestAssetId?: string;
  thumbnailAssetId?: string;
  channelId: string;
  communityId?: string;
  durationSeconds?: number;
  resolution?: string;
  encoding?: string;
  processingStatus: VideoProcessingStatus;
  processingError?: string;
  viewCount: number;
  likeCount: number;
  visibility: 'public' | 'unlisted' | 'private';
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  channel?: ChannelDto;
}

/**
 * Channel entity interface
 * Represents a video channel with metadata
 */
export interface ChannelDto {
  id: string;
  name: string;
  description?: string;
  profileId: string;
  userId: string;
  communityId: string;
  communitySlug?: string;
  joinPolicy?: string;
  appScope?: string;
  memberCount?: number;
  isPublic?: boolean;
  timezone?: string;
  bannerAssetId?: string;
  avatarAssetId?: string;
  subscriberCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Channel subscription entity interface
 */
export interface ChannelSubscriptionDto {
  id: string;
  channelId: string;
  userId: string;
  profileId: string;
  subscribedAt: Date;
}

/**
 * Create video DTO
 * Data required to create a new video
 */
export interface CreateVideoDto {
  title: string;
  description?: string;
  assetId: string;
  sourceAssetId?: string;
  thumbnailAssetId?: string;
  channelId: string;
  durationSeconds?: number;
  resolution?: string;
  encoding?: string;
  visibility?: 'public' | 'unlisted' | 'private';
  processingStatus?: VideoProcessingStatus;
}

/**
 * Update video DTO
 * Data that can be updated for an existing video
 */
export interface UpdateVideoDto {
  title?: string;
  description?: string;
  thumbnailAssetId?: string;
  visibility?: 'public' | 'unlisted' | 'private';
}

/**
 * Create channel DTO
 * Data required to create a new channel
 */
export interface CreateChannelDto {
  name: string;
  description?: string;
  profileId: string;
  userId: string;
  communityId?: string;
  communitySlug?: string;
  joinPolicy?: string;
  timezone?: string;
  bannerAssetId?: string;
  avatarAssetId?: string;
}

/**
 * Update channel DTO
 * Data that can be updated for an existing channel
 */
export interface UpdateChannelDto {
  name?: string;
  description?: string;
  communitySlug?: string;
  joinPolicy?: string;
  timezone?: string;
  bannerAssetId?: string;
  avatarAssetId?: string;
}

/**
 * Subscribe to channel DTO
 * Data required to subscribe to a channel
 */
export interface SubscribeDto {
  channelId: string;
  userId: string;
  profileId: string;
}

export interface ChannelFeedDto {
  id: string;
  channelId: string;
  communityId: string;
  timezone: string;
  currentMode: 'offline' | 'scheduled' | 'live';
  activeProgramBlockId?: string | null;
  activeLiveSessionId?: string | null;
  activeVideoId?: string | null;
  lastTransitionAt: Date;
}

export interface CreateProgramBlockDto {
  communityId: string;
  channelId: string;
  videoId?: string;
  blockType: 'prerecorded' | 'live_window';
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
}

export interface UpdateProgramBlockDto {
  videoId?: string | null;
  blockType?: 'prerecorded' | 'live_window';
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
}

export interface ProgramBlockDto {
  id: string;
  communityId: string;
  channelId: string;
  videoId?: string | null;
  blockType: 'prerecorded' | 'live_window';
  title: string;
  description?: string;
  status: 'scheduled' | 'live' | 'completed' | 'interrupted' | 'cancelled';
  startsAt: Date;
  endsAt: Date;
  actualStartAt?: Date | null;
  actualEndAt?: Date | null;
}

export interface StartLiveSessionDto {
  communityId: string;
  channelId?: string;
  startedByUserId: string;
  startedByProfileId: string;
  title: string;
  description?: string;
  thumbnailAssetId?: string;
  liveSourceUrl?: string;
}

export interface StopLiveSessionDto {
  communityId: string;
}

export interface LiveSessionDto {
  id: string;
  communityId: string;
  channelId?: string | null;
  title: string;
  description?: string;
  status: 'live' | 'ended';
  startedByUserId: string;
  startedByProfileId: string;
  startedAt: Date;
  endedAt?: Date | null;
  thumbnailAssetId?: string | null;
  liveSourceUrl?: string | null;
}
