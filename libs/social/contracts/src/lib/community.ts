import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export type CommunityLocalityType =
  | 'city'
  | 'town'
  | 'neighborhood'
  | 'county'
  | 'region';

/**
 * Canonical community read shape (G2). Scalar fields from
 * `apps/social/src/entities/community.entity.ts`; relations and audit stay
 * server-side.
 */
export class CommunityDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({
    required: false,
    enum: ['city', 'town', 'neighborhood', 'county', 'region'],
  })
  @IsOptional()
  @IsIn(['city', 'town', 'neighborhood', 'county', 'region'])
  localityType?: CommunityLocalityType | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  population?: number | null;
}

/** `CommunityCommands.CREATE` — the G2 canonical create path. */
export class CreateCommunityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  slug?: string;
}

/** `CommunityCommands.JOIN` / `LEAVE` — membership by profile. */
export class JoinCommunityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;
}

export class LeaveCommunityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;
}

/** `CommunityCommands.INVITE_BY_EMAIL` — token invite addressed to an email. */
export class InviteByEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  inviteeUserId?: string;
}

/** `CommunityCommands.ACCEPT_INVITE_BY_TOKEN` — claim an email invitation. */
export class AcceptInviteByTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}

/**
 * `CommunityCommands.FIND_INVITE_BY_TOKEN` — public preview of an invitation
 * (community name + expiry). Never carries the token or invitee identity.
 */
export class CommunityInvitePreviewDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  communitySlug?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  expiresAt?: string | null;
}

/** `CommunityCommands.FIND` — fetch one community by id. */
export class CommunityRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;
}

/** Actor comes from the gateway session; internal approved-roster lookup stays separate. */
export class CommunityRosterQueryDto {
  @IsString() @IsNotEmpty() communityId!: string;
  @IsOptional() @IsString() requestingProfileId?: string;
}

export class CommunityChatMembershipsQueryDto {
  @IsString() @IsNotEmpty() profileId!: string;
}

/** Internal, authenticated recovery reads are bound to the caller's observed source epoch. */
export interface DirectoryEpochRead { expectedSourceEpoch: string; secret?: string }
export interface DirectoryCensusRead extends DirectoryEpochRead { cursor?: string; limit?: number }
export interface DirectorySnapshotRead extends DirectoryEpochRead { id: string }
export interface DirectoryMembershipRead extends DirectoryEpochRead { revision: string; communityId: string; expectedEventNonce: string }
export interface DirectoryEventIdentity { revision: string; communityId: string; eventNonce: string; sourceEpoch: string | null }
export interface DirectoryRegisterScanRead { sourceEpoch: string; afterCommunityId: string | null; limit: number; secret?: string }
export interface DirectoryRegisterExactRead { sourceEpoch: string; communityId: string; changeToken: string; secret?: string }

/** Private source-incarnation identity; not proof of Directory authority. */
export interface DirectoryRegisterSourceIdentity { sourceEpoch: string; activationId: string; socialGeneration: string }
export interface DirectoryRegisterScanV2 { identity: DirectoryRegisterSourceIdentity; afterCommunityId: string | null; limit: number; secret?: string }
export interface DirectoryRegisterReadV2 { identity: DirectoryRegisterSourceIdentity; communityId: string; changeToken: string; secret?: string }
export interface DirectoryRegisterCurrentV2 { identity: DirectoryRegisterSourceIdentity; communityId: string; secret?: string }

export interface DirectorySourceCensusV2 { identity: DirectoryRegisterSourceIdentity; afterCommunityId: string | null; limit: number; secret?: string }
export interface DirectorySourceRepairV2 { identity: DirectoryRegisterSourceIdentity; communityId: string; secret?: string }

/** Internal, incarnation-bound geography input; this is not a verified boundary. */
export interface DirectoryGeographySnapshot {
  communityId: string;
  name: string | null;
  city: string | null;
  adminArea: string | null;
  countryCode: string | null;
  localityType: 'city' | 'town';
  referencePoint: [number, number] | null;
}
export type DirectoryGeographyCurrent = {status:'absent'} | {status:'current'; changeToken:string; geography:DirectoryGeographySnapshot | null};
