import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileBoundSnapshotService,
  AccountExportProfileBoundSnapshotError,
} from '@optimistic-tanuki/storage';
import { PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from './account-export-owner.service';
import { PaymentsAccountExportOwnerService } from './account-export-owner.service';

export { AccountExportProfileBoundSnapshotError as PaymentsAccountExportSnapshotError };

@Injectable()
export class PaymentsAccountExportSnapshotService extends AccountExportProfileBoundSnapshotService<string> {
  constructor(
    owner: PaymentsAccountExportOwnerService,
    spool: AccountExportOwnerSpoolService,
    auth: ClientProxy
  ) {
    super(owner, spool, auth, {
      participantId: 'payments',
      sources: PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
  }
}
