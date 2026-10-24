import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AuditErasurePolicy,
  AuditErasureRunner,
  LogSubjectSelection,
} from '@optimistic-tanuki/logger';

const FORUM_POLICIES: readonly AuditErasurePolicy[] = [
  {
    table: 'forum_moderation_action',
    accountColumns: [],
    profileColumns: ['actorProfileId'],
    clearColumns: { subjectId: 'null', details: 'json-object' },
  },
];

@Injectable()
export class ForumAuditErasureService {
  private readonly runner: AuditErasureRunner;

  constructor(@Inject('FORUM_CONNECTION') dataSource: DataSource) {
    this.runner = new AuditErasureRunner(dataSource);
  }

  eraseParticipation(subject: LogSubjectSelection) {
    return this.runner.erase(subject, FORUM_POLICIES);
  }
}

export { FORUM_POLICIES as FORUM_AUDIT_ERASURE_POLICIES };
