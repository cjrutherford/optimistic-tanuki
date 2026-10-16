import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  MaxLength,
  MinLength,
  IsNotEmpty,
  IsIn,
  IsArray,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AssetAudienceRestrictionDto {
  @ApiProperty({ enum: ['owner', 'followers', 'community'] })
  @IsIn(['owner', 'followers', 'community'])
  type!: 'owner' | 'followers' | 'community';

  @ApiProperty({ description: 'Profile whose audience governs this asset' })
  @IsString()
  @IsUUID()
  profileId!: string;

  @ApiProperty({
    required: false,
    description: 'Community that can access this asset',
  })
  @ValidateIf((restriction) => restriction.type === 'community')
  @IsUUID()
  communityId?: string;
}

export type AssetAudienceRestriction =
  | { type: 'owner' | 'followers'; profileId: string }
  | { type: 'community'; profileId: string; communityId: string }
  /** Reserved for Assets GUARDIAN_CREATE. Generic callers must reject it. */
  | { type: 'guardian-staged'; profileId: string; appId: string };

export type AssetOriginKind = 'ordinary' | 'guardian-staged';

export type GuardianMediaResourceType = 'post' | 'comment';

export interface GuardianPublishedAssetGrantContext {
  assetId: string;
  dependentProfileId: string;
  appId: string;
  viewerProfileId: string | null;
  resourceType?: GuardianMediaResourceType;
  resourceId?: string;
}

export interface InternalGuardianMediaAssertion {
  version: 1;
  assetId: string;
  viewerUserId: string | null;
  viewerProfileId: string | null;
  appId: string;
  dependentProfileId: string;
  resourceType: GuardianMediaResourceType | null;
  resourceId: string | null;
  /** Canonical public gateway path and the internal Assets route, both request-bound. */
  path: string;
  internalPath: string;
  range: string | null;
  accessMode: 'published' | 'guardian-library' | 'dependent-owner';
  issuedAt: number;
}

export interface AssetContentAudienceReference {
  restrictions: AssetAudienceRestriction[];
  communityIds: string[];
}

export enum AssetType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
}

export enum StorageStrategy {
  LOCAL_BLOCK_STORAGE = 'local_block_storage',
  REMOTE_BLOCK_STORAGE = 'remote_block_storage',
  DATABASE_STORAGE = 'database_storage',
}

export class CreateAssetDto {
  @ApiProperty({ description: 'Asset ID', required: false })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({
    description: 'Asset filename',
    example: 'profile-picture.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: 'Profile ID of the asset owner' })
  @IsString()
  @IsUUID()
  profileId!: string;

  @ApiProperty({ description: 'Asset type', enum: AssetType })
  @IsEnum(AssetType)
  type!: AssetType;

  @ApiProperty({
    description: 'Optional content for in-memory operations',
    required: false,
  })
  @IsOptional()
  content?: string | Buffer;

  @ApiProperty({
    description: 'Optional existing file path to ingest without inline content',
    required: false,
  })
  @IsOptional()
  @IsString()
  sourcePath?: string;

  @ApiProperty({
    description: 'File extension',
    example: 'jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  fileExtension?: string;

  /**
   * Optional owning community for content that is private while an upload or
   * edit is in progress. The gateway validates this against the session and
   * current community before it reaches the asset service.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  /** Existing listing context for a profile-owned edit after community leave. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  classifiedAdId?: string;

  /** Optional, server-validated private audience for an in-progress upload. */
  @ApiProperty({ type: [AssetAudienceRestrictionDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssetAudienceRestrictionDto)
  audienceRestrictions?: AssetAudienceRestriction[];
}

export class AssetDto {
  @ApiProperty({ description: 'Asset ID' })
  id!: string;

  @ApiProperty({ description: 'Asset filename' })
  name!: string;

  @ApiProperty({ description: 'Asset type', enum: AssetType })
  type!: AssetType;

  @ApiProperty({ description: 'Storage strategy', enum: StorageStrategy })
  storageStrategy!: StorageStrategy;

  @ApiProperty({ description: 'Storage path' })
  storagePath!: string;

  @ApiProperty({ description: 'Profile ID of owner' })
  profileId!: string;

  @ApiProperty({ description: 'Optional content', required: false })
  content?: string | Buffer;
}

export class AssetHandle {
  @ApiProperty({ description: 'Asset ID' })
  @IsString()
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'Profile ID', required: false })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}

export class AssetListQuery {
  @ApiProperty({ description: 'Profile ID to filter assets by' })
  @IsString()
  @IsUUID()
  profileId!: string;

  @ApiProperty({
    description: 'Optional asset type filter',
    enum: AssetType,
    required: false,
  })
  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;
}
