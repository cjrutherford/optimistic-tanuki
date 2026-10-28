import { randomUUID } from 'node:crypto';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { DataSource } from 'typeorm';
import {
  AccountDeletionWriteFenceEntity,
  EnvelopeEncryptionService,
  LocalStorageAdapter,
  VerifiedMediaSpoolService,
} from '@optimistic-tanuki/storage';
import AssetEntity from '../../../assets/src/entities/asset.entity';
import { GuardianAssetActivity } from '../../../assets/src/entities/guardian-asset-activity.entity';
import { AssetMediaReadFenceService } from '../../../assets/src/app/asset-media-read-fence.service';

const fail = (code: string): never => {
  throw new Error(code);
};
const send = (message: Record<string, unknown>): void => {
  if (typeof process.send !== 'function') fail('IPC_UNAVAILABLE');
  process.send(message);
};
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function validatePrivateDirectory(path: string): Promise<string> {
  const absolute = resolve(path);
  const info = await lstat(absolute);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0)
    fail('PRIVATE_DIRECTORY_INVALID');
  const canonical = await realpath(absolute);
  if (canonical !== absolute) fail('PRIVATE_DIRECTORY_INVALID');
  return canonical;
}

async function main(): Promise<void> {
  if (process.env['D00_PRIVATE_FIXTURE'] !== 'd00-private-fixture')
    fail('FIXTURE_GATE_REQUIRED');
  if (typeof process.send !== 'function') fail('IPC_UNAVAILABLE');
  if (process.env['POSTGRES_HOST'] !== '127.0.0.1')
    fail('POSTGRES_HOST_INVALID');
  const fixtureId = process.env['ASSET_READ_FIXTURE_ID'];
  if (!fixtureId || !UUID.test(fixtureId)) fail('FIXTURE_ID_INVALID');
  const database = process.env['D03_ASSETS_DB'] || 'd03_assets';
  const fixtureRoot = process.env['ASSET_READ_FIXTURE_ROOT'];
  const spoolRoot = process.env['ASSET_READ_FIXTURE_SPOOL_ROOT'];
  if (!fixtureRoot || !spoolRoot) fail('PRIVATE_DIRECTORY_REQUIRED');
  const privateRoot = await validatePrivateDirectory(fixtureRoot);
  const privateSpoolRoot = await validatePrivateDirectory(spoolRoot);
  if (privateSpoolRoot !== join(privateRoot, 'spools'))
    fail('PRIVATE_DIRECTORY_INVALID');

  let db: DataSource | undefined;
  let handle:
    | Awaited<ReturnType<LocalStorageAdapter['openAuthenticatedMedia']>>
    | undefined;
  let closed = false;
  const cleanup = async () => {
    if (closed) return;
    closed = true;
    if (handle) await handle.cleanup();
    if (db?.isInitialized) await db.destroy();
  };
  try {
    db = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: Number(process.env['POSTGRES_PORT']),
      username: process.env['POSTGRES_USER'],
      password: process.env['POSTGRES_PASSWORD'],
      database,
      entities: [
        AssetEntity,
        GuardianAssetActivity,
        AccountDeletionWriteFenceEntity,
      ],
      synchronize: false,
      migrationsRun: false,
      extra: { statement_timeout: 8000, lock_timeout: 8000 },
      connectTimeoutMS: 8000,
    });
    await db.initialize();
    const row = await db
      .getRepository(AssetEntity)
      .findOne({ where: { id: fixtureId, lifecycleState: 'active' } });
    if (!row) fail('FIXTURE_ASSET_UNAVAILABLE');

    const encryption = new EnvelopeEncryptionService(process.env);
    const spool = new VerifiedMediaSpoolService(encryption, {
      spoolRoot: privateSpoolRoot,
      maxPlaintextBytes: 1024 * 1024,
      maxConcurrent: 1,
      spoolBudgetBytes: 1024 * 1024,
    });
    const adapter = new LocalStorageAdapter(
      {
        log: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      } as any,
      privateRoot,
      encryption,
      undefined,
      undefined,
      spool
    );
    const fence = new AssetMediaReadFenceService(db);
    handle = await fence.open(row, { maxPlaintextBytes: 1024 * 1024 }, () =>
      adapter.openAuthenticatedMedia!(row, { maxPlaintextBytes: 1024 * 1024 })
    );
    send({
      type: 'ready',
      pid: process.pid,
      path: handle.path,
      processDirectory: spool.processDirectory,
      size: handle.size,
    });
    process.on('message', (command: unknown) => {
      if (command !== 'close') return;
      void cleanup()
        .then(() => {
          send({ type: 'closed' });
          if (typeof process.disconnect === 'function') process.disconnect();
          process.exit(0);
        })
        .catch(() => {
          send({ type: 'error', message: 'CLEANUP_FAILED' });
          process.exit(1);
        });
    });
  } catch {
    try {
      await cleanup();
    } catch {
      /* startup failure remains coarse */
    }
    fail('MEDIA_READ_WORKER_STARTUP_FAILED');
  }
}

void main().catch((error: unknown) => {
  const code =
    error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : 'MEDIA_READ_WORKER_STARTUP_FAILED';
  try {
    send({ type: 'error', message: code });
  } catch {
    /* IPC unavailable */
  }
  process.exit(1);
});
