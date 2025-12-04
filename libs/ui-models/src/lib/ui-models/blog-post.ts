/**
 * Blog post DTOs for Angular UI components.
 * Mirrors the types from @optimistic-tanuki/models but kept separate
 * to maintain separation between Angular and NestJS code.
 */

export interface BlogPostDto {
  id: string;
  title: string;
  content: string;
  authorId: string;
  isDraft: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBlogPostDto {
  title: string;
  content: string;
  authorId: string;
  isDraft?: boolean;
}

export interface UpdateBlogPostDto {
  id: string;
  title?: string;
  content?: string;
  authorId?: string;
  isDraft?: boolean;
}

export interface BlogPostQueryDto {
  id?: string;
  title?: string;
  content?: string;
  authorId?: string;
  isDraft?: boolean;
  createdAt?: [Date, Date];
  updatedAt?: [Date, Date];
}
