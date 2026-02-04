/**
 * Video Data Transfer Objects
 * Unified video-related interfaces for the video streaming platform
 */

/**
 * Video entity interface
 * Represents a video in the system with all metadata
 */
export interface VideoDto {
  id: string;
  title: string;
  description?: string;
  assetId: string;
  thumbnailAssetId?: string;
  channelId: string;
  durationSeconds?: number;
  resolution?: string;
  encoding?: string;
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
  thumbnailAssetId?: string;
  channelId: string;
  durationSeconds?: number;
  resolution?: string;
  encoding?: string;
  visibility?: 'public' | 'unlisted' | 'private';
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
