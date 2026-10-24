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

  eraseParticipation(selection: LogSubjectSelection) {
    return this.runner.erase(selection, [
      {
        table: this.table,
        accountColumns: ['actorUserId', 'dependentUserId'],
        profileColumns: ['profileId'],
        profileAccountBindings: { profileId: 'dependentUserId' },
        clearColumns: { assetId: 'null', changedFieldNames: 'json-array' },
      },
    ]);
  }
}
