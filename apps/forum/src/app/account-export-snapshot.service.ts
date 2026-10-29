import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileBoundSnapshotService,
  AccountExportProfileBoundSnapshotError,
} from '@optimistic-tanuki/storage';
import { ForumAccountExportOwnerService } from './account-export-owner.service';

export { AccountExportProfileBoundSnapshotError as ForumAccountExportSnapshotError };

@Injectable()
export class ForumAccountExportSnapshotService extends AccountExportProfileBoundSnapshotService<string> {
  constructor(
    owner: ForumAccountExportOwnerService,
    spoolService: AccountExportOwnerSpoolService,
    authClient: ClientProxy
  ) {
    super(owner, spoolService, authClient, {
      participantId: 'forum',
      sources: FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
  }
}
