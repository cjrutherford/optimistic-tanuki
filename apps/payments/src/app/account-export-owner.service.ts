import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportPostgresOwnerService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { DataSource } from 'typeorm';
import { createPaymentsAccountExportSources } from './account-export-sources';

export { PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES };

@Injectable()
export class PaymentsAccountExportOwnerService extends AccountExportPostgresOwnerService {
  constructor(
    dataSource: DataSource,
    identities: AccountExportProfileSnapshotClient,
    auth: ClientProxy
  ) {
    super(dataSource, identities, auth, {
      participantId: 'payments',
      sources: PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      createSources: createPaymentsAccountExportSources,
    });
  }
}
