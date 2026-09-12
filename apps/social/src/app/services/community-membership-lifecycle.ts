import { CommunityMembershipStatus } from '../../entities/community-member.entity';

export type CommunityLifecycleState =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'revoked';

export interface CommunityMembershipAuditEvent {
  workspaceId: string;
  subjectId: string;
  actorId: string;
  actor: 'owner' | 'moderator' | 'system';
  action: 'activate' | 'suspend' | 'revoke';
  from: CommunityLifecycleState;
  to: CommunityLifecycleState;
}

export function communityMembershipStatusToLifecycleState(
  status: CommunityMembershipStatus
): CommunityLifecycleState {
  switch (status) {
    case CommunityMembershipStatus.PENDING:
      return 'pending';
    case CommunityMembershipStatus.SUSPENDED:
      return 'suspended';
    case CommunityMembershipStatus.REVOKED:
    case CommunityMembershipStatus.REJECTED:
      return 'revoked';
    case CommunityMembershipStatus.APPROVED:
    default:
      return 'active';
  }
}

export function lifecycleStateToCommunityMembershipStatus(
  state: CommunityLifecycleState
): CommunityMembershipStatus {
  switch (state) {
    case 'pending':
      return CommunityMembershipStatus.PENDING;
    case 'suspended':
      return CommunityMembershipStatus.SUSPENDED;
    case 'revoked':
      return CommunityMembershipStatus.REVOKED;
    case 'active':
    default:
      return CommunityMembershipStatus.APPROVED;
  }
}
