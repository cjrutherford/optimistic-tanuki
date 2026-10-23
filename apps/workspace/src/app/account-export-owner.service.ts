import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportPostgresOwnerService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { DataSource } from 'typeorm';
import { createWorkspaceAccountExportSources } from './account-export-sources';

@Injectable()
export class WorkspaceAccountExportOwnerService extends AccountExportPostgresOwnerService {
  constructor(
    dataSource: DataSource,
    identities: AccountExportProfileSnapshotClient,
    auth: ClientProxy
  ) {
    super(dataSource, identities, auth, {
      participantId: 'workspace',
      sources: WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      createSources: createWorkspaceAccountExportSources,
    });
  }
}
