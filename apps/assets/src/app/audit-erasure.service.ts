import { Inject, Injectable } from '@nestjs/common';
import {
  AuditErasureRunner,
  LogSubjectSelection,
} from '@optimistic-tanuki/logger';
import { DataSource } from 'typeorm';
import { GuardianAssetActivity } from '../entities/guardian-asset-activity.entity';

@Injectable()
export class AssetsAuditErasureService {
  private readonly runner: AuditErasureRunner;
  private readonly table: string;

  constructor(@Inject('ASSETS_CONNECTION') dataSource: DataSource) {
    this.runner = new AuditErasureRunner(dataSource);
    this.table = dataSource.getMetadata(GuardianAssetActivity).tableName;
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
          clearColumns: { assetId: 'null', changedFieldNames: 'json-array' },
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
