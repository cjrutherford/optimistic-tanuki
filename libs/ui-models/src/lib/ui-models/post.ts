import { PostThemeConfig } from './post-theme-config';

export interface PostDto {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  profileId: string;
  themeConfig?: PostThemeConfig;
}

export interface CreatePostDto {
  title: string;
  content: string;
  userId?: string;
  profileId?: string;
  themeConfig?: PostThemeConfig;
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
  themeConfig?: PostThemeConfig;
}
