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

  readbackParticipation(subject: LogSubjectSelection): Promise<number> {
    return this.runner.readback(subject, FORUM_POLICIES);
  }

  eraseParticipation(subject: LogSubjectSelection, operationId?: string) {
    if (
      operationId !== undefined &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        operationId
      )
    )
      throw Error('FORUM_DELETION_OPERATION_INVALID');
    return this.runner.erase(
      subject,
      FORUM_POLICIES,
      operationId
        ? async (manager) => {
            await manager.query(
              "SELECT set_config('ot.deletion_operation',$1,true)",
              [operationId]
            );
          }
        : undefined
    );
  }
}

export { FORUM_POLICIES as FORUM_AUDIT_ERASURE_POLICIES };
