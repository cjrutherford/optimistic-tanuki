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
  description: string;
  ownerId: string;
  ownerProfileId: string;
  appScope: string;
  isPrivate: boolean;
  joinPolicy: CommunityJoinPolicy;
  tags: CommunityTag[];
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommunityDto {
  name: string;
  description?: string;
  isPrivate?: boolean;
  joinPolicy?: CommunityJoinPolicy;
  tags?: string[];
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  isPrivate?: boolean;
  joinPolicy?: CommunityJoinPolicy;
  tags?: string[];
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
