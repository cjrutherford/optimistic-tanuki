/**
 * Blog component DTOs for Angular UI components.
 * Mirrors the types from @optimistic-tanuki/models but kept separate
 * to maintain separation between Angular and NestJS code.
 */

export interface BlogComponentDto {
  id: string;
  blogPostId: string;
  instanceId: string;
  componentType: string;
  componentData: Record<string, any>;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBlogComponentDto {
  blogPostId: string;
  instanceId: string;
  componentType: string;
  componentData: Record<string, any>;
  position: number;
}

export interface UpdateBlogComponentDto {
  componentData?: Record<string, any>;
  position?: number;
}

export interface BlogComponentQueryDto {
  id?: string;
  blogPostId?: string;
  instanceId?: string;
  componentType?: string;
}