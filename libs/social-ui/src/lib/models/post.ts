import { AttachmentDto } from './attachment';
import { CommentDto } from './comment';

export interface CrossAppCardDto {
  appId?: string;
  appName?: string;
  kind?: string;
  headline?: string;
  body?: string;
  ctaLabel?: string;
  targetPath?: string;
  channelSlug?: string;
  communitySlug?: string;
}

export interface CreatePostDto {
  title: string;
  content: string;
  attachments?: string[];
  profileId: string;
  communityId?: string;
  crossAppCard?: CrossAppCardDto;
}

export interface PostDto {
  id: string;
  title: string;
  content: string;
  attachments?: AttachmentDto[];
  userId: string;
  profileId: string;
  communityId?: string;
  createdAt: Date;
  updatedAt?: Date;
  links?: { url: string }[];
  comments?: CommentDto[];
  crossAppCard?: CrossAppCardDto;
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
  attachments?: string[];
  crossAppCard?: CrossAppCardDto;
}

export interface SearchPostDto {
  title?: string;
  content?: string;
  userId?: string;
  profileId?: string;
  communityId?: string;
  communityIds?: string[];
  visibility?: 'public' | 'followers';
}

export interface SearchPostOptions {
  orderBy?: 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
