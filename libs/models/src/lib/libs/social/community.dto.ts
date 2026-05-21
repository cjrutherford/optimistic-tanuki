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

export enum LocalityType {
  CITY = 'city',
  TOWN = 'town',
  NEIGHBORHOOD = 'neighborhood',
  COUNTY = 'county',
  REGION = 'region',
}

export class CommunityTag {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;
}

export class CityHighlight {
  @ApiProperty()
  @IsString()
  headline!: string;

  @ApiProperty()
  @IsString()
  link!: string;

  @ApiProperty()
  @IsString()
  imageUrl!: string;
}

export class CommunityDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiProperty()
  @IsString()
  ownerId!: string;

  @ApiProperty()
  @IsString()
  ownerProfileId!: string;

  @ApiProperty()
  @IsString()
  appScope!: string;

  @ApiProperty()
  @IsBoolean()
  isPrivate!: boolean;

  @ApiProperty({ enum: CommunityJoinPolicy })
  @IsEnum(CommunityJoinPolicy)
  joinPolicy!: CommunityJoinPolicy;

  @ApiProperty({ type: [CommunityTag] })
  @IsArray()
  tags!: CommunityTag[];

  @ApiProperty()
  memberCount!: number;

  /** Locality-only fields — null for non-locality communities */
  @ApiPropertyOptional({ enum: LocalityType })
  @IsOptional()
  @IsEnum(LocalityType)
  localityType?: LocalityType | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminArea?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  population?: number | null;

  /** Locality highlights: structured POIs with headline, link, and image. */
  @ApiPropertyOptional({ type: [CityHighlight] })
  @IsOptional()
  @IsArray()
  highlights?: CityHighlight[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string | null;

  @ApiProperty()
  @IsDateString()
  createdAt!: Date;

  @ApiProperty()
  @IsDateString()
  updatedAt!: Date;
}

export class CreateCommunityDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bannerAssetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoAssetId?: string;

  @ApiProperty()
  @IsBoolean()
  createChatRoom = true;

  /** Locality-only fields — omit for non-locality communities */
  @ApiPropertyOptional({ enum: LocalityType })
  @IsOptional()
  @IsEnum(LocalityType)
  localityType?: LocalityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminArea?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  population?: number;

  @ApiPropertyOptional({
    description: 'Parent community ID for sub-communities',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  /** Locality highlights: structured POIs with headline, link, and image */
  @ApiPropertyOptional({ type: [CityHighlight] })
  @IsOptional()
  @IsArray()
  highlights?: CityHighlight[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
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
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: LocalityType })
  @IsOptional()
  @IsEnum(LocalityType)
  localityType?: LocalityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminArea?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  population?: number;

  @ApiPropertyOptional({ type: [CityHighlight] })
  @IsOptional()
  @IsArray()
  highlights?: CityHighlight[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Parent community ID for sub-communities',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

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
  id!: string;

  @ApiProperty()
  @IsUUID()
  communityId!: string;

  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsString()
  profileId!: string;

  @ApiProperty({ enum: CommunityMemberRole })
  @IsEnum(CommunityMemberRole)
  role!: CommunityMemberRole;

  @ApiProperty({ enum: CommunityMembershipStatus })
  @IsEnum(CommunityMembershipStatus)
  status!: CommunityMembershipStatus;

  @ApiProperty()
  @IsDateString()
  joinedAt!: Date;
}

export class JoinCommunityDto {
  @ApiProperty()
  @IsUUID()
  communityId!: string;

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
  communityId!: string;

  @ApiProperty()
  @IsString()
  inviteeUserId!: string;
}

export class CommunityInviteDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsUUID()
  communityId!: string;

  @ApiProperty()
  @IsString()
  inviterId!: string;

  @ApiProperty()
  @IsString()
  inviteeId!: string;

  @ApiProperty({ enum: CommunityMembershipStatus })
  @IsEnum(CommunityMembershipStatus)
  status!: CommunityMembershipStatus;

  @ApiProperty()
  @IsDateString()
  createdAt!: Date;
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

export enum ElectionStatus {
  PENDING = 'pending',
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export class ElectionCandidateDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsUUID()
  electionId!: string;

  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsUUID()
  profileId!: string;

  @ApiProperty()
  @IsNumber()
  voteCount!: number;

  @ApiProperty()
  @IsBoolean()
  isWithdrawn!: boolean;

  @ApiProperty()
  @IsDateString()
  nominatedAt!: Date;
}

export class CommunityElectionDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsUUID()
  communityId!: string;

  @ApiProperty({ enum: ElectionStatus })
  @IsEnum(ElectionStatus)
  status!: ElectionStatus;

  @ApiProperty()
  @IsDateString()
  startedAt!: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  winnerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  winnerProfileId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  initiatedBy?: string;

  @ApiPropertyOptional({ type: [ElectionCandidateDto] })
  @IsOptional()
  @IsArray()
  candidates?: ElectionCandidateDto[];
}

export class StartElectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: Date;
}

export class NominateDto { }

export class VoteDto {
  @ApiProperty()
  @IsUUID()
  candidateId!: string;
}

export class CloseElectionDto {
  @ApiProperty()
  @IsUUID()
  electionId!: string;
}

export class AppointManagerDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsUUID()
  profileId!: string;
}
