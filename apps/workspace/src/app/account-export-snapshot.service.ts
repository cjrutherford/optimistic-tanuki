import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportProfileBoundSnapshotService,
  AccountExportProfileBoundSnapshotError,
} from '@optimistic-tanuki/storage';
import { AccountExportOwnerSpoolService } from '@optimistic-tanuki/storage';
import { WorkspaceAccountExportOwnerService } from './account-export-owner.service';

export { AccountExportProfileBoundSnapshotError as WorkspaceAccountExportSnapshotError };

@Injectable()
export class WorkspaceAccountExportSnapshotService extends AccountExportProfileBoundSnapshotService<string> {
  constructor(
    owner: WorkspaceAccountExportOwnerService,
    spool: AccountExportOwnerSpoolService,
    auth: ClientProxy
  ) {
    super(owner, spool, auth, {
      participantId: 'workspace',
      sources: WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
  }
}
