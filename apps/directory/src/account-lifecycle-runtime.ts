import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { DataSource } from 'typeorm';
import { DIRECTORY_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import { installPayloadFreeLogging } from '@optimistic-tanuki/logger';
import {
  AccountDeletionAuthorityClient,
  AccountDeletionSnapshotController,
  AccountExportOwnerSpoolService,
  AccountExportPostgresOwnerService,
  AccountExportProfileBoundSnapshotService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import { executeDirectoryAccountDeletion } from './account-lifecycle';
import { createDirectoryAccountExportSources } from './account-export-sources';
import {
  AccountLifecycleConfig,
  createAccountLifecycleHandler,
} from './account-lifecycle-server';

type Database = Pick<DataSource, 'query' | 'transaction' | 'createQueryRunner'>;
export type DirectoryLifecycleHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<boolean>;

/**
 * Builds the internal deletion and export routes for one Directory process.
 * Authentication is the only authority: every grant and export lease is
 * re-validated with it over TCP, and the environment check requires the
 * payload-free logging policy here and in the database.
 * `proxies` replaces the TCP clients to Authentication and Profile in tests.
 */
export function createDirectoryLifecycleHandler(
  db: Database,
  config: AccountLifecycleConfig,
  proxies?: { auth: ClientProxy; profile: ClientProxy }
): DirectoryLifecycleHandler {
  installPayloadFreeLogging();
  const proxy = (host: string, port: number) =>
    ClientProxyFactory.create({ transport: Transport.TCP, options: { host, port } });
  const auth = proxies?.auth ?? proxy(config.authenticationHost, config.authenticationPort);
  const profile = proxies?.profile ?? proxy(config.profileHost, config.profilePort);
  const authority = new AccountDeletionAuthorityClient(auth);
  const spool = new AccountExportOwnerSpoolService();
  const owner = new AccountExportPostgresOwnerService(
    db as DataSource,
    new AccountExportProfileSnapshotClient(profile),
    auth,
    {
      participantId: 'directory',
      sources: DIRECTORY_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      createSources: createDirectoryAccountExportSources,
    }
  );
  const snapshots = new AccountExportProfileBoundSnapshotService(
    owner,
    spool,
    auth,
    {
      participantId: 'directory',
      sources: DIRECTORY_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    }
  );
  const lifecycle = new AccountDeletionSnapshotController({
    owner: 'directory',
    snapshot: snapshots,
    authority,
    spool,
    database: db,
  });
  return createAccountLifecycleHandler(
    (grant, action) =>
      executeDirectoryAccountDeletion(
        { db: { transaction: (work) => db.transaction(work) }, authority },
        grant,
        action
      ),
    config.secret,
    {
      environment: (value) => lifecycle.environment(value),
      purgeSnapshots: (value) => lifecycle.purge(value),
      runtimeReadback: (value) => lifecycle.runtime(value),
      exportOpen: (value) => snapshots.open(value),
      exportRead: (value) => snapshots.read(value),
      exportRelease: (value) => snapshots.release(value),
    }
  );
}
