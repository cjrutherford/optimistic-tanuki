import { CommunityMembershipStatus } from './community.dto';

describe('Gateway community membership contract', () => {
  it('exposes the lifecycle statuses used by moderation', () => {
    expect(Object.values(CommunityMembershipStatus)).toEqual([
      'pending',
      'approved',
      'rejected',
      'suspended',
      'revoked',
    ]);
  });
});
