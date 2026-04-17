import {
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  SearchCommunityDto,
  CommunityMemberDto,
  JoinCommunityDto,
  InviteToCommunityDto,
  CommunityInviteDto,
  CommunityTag,
  CommunityMembershipStatus,
  CommunityMemberRole,
  CommunityJoinPolicy,
  CommunityFeedOptions,
} from '@optimistic-tanuki/ui-models';

export {
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  SearchCommunityDto,
  CommunityMemberDto,
  JoinCommunityDto,
  InviteToCommunityDto,
  CommunityInviteDto,
  CommunityTag,
  CommunityMembershipStatus,
  CommunityMemberRole,
  CommunityJoinPolicy,
  CommunityFeedOptions,
};

export interface CommunityWithActivity extends CommunityDto {
  activityScore: number;
  postsLast30Days: number;
  commentsLast30Days: number;
  votesLast30Days: number;
  newMembersLast30Days: number;
}
