import { IsString, IsOptional, IsEnum, IsUUID, IsIn } from 'class-validator';

export class SharePostRequestDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsIn(['public', 'followers', 'community'])
  visibility?: 'public' | 'followers' | 'community';

  @IsOptional()
  @IsUUID()
  communityId?: string;
}

export class CreatePostShareDto {
  @IsString()
  @IsUUID()
  originalPostId: string;

  @IsString()
  @IsUUID()
  sharedById: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsEnum(['public', 'followers', 'community'])
  visibility?: 'public' | 'followers' | 'community';

  @IsOptional()
  @IsUUID()
  communityId?: string;
}

export class PostShareDto {
  id: string;
  originalPostId: string;
  sharedById: string;
  comment: string;
  visibility: 'public' | 'followers' | 'community';
  communityId: string;
  createdAt: Date;
}
