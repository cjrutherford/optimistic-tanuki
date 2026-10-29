import { AttachmentDto } from './attachment';
import { CommentDto } from './comment';

export interface CreatePostDto {
  title: string;
  content: string;
  attachments?: string[];
  profileId: string;
  communityId?: string;
  visibility?: 'public' | 'followers' | 'community';
}

export interface PostDto {
  id: string;
  title: string;
  content: string;
  attachments?: AttachmentDto[];
  userId: string;
  profileId: string;
  communityId?: string | null;
  /** Optional while older websocket payloads are still in flight. */
  visibility?: 'public' | 'followers' | 'community';
  publicAudienceExplicit?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  links?: { url: string }[];
  comments?: CommentDto[];
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
  attachments?: string[];
  visibility?: 'public' | 'followers' | 'community';
}

export interface SearchPostDto {
  title?: string;
  content?: string;
  userId?: string;
  profileId?: string;
  communityId?: string;
  communityIds?: string[];
  visibility?: 'public' | 'followers' | 'community';
}

export interface SearchPostOptions {
  orderBy?: 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
