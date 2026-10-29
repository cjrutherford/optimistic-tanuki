import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportProfileSnapshotClient,
  AccountExportPostgresOwnerService,
  AccountExportPostgresOwnerError,
} from '@optimistic-tanuki/storage';
import { DataSource } from 'typeorm';
import { createForumAccountExportSources } from './account-export-sources';

export { AccountExportPostgresOwnerError as ForumAccountExportOwnerError };

@Injectable()
export class ForumAccountExportOwnerService extends AccountExportPostgresOwnerService {
  constructor(
    dataSource: DataSource,
    identities: AccountExportProfileSnapshotClient,
    auth: ClientProxy
  ) {
    super(dataSource, identities, auth, {
      participantId: 'forum',
      sources: FORUM_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      createSources: createForumAccountExportSources,
    });
  }
}
