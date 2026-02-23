import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsArray,
  IsEnum,
  MaxLength,
  IsDateString,
  IsNumber,
} from 'class-validator';

export enum CommunityMembershipStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum CommunityMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
}

export enum CommunityJoinPolicy {
  PUBLIC = 'public',
  APPROVAL_REQUIRED = 'approval_required',
  INVITE_ONLY = 'invite_only',
}

export class CommunityTag {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;
}

export class CommunityDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  description: string;

  @ApiProperty()
  @IsString()
  ownerId: string;

  @ApiProperty()
  @IsString()
  ownerProfileId: string;

  @ApiProperty()
  @IsString()
  appScope: string;

  @ApiProperty()
  @IsBoolean()
  isPrivate: boolean;

  @ApiProperty({ enum: CommunityJoinPolicy })
  @IsEnum(CommunityJoinPolicy)
  joinPolicy: CommunityJoinPolicy;

  @ApiProperty({ type: [CommunityTag] })
  @IsArray()
  tags: CommunityTag[];

  @ApiProperty()
  memberCount: number;

  @ApiProperty()
  @IsDateString()
  createdAt: Date;

  @ApiProperty()
  @IsDateString()
  updatedAt: Date;
}

export class CreateCommunityDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ enum: CommunityJoinPolicy })
  @IsOptional()
  @IsEnum(CommunityJoinPolicy)
  joinPolicy?: CommunityJoinPolicy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateCommunityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ enum: CommunityJoinPolicy })
  @IsOptional()
  @IsEnum(CommunityJoinPolicy)
  joinPolicy?: CommunityJoinPolicy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class SearchCommunityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({ enum: CommunityJoinPolicy })
  @IsOptional()
  @IsEnum(CommunityJoinPolicy)
  joinPolicy?: CommunityJoinPolicy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class CommunityMemberDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsUUID()
  communityId: string;

  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  profileId: string;

  @ApiProperty({ enum: CommunityMemberRole })
  @IsEnum(CommunityMemberRole)
  role: CommunityMemberRole;

  @ApiProperty({ enum: CommunityMembershipStatus })
  @IsEnum(CommunityMembershipStatus)
  status: CommunityMembershipStatus;

  @ApiProperty()
  @IsDateString()
  joinedAt: Date;
}

export class JoinCommunityDto {
  @ApiProperty()
  @IsUUID()
  communityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileId?: string;
}

export class InviteToCommunityDto {
  @ApiProperty()
  @IsUUID()
  communityId: string;

  @ApiProperty()
  @IsString()
  inviteeUserId: string;
}

export class CommunityInviteDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsUUID()
  communityId: string;

  @ApiProperty()
  @IsString()
  inviterId: string;

  @ApiProperty()
  @IsString()
  inviteeId: string;

  @ApiProperty({ enum: CommunityMembershipStatus })
  @IsEnum(CommunityMembershipStatus)
  status: CommunityMembershipStatus;

  @ApiProperty()
  @IsDateString()
  createdAt: Date;
}

export class CommunityFeedOptions {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includePublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeFollowing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeCommunities?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  communityIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  offset?: number;
}
