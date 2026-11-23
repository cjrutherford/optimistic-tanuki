import {
  CommunityDto,
  CommunityMemberDto,
  CommunityMemberRole,
} from '@optimistic-tanuki/ui-models';
import { CommunityManagerRecord } from '../../services/community.service';

export type EntityTypeFilter = 'all' | 'community' | 'city' | 'member';
export type EntityHealth = 'healthy' | 'attention';

export interface SummaryMetric {
  label: string;
  value: string;
  detail: string;
}

export interface CommunityOpsEntity {
  id: string;
  entityType: 'community' | 'city' | 'member';
  title: string;
  subtitle: string;
  detail: string;
  health: EntityHealth;
  timestamp: string | Date;
  route: string;
  communityId?: string;
  localityType?: string;
  communityName?: string;
  memberRole?: CommunityMemberRole;
  managerProfileId?: string | null;
  memberCount?: number;
}

export interface CommunityOpsNote {
  id: string;
  body: string;
  createdAt: string;
  author: string;
}

export interface CommunityOpsEscalation {
  id: string;
  status: 'open' | 'resolved';
  summary: string;
  createdAt: string;
  actor: string;
}

export interface CommunityOpsCase {
  id: string;
  title: string;
  summary: string;
  owner: string;
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

export interface CommunityOpsCaseDraft {
  title: string;
  summary: string;
  owner: string;
}

export interface CommunitySnapshot {
  community: CommunityDto;
  members: CommunityMemberDto[];
  manager: CommunityManagerRecord | null;
}

export interface CommunityOpsJournalEntry {
  notes: CommunityOpsNote[];
  escalations: CommunityOpsEscalation[];
  caseRecord: CommunityOpsCase | null;
}

export interface ModerationHandoffContext {
  source: 'community-ops';
  entityType: 'community' | 'city' | 'member';
  entityId: string;
  communityId?: string;
  communityName?: string;
  entityTitle: string;
}
