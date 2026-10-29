import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AccountExportOwnerSpoolService,
  AccountExportArtifactBuilderService,
  AccountExportArtifactStoreService,
} from '@optimistic-tanuki/storage';
import {
  payloadFreeLoggingStatus,
  databaseLoggingStatus,
} from '@optimistic-tanuki/logger';
import { AccountExportDownloadService } from '../account-export-jobs/account-export-download.service';
import { AccountExportJobService } from '../account-export-jobs/account-export-job.service';

/** Trusted Auth owner boundary; persistent artifacts remain under D01's ledger custody. */
@Injectable()
export class AccountDeletionRuntimeService {
  private readonly instanceId = randomUUID();
  constructor(
    private readonly spools: AccountExportOwnerSpoolService,
    private readonly builder: AccountExportArtifactBuilderService,
    private readonly store: AccountExportArtifactStoreService,
    private readonly downloads: AccountExportDownloadService,
    private readonly jobs: AccountExportJobService,
    @Inject('AUTHENTICATION_CONNECTION')
    private readonly database: { query(sql: string): Promise<unknown> }
  ) {}
  async environmentStatus() {
    return {
      logging: payloadFreeLoggingStatus(),
      databaseLogging: await databaseLoggingStatus(this.database),
    };
  }
  async custodyProbe(
    nonce: string,
    mode: 'write' | 'read' | 'remove'
  ): Promise<string> {
    return this.store.custodyProbe(nonce, mode);
  }
  async custodyIdentity(): Promise<string> {
    return this.store.custodyIdentity();
  }
  async fence(accountId: string): Promise<void> {
    const results = await Promise.allSettled([
      this.spools.purgeAccount(accountId),
      this.builder.purgeAccount(accountId),
      this.store.purgeAccountRuntime(accountId),
      this.downloads.purgeAccount(accountId),
      this.jobs.purgeAccount(accountId),
    ]);
    if (results.some((result) => result.status === 'rejected'))
      throw Error('AUTH_DELETION_RUNTIME_UNVERIFIED');
    await this.readback(accountId);
  }
  async readback(accountId: string) {
    const counts = await Promise.all([
      this.spools.readbackAccount(accountId),
      this.builder.readbackAccount(accountId),
      this.store.readbackAccountRuntime(accountId),
      this.downloads.readbackAccount(accountId),
      this.jobs.readbackAccount(accountId),
    ]);
    if (counts.some((count) => count !== 0))
      throw Error('AUTH_DELETION_RUNTIME_UNVERIFIED');
    return {
      owner: 'authentication',
      instanceId: this.instanceId,
      remaining: 0,
      logging: payloadFreeLoggingStatus(),
      databaseLogging: await databaseLoggingStatus(this.database),
    };
  }
}
