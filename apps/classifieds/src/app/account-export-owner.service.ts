import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportPostgresOwnerService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { DataSource } from 'typeorm';
import { createClassifiedsAccountExportSources } from './account-export-sources';

@Injectable()
export class ClassifiedsAccountExportOwnerService extends AccountExportPostgresOwnerService {
  constructor(
    dataSource: DataSource,
    identities: AccountExportProfileSnapshotClient,
    auth: ClientProxy
  ) {
    super(dataSource, identities, auth, {
      participantId: 'classifieds',
      sources: CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      createSources: createClassifiedsAccountExportSources,
    });
  }
}
