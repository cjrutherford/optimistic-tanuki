/** Private D27 process harness. Boots production modules; never installs successful
 * fake owner handlers or connects to the shared development databases. */
import 'reflect-metadata';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import {
  ACCOUNT_DELETION_OWNERS,
  AccountDeletionOwner,
  AccountExportOwnerChunk,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerSpoolService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { createHash, randomUUID } from 'node:crypto';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import {
  ActivityRetentionService,
  installPayloadFreeLogging,
} from '@optimistic-tanuki/logger';
import { ActivityRetentionStatusService } from '../../../authentication/src/app/activity-retention-status.service';
import { AccountExportArtifactRetentionService } from '../../../authentication/src/account-export-jobs/account-export-artifact-retention.service';
import { AccountDeletionRunnerService } from '../../../authentication/src/account-deletion/account-deletion-runner.service';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';

export interface D27WorkerConfig {
  marker: 'private-d27-otts-v1';
  owner: AccountDeletionOwner;
  database: {
    host: '127.0.0.1';
    port: number;
    username: 'd00';
    password: string;
    database: string;
  };
  endpoints: Record<string, { host: '127.0.0.1'; port: number }>;
  replicas: Record<string, Array<{ host: '127.0.0.1'; port: number }>>;
  listen: { host: '127.0.0.1'; port: number };
  privateRoot: string;
  artifactRoot?: string;
  mediaPort?: number;
  workerEnabled?: boolean;
  jwtSecret: string;
  proofKey: string;
  gatewayOrigins: string[];
  browserOrigins?: Record<string, string[]>;
}
export function readD27WorkerConfig(path: string): D27WorkerConfig {
  const root = realpathSync(
    resolve('.runtime-artifacts/account-rights/deletion')
  );
  const actual = realpathSync(path);
  const rel = relative(root, actual);
  const metadata = statSync(actual);
  if (
    !rel ||
    rel.startsWith('..' + sep) ||
    rel === '..' ||
    !metadata.isFile() ||
    (metadata.mode & 0o077) !== 0 ||
    metadata.size > 65536
  )
    throw Error('D27_PRIVATE_CONFIG_CUSTODY');
  const value = JSON.parse(readFileSync(actual, 'utf8')) as D27WorkerConfig;
  const endpoint = (v: { host?: unknown; port?: unknown }) =>
    v &&
    v.host === '127.0.0.1' &&
    Number.isInteger(v.port) &&
    Number(v.port) > 1024 &&
    Number(v.port) < 65536;
  if (
    value.marker !== 'private-d27-otts-v1' ||
    !ACCOUNT_DELETION_OWNERS.includes(value.owner) ||
    value.database?.host !== '127.0.0.1' ||
    value.database.username !== 'd00' ||
    !/^d27_[a-z_]+$/.test(value.database.database) ||
    !endpoint(value.database) ||
    typeof value.database.password !== 'string' ||
    value.database.password.length < 32 ||
    !endpoint(value.listen) ||
    typeof value.jwtSecret !== 'string' ||
    value.jwtSecret.length < 32 ||
    typeof value.proofKey !== 'string' ||
    value.proofKey.length < 32 ||
    !value.endpoints ||
    !Object.values(value.endpoints).every(endpoint) ||
    !value.replicas ||
    Object.entries(value.replicas).some(
      ([owner, values]) =>
        !ACCOUNT_DELETION_OWNERS.includes(owner as AccountDeletionOwner) ||
        !Array.isArray(values) ||
        !values.length ||
        values.length > 8 ||
        !values.every(endpoint)
    ) ||
    !Array.isArray(value.gatewayOrigins) ||
    value.gatewayOrigins.some(
      (origin) => !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
    )
  )
    throw Error('D27_PRIVATE_CONFIG_INVALID');
  const storage = realpathSync(value.privateRoot);
  const storageRel = relative(root, storage);
  if (
    !storageRel ||
    storageRel.startsWith('..' + sep) ||
    storageRel === '..' ||
    !statSync(storage).isDirectory()
  )
    throw Error('D27_PRIVATE_STORAGE_CUSTODY');
  if (value.artifactRoot) {
    const artifact = realpathSync(value.artifactRoot);
    const artifactRel = relative(root, artifact);
    if (
      !artifactRel ||
      artifactRel.startsWith('..' + sep) ||
      artifactRel === '..' ||
      !statSync(artifact).isDirectory()
    )
      throw Error('D27_PRIVATE_ARTIFACT_CUSTODY');
    value.artifactRoot = artifact;
  }
  value.privateRoot = storage;
  return value;
}

export function d27RegisteredDatabase(fixture: D27WorkerConfig) {
  const services = Object.fromEntries(
    Object.entries(fixture.endpoints).map(([key, value]) => [
      key.replace(/-/g, '_'),
      value,
    ])
  );
  const synthetic = {
    database: fixture.database,
    services,
    auth: { jwt_secret: fixture.jwtSecret },
    deletion: { owner_replicas: fixture.replicas },
    storageStrategy: 'local',
    storagePath: resolve(fixture.privateRoot, 'assets'),
    'storage-module-options': {
      enabledAdapters: ['local'],
      localStoragePath: resolve(fixture.privateRoot, 'assets'),
    },
    internalMediaToken: fixture.proofKey,
    SMTP_HOST: '',
    oauth: {},
  };
  const config = new ConfigService(synthetic);
  const req = createRequire(resolve('apps', fixture.owner, 'package.json'));
  // Use the service's registered entity metadata, with synthetic configuration.
  // Replacing this config module prevents reading private operational YAML.
  let registeredConfig = false;
  for (const path of [
    './src/config',
    './src/app/config',
    './src/app/loadConfig',
  ]) {
    let configPath: string;
    try {
      configPath = req.resolve(path);
    } catch {
      continue;
    }
    req.cache[configPath] = {
      id: configPath,
      filename: configPath,
      loaded: true,
      exports: {
        __esModule: true,
        default: () => synthetic,
        loadConfig: () => synthetic,
      },
      children: [],
      paths: [],
    } as NodeModule;
    registeredConfig = true;
  }
  if (!registeredConfig) throw Error('D27_SYNTHETIC_CONFIG_REQUIRED');
  const registration = req('./src/app/loadDatabase');
  const loader =
    registration.default || registration.loadDatabase || registration;
  const options = loader(config) as DataSourceOptions;
  return { config, options, req };
}

let bootPhase = 'guard';
async function main() {
  if (
    process.env['D00_PRIVATE_FIXTURE'] !== 'd00-private-fixture' ||
    !process.send
  )
    throw Error('D27_PRIVATE_IPC_REQUIRED');
  const fixture = readD27WorkerConfig(process.env['D27_WORKER_CONFIG'] ?? '');
  installPayloadFreeLogging();
  process.env['ACCOUNT_DELETION_PROOF_KEY'] = fixture.proofKey;
  process.env['ACCOUNT_DELETION_WORKER_ENABLED'] = fixture.workerEnabled
    ? 'true'
    : 'false';
  process.env['ACCOUNT_DELETION_GATEWAY_ORIGINS'] = JSON.stringify(
    fixture.gatewayOrigins
  );
  if (fixture.browserOrigins)
    process.env['ACCOUNT_DELETION_BROWSER_ORIGINS'] = JSON.stringify(
      fixture.browserOrigins
    );
  process.env['ACCOUNT_DELETION_OWNER_REPLICAS'] = JSON.stringify(
    fixture.replicas
  );
  process.env['ACCOUNT_DELETION_LOG_INVENTORY'] = JSON.stringify({
    scope: 'local-ot-ts',
    confirmedAt: '2026-10-26',
    noForwardedCollectors: true,
    noRetainedLegacyLogs: true,
  });
  process.env['ACCOUNT_EXPORT_ARTIFACT_DIR'] =
    fixture.artifactRoot ?? resolve(fixture.privateRoot, 'artifacts');
  process.env['VAULT_STORAGE_KEK'] = fixture.proofKey;
  process.env['SERVICE_AUTHENTICATION_HOST'] =
    fixture.endpoints['authentication'].host;
  process.env['SERVICE_AUTHENTICATION_PORT'] = String(
    fixture.endpoints['authentication'].port
  );
  bootPhase = 'metadata';
  const { config, options, req } = d27RegisteredDatabase(fixture);
  const db = new DataSource({
    ...options,
    ...fixture.database,
    type: 'postgres',
    synchronize: false,
    migrationsRun: false,
    logging: false,
    extra: {
      statement_timeout: 15000,
      lock_timeout: 5000,
      application_name: 'd27-' + fixture.owner + '-' + fixture.listen.port,
    },
  } as DataSourceOptions);
  bootPhase = 'database';
  await db.initialize();
  const appModule = req('./src/app/app.module').AppModule;
  let module = Test.createTestingModule({ imports: [appModule] })
    .overrideProvider(ConfigService)
    .useValue(config)
    .overrideProvider(
      (fixture.owner === 'chat-collector'
        ? 'CHAT_COLLECTOR'
        : fixture.owner.toUpperCase()) + '_CONNECTION'
    )
    .useValue(db);
  const clients = [];
  for (const [name, token] of Object.entries(ServiceTokens)) {
    const key = name
      .replace(/_SERVICE$/, '')
      .toLowerCase()
      .replace(/_/g, '-');
    const address = fixture.endpoints[key] ?? { host: '127.0.0.1', port: 9 };
    const client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: address,
    });
    clients.push(client);
    module = module.overrideProvider(token).useValue(client);
  }
  // These three legacy module tokens use the same real Auth transport as ServiceTokens.
  for (const token of [
    'APP_CONFIGURATOR_AUTH_PROXY',
    'CLASSIFIEDS_AUTH_PROXY',
    'CHAT_COLLECTOR_AUTH_PROXY',
  ]) {
    const client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: fixture.endpoints['authentication'],
    });
    clients.push(client);
    module = module.overrideProvider(token).useValue(client);
  }
  bootPhase = 'module';
  const compiled = await module.compile();
  const mediaApp =
    process.env['R4_JOURNEYS'] === '1' && fixture.owner === 'assets'
      ? compiled.createNestApplication({ logger: false })
      : undefined;
  if (
    mediaApp &&
    (!Number.isInteger(fixture.mediaPort) ||
      fixture.mediaPort! < 1024 ||
      fixture.mediaPort! > 65535)
  )
    throw Error('R4_MEDIA_PORT_REQUIRED');
  const app = compiled.createNestMicroservice({
    transport: Transport.TCP,
    options: fixture.listen,
    logger: false,
  });
  const handles = new Map<string, OwnerSpoolHandle<string>>();
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    for (const handle of handles.values()) await handle.cleanup();
    handles.clear();
    await mediaApp?.close();
    await app.close();
    for (const client of clients) client.close();
    if (db.isInitialized) await db.destroy();
    process.send?.({ type: 'closed', owner: fixture.owner });
    if (process.connected) process.disconnect();
  };
  process.on(
    'message',
    async (message: {
      type?: string;
      requestId?: string;
      operationId?: string;
      accountId?: string;
      appId?: 'client-interface' | 'local-hub';
      idempotencyKey?: string;
    }) => {
      if (message.type === 'close') {
        await close();
        return;
      }
      if (closing) return;
      if (
        process.env['R2_RETENTION_CONTROLS'] === '1' &&
        ['retention-sweep', 'retention-status', 'history-prune'].includes(
          message.type ?? ''
        )
      ) {
        try {
          const value =
            message.type === 'retention-sweep'
              ? await compiled.get(ActivityRetentionService).sweep()
              : message.type === 'history-prune'
              ? await compiled
                  .get(AccountExportArtifactRetentionService)
                  .pruneHistory()
              : await compiled.get(ActivityRetentionStatusService).readback();
          process.send?.({
            type: 'result',
            requestId: message.requestId,
            result: value,
          });
        } catch {
          process.send?.({ type: 'failed', requestId: message.requestId });
        }
        return;
      }
      if (message.type === 'seed-spool' && message.accountId) {
        try {
          const accountId = message.accountId;
          const record = {
            source: 'alpha',
            data: { id: 'one', text: 'PRIVATE_D27_SPOOL' },
          };
          const common = {
            contractVersion: 1,
            schemaVersion: '2026-10-19.v1',
            participantId: 'fixture',
            accountId,
            captureId: randomUUID(),
            snapshotAt: new Date().toISOString(),
            uncovered: [],
          };
          const handle = await compiled
            .get(AccountExportOwnerSpoolService)
            .capture<string>(
              {
                accountId,
                participantId: 'fixture',
                sources: ['alpha'],
                spoolRoot: resolve(fixture.privateRoot, 'owner-spools'),
                timeoutMs: 5000,
              },
              async (consume) => {
                await consume({
                  ...common,
                  source: 'alpha',
                  pageOrdinal: 1,
                  cursor: 'one',
                  records: [record],
                  sourceComplete: true,
                  endOfStream: false,
                  complete: false,
                } as AccountExportOwnerChunk<string>);
                const end = {
                  ...common,
                  source: 'end',
                  pageOrdinal: 2,
                  cursor: null,
                  records: [],
                  sourceComplete: true,
                  endOfStream: true,
                  complete: true,
                  rowCount: 1,
                  checksum: createHash('sha256')
                    .update(JSON.stringify(record) + '\n')
                    .digest('hex'),
                  sourceRowCounts: { alpha: 1 },
                  sourceDispositions: { alpha: 'retained' },
                } as AccountExportOwnerChunk<string>;
                await consume(end);
                return end;
              }
            );
          handles.set(accountId, handle);
          process.send?.({
            type: 'result',
            requestId: message.requestId,
            result: { seeded: true },
          });
        } catch {
          process.send?.({ type: 'failed', requestId: message.requestId });
        }
        return;
      }
      if (message.type === 'inspect-spool' && message.accountId) {
        let readable = false;
        try {
          const handle = handles.get(message.accountId);
          if (handle)
            readable =
              (await handle.readChunk(0, handle.metadata.sizeBytes)).length > 0;
        } catch {
          /* Closed target is expected. */
        }
        process.send?.({
          type: 'result',
          requestId: message.requestId,
          result: { readable },
        });
        return;
      }
      if (fixture.owner !== 'authentication') return;
      try {
        if (message.type === 'run' && message.operationId) {
          const result = await compiled
            .get(AccountDeletionRunnerService)
            .run(message.operationId);
          process.send?.({
            type: 'result',
            requestId: message.requestId,
            result,
          });
        } else if (message.type === 'recover') {
          await compiled.get(AccountDeletionRunnerService).recover();
          process.send?.({
            type: 'result',
            requestId: message.requestId,
            result: { recovered: true },
          });
        } else if (
          message.type === 'accept' &&
          message.accountId &&
          message.appId &&
          message.idempotencyKey
        ) {
          const result = await compiled
            .get(AccountDeletionAuthorityService)
            .accept(message.accountId, message.appId, message.idempotencyKey);
          process.send?.({
            type: 'result',
            requestId: message.requestId,
            result: { id: result.id },
          });
        }
      } catch {
        process.send?.({ type: 'failed', requestId: message.requestId });
      }
    }
  );
  process.once('disconnect', () => {
    void close().finally(() => process.exit(0));
  });
  bootPhase = 'listen';
  if (mediaApp) await mediaApp.listen(fixture.mediaPort!, '127.0.0.1');
  await app.listen();
  process.send?.({
    type: 'ready',
    owner: fixture.owner,
    port: fixture.listen.port,
    pid: process.pid,
  });
}
if (require.main === module)
  void main().catch((error) => {
    const name = error?.constructor?.name;
    process.send?.({
      type: 'failed',
      phase: bootPhase,
      code:
        typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)
          ? error.code
          : undefined,
      kind:
        typeof name === 'string' && /^[A-Za-z]+$/.test(name) ? name : 'Error',
      dependency:
        typeof error?.type === 'string' &&
        /^[A-Za-z_][A-Za-z0-9_]{0,100}$/.test(error.type)
          ? error.type
          : undefined,
      index: Number.isInteger(error?.context?.index)
        ? error.context.index
        : undefined,
      locations:
        typeof error?.stack === 'string'
          ? [
              ...error.stack.matchAll(
                /(?:apps|libs)\/[A-Za-z0-9_./-]+\.ts:\d+:\d+/g
              ),
            ]
              .slice(0, 3)
              .map((value) => value[0])
              .join(',')
          : undefined,
    });
    process.exitCode = 1;
    if (process.connected) process.disconnect();
  });
