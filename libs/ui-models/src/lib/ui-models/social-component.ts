/**
 * Social component DTOs for Angular UI components.
 * Mirrors the types from @optimistic-tanuki/models but kept separate
 * to maintain separation between Angular and NestJS code.
 */

export interface SocialComponentDto {
  id: string;
  postId: string;
  instanceId: string;
  componentType: string;
  componentData: Record<string, any>;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSocialComponentDto {
  postId: string;
  instanceId: string;
  componentType: string;
  componentData: Record<string, any>;
  position: number;
}

export interface UpdateSocialComponentDto {
  componentData?: Record<string, any>;
  position?: number;
}

export interface SocialComponentQueryDto {
  id?: string;
  postId?: string;
  instanceId?: string;
  componentType?: string;
}
