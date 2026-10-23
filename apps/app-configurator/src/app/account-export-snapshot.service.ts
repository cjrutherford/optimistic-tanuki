import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileBoundSnapshotService,
  AccountExportProfileBoundSnapshotError,
} from '@optimistic-tanuki/storage';
import { AppConfiguratorAccountExportOwnerService } from './account-export-owner.service';

export { AccountExportProfileBoundSnapshotError as AppConfiguratorAccountExportSnapshotError };

@Injectable()
export class AppConfiguratorAccountExportSnapshotService extends AccountExportProfileBoundSnapshotService<string> {
  constructor(
    owner: AppConfiguratorAccountExportOwnerService,
    spool: AccountExportOwnerSpoolService,
    auth: ClientProxy
  ) {
    super(owner, spool, auth, {
      participantId: 'app-configurator',
      sources: APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
  }
}
