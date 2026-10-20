import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { AccountExportOwnerSpoolService } from '@optimistic-tanuki/storage';
import {
  AccountExportProfileBoundSnapshotError,
  AccountExportProfileBoundSnapshotService,
} from '@optimistic-tanuki/storage';
import {
  AssetsAccountExportOwnerService,
  AssetsAccountExportSource,
} from './account-export-owner.service';

export { AccountExportProfileBoundSnapshotError as AssetsAccountExportSnapshotError };

/** Compatibility wrapper preserving the Assets snapshot service API. */
@Injectable()
export class AssetsAccountExportSnapshotService extends AccountExportProfileBoundSnapshotService<AssetsAccountExportSource> {
  constructor(
    owner: AssetsAccountExportOwnerService,
    spoolService: AccountExportOwnerSpoolService,
    authClient: ClientProxy
  ) {
    super(owner, spoolService, authClient, {
      participantId: 'assets',
      sources: ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
  }
}
