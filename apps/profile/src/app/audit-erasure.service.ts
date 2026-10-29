import { Inject, Injectable } from '@nestjs/common';
import {
  AuditErasureRunner,
  LogSubjectSelection,
} from '@optimistic-tanuki/logger';
import { DataSource } from 'typeorm';
import { GuardianProfileActivity } from '../profiles/entities/guardian-profile-activity.entity';

@Injectable()
export class ProfileAuditErasureService {
  private readonly runner: AuditErasureRunner;
  private readonly table: string;

  constructor(@Inject('PROFILE_CONNECTION') dataSource: DataSource) {
    this.runner = new AuditErasureRunner(dataSource);
    this.table = dataSource.getMetadata(GuardianProfileActivity).tableName;
  }

  readbackParticipation(subject: LogSubjectSelection): Promise<number> {
    return this.runner.readback(subject, [
      {
        table: this.table,
        accountColumns: ['actorUserId', 'dependentUserId'],
        profileColumns: ['profileId'],
      },
    ]);
  }

  eraseParticipation(selection: LogSubjectSelection, operationId?: string) {
    if (
      operationId !== undefined &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        operationId
      )
    )
      throw new Error('ACCOUNT_DELETION_OPERATION_ID_INVALID');
    return this.runner.erase(
      selection,
      [
        {
          table: this.table,
          accountColumns: ['actorUserId', 'dependentUserId'],
          profileColumns: ['profileId'],
          profileAccountBindings: { profileId: 'dependentUserId' },
          clearColumns: { changedFieldNames: 'text-array' },
        },
      ],
      operationId
        ? async (transaction) => {
            await transaction.query(
              "SELECT set_config('ot.deletion_operation', $1, true)",
              [operationId]
            );
          }
        : undefined
    );
  }
}
