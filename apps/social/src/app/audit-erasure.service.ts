import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AuditErasurePolicy,
  AuditErasureRunner,
  LogSubjectSelection,
} from '@optimistic-tanuki/logger';

const SOCIAL_POLICIES: readonly AuditErasurePolicy[] = [
  {
    table: 'community_membership_audit',
    accountColumns: ['actorId'],
    profileColumns: ['subjectId'],
    clearColumns: { workspaceId: 'null' },
  },
  {
    table: 'guardian_content_audit',
    accountColumns: ['actorUserId', 'dependentUserId'],
    profileColumns: ['dependentProfileId'],
    profileAccountBindings: { dependentProfileId: 'dependentUserId' },
    clearColumns: {
      resourceId: 'null',
      changedFields: 'serialized-json-array',
    },
  },
  {
    table: 'content_moderation_action',
    accountColumns: [],
    profileColumns: ['actorProfileId'],
    clearColumns: {
      subjectId: 'null',
      reportId: 'null',
      workspaceId: 'null',
      details: 'json-object',
    },
  },
  {
    table: 'profile_view',
    accountColumns: ['viewerId'],
    profileColumns: ['profileId'],
    clearColumns: { source: 'empty-text' },
  },
  {
    table: 'activity',
    accountColumns: [],
    profileColumns: ['profileId'],
    disposition: 'delete-private',
  },
];

@Injectable()
export class SocialAuditErasureService {
  private readonly runner: AuditErasureRunner;

  constructor(@Inject('SOCIAL_CONNECTION') dataSource: DataSource) {
    this.runner = new AuditErasureRunner(dataSource);
  }

  eraseParticipation(subject: LogSubjectSelection) {
    return this.runner.erase(subject, SOCIAL_POLICIES);
  }
}

export { SOCIAL_POLICIES as SOCIAL_AUDIT_ERASURE_POLICIES };
