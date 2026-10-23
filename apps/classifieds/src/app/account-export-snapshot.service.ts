import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileBoundSnapshotService,
  AccountExportProfileBoundSnapshotError,
} from '@optimistic-tanuki/storage';
import { ClassifiedsAccountExportOwnerService } from './account-export-owner.service';

export { AccountExportProfileBoundSnapshotError as ClassifiedsAccountExportSnapshotError };
export type { ClassifiedsAccountExportSnapshotDescriptor } from '@optimistic-tanuki/models';

@Injectable()
export class ClassifiedsAccountExportSnapshotService extends AccountExportProfileBoundSnapshotService<string> {
  constructor(
    owner: ClassifiedsAccountExportOwnerService,
    spool: AccountExportOwnerSpoolService,
    auth: ClientProxy
  ) {
    super(owner, spool, auth, {
      participantId: 'classifieds',
      sources: CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
  }
}
