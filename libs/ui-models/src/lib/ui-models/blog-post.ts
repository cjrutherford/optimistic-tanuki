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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBlogPostDto {
  title: string;
  content: string;
  authorId: string;
}

export interface UpdateBlogPostDto {
  id: string;
  title?: string;
  content?: string;
  authorId?: string;
}

export interface BlogPostQueryDto {
  id?: string;
  title?: string;
  content?: string;
  authorId?: string;
  createdAt?: [Date, Date];
  updatedAt?: [Date, Date];
}
