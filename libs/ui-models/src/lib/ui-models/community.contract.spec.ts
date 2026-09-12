import { CommunityMembershipStatus, CommunityMemberDto } from './community';

describe('Community membership contract', () => {
  it('exposes the lifecycle statuses used by moderation', () => {
    expect(Object.values(CommunityMembershipStatus)).toEqual([
      'pending',
      'approved',
      'rejected',
      'suspended',
      'revoked',
    ]);
  });

  it('types suspended and revoked members through the shared DTO', () => {
    const member: CommunityMemberDto = {
      id: 'member-1',
      communityId: 'community-1',
      userId: 'user-1',
      profileId: 'profile-1',
      role: 'member' as CommunityMemberDto['role'],
      status: CommunityMembershipStatus.REVOKED,
      joinedAt: new Date(),
    };

    expect(member.status).toBe('revoked');
  });
});
