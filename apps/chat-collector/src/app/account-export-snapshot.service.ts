import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileBoundSnapshotService,
  AccountExportProfileBoundSnapshotError,
} from '@optimistic-tanuki/storage';
import { ChatAccountExportOwnerService } from './account-export-owner.service';

export { AccountExportProfileBoundSnapshotError as ChatAccountExportSnapshotError };

@Injectable()
export class ChatAccountExportSnapshotService extends AccountExportProfileBoundSnapshotService<string> {
  constructor(
    owner: ChatAccountExportOwnerService,
    spool: AccountExportOwnerSpoolService,
    auth: ClientProxy
  ) {
    super(owner, spool, auth, {
      participantId: 'chat-collector',
      sources: CHAT_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
  }
}
