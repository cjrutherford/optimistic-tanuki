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

export interface CommunityTag {
  id: string;
  name: string;
}

export interface CommunityDto {
  id: string;
  name: string;
  slug?: string | null;
  parentId?: string | null;
  description: string;
  ownerId: string;
  ownerProfileId: string;
  managerId?: string | null;
  managerProfileId?: string | null;
  appScope: string;
  isPrivate: boolean;
  joinPolicy: CommunityJoinPolicy;
  tags: CommunityTag[];
  memberCount: number;
  bannerAssetId?: string;
  bannerUrl?: string;
  logoAssetId?: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  memberIds?: string[];
  memberUserIds?: string[];
  ownerIds?: string[];
}

export interface CreateCommunityDto {
  name: string;
  slug?: string;
  parentId?: string | null;
  description?: string;
  isPrivate?: boolean;
  joinPolicy?: CommunityJoinPolicy;
  tags?: string[];
  bannerAssetId?: string;
  logoAssetId?: string;
}

export interface UpdateCommunityDto {
  name?: string;
  slug?: string;
  parentId?: string | null;
  description?: string;
  isPrivate?: boolean;
  joinPolicy?: CommunityJoinPolicy;
  tags?: string[];
  bannerAssetId?: string;
  logoAssetId?: string;
}

export interface SearchCommunityDto {
  id?: string;
  name?: string;
  description?: string;
  ownerId?: string;
  isPrivate?: boolean;
  joinPolicy?: CommunityJoinPolicy;
  tags?: string[];
}

export interface CommunityMemberDto {
  id: string;
  communityId: string;
  userId: string;
  profileId: string;
  role: CommunityMemberRole;
  status: CommunityMembershipStatus;
  joinedAt: Date;
}

export interface JoinCommunityDto {
  communityId: string;
  userId?: string;
  profileId?: string;
}

export interface InviteToCommunityDto {
  communityId: string;
  inviteeUserId: string;
}

export interface CommunityInviteDto {
  id: string;
  communityId: string;
  inviterId: string;
  inviteeId: string;
  status: CommunityMembershipStatus;
  createdAt: Date;
}

export interface CommunityFeedOptions {
  includePublic?: boolean;
  includeFollowing?: boolean;
  includeCommunities?: boolean;
  communityIds?: string[];
  limit?: number;
  offset?: number;
}

export enum ElectionStatus {
  PENDING = 'pending',
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export interface ElectionCandidateDto {
  id: string;
  electionId: string;
  userId: string;
  profileId: string;
  voteCount: number;
  isWithdrawn: boolean;
  nominatedAt: Date;
}

export interface CommunityElectionDto {
  id: string;
  communityId: string;
  status: ElectionStatus;
  startedAt: Date;
  endsAt?: Date | null;
  winnerId?: string | null;
  winnerProfileId?: string | null;
  initiatedBy?: string;
  candidates?: ElectionCandidateDto[];
}

export interface StartElectionDto {
  endsAt?: Date;
}

export interface ElectionVoteDto {
  candidateId: string;
}

export interface CloseElectionDto {
  electionId: string;
}

export interface AppointManagerDto {
  userId: string;
  profileId: string;
}
