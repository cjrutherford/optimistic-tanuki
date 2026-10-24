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

  eraseParticipation(selection: LogSubjectSelection) {
    return this.runner.erase(selection, [
      {
        table: this.table,
        accountColumns: ['actorUserId', 'dependentUserId'],
        profileColumns: ['profileId'],
        profileAccountBindings: { profileId: 'dependentUserId' },
        clearColumns: { changedFieldNames: 'text-array' },
      },
    ]);
  }
}
