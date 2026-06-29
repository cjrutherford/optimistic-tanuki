import { PostThemeConfig } from './post-theme-config';

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

export interface PostDto {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  profileId: string;
  themeConfig?: PostThemeConfig;
  crossAppCard?: CrossAppCardDto;
}

export interface CreatePostDto {
  title: string;
  content: string;
  userId?: string;
  profileId?: string;
  themeConfig?: PostThemeConfig;
  crossAppCard?: CrossAppCardDto;
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
  themeConfig?: PostThemeConfig;
  crossAppCard?: CrossAppCardDto;
}
