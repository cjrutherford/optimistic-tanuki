import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportPostgresOwnerService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { DataSource } from 'typeorm';
import { createAppConfiguratorAccountExportSources } from './account-export-sources';

@Injectable()
export class AppConfiguratorAccountExportOwnerService extends AccountExportPostgresOwnerService {
  constructor(
    dataSource: DataSource,
    identities: AccountExportProfileSnapshotClient,
    auth: ClientProxy
  ) {
    super(dataSource, identities, auth, {
      participantId: 'app-configurator',
      sources: APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      createSources: createAppConfiguratorAccountExportSources,
    });
  }
}
