import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, Repository } from 'typeorm';
import {
  AccountExportArtifactBuilderService,
  AccountExportArtifactStoreService,
  AccountExportOwnerEmitter,
  AccountExportOwnerSpoolService,
  EnvelopeEncryptionService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import loadDatabase from '../app/loadDatabase';
import { AccountExportArtifactService } from './account-export-artifact.service';
import { ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY } from './account-export-release-registry';
import { AccountExportJobEntity } from './entities/account-export-job.entity';
import { AccountExportJobService } from './account-export-job.service';
import { AccountExportDownloadService } from './account-export-download.service';
import { AccountExportArtifactRetentionService } from './account-export-artifact-retention.service';

const enabled = process.env.A04_PRIVATE_DB_MARKER === 'private-a04-ledger-v1';
const suite = enabled ? describe : describe.skip;

suite('A04 migrated PostgreSQL artifact custody and lease fencing', () => {
  let db: DataSource;
  let jobs: Repository<AccountExportJobEntity>;
  let root: string;
  let store: AccountExportArtifactStoreService;
  let service: AccountExportArtifactService;
  let handles: OwnerSpoolHandle<string>[];
  const accountId = randomUUID();

  beforeAll(async () => {
    if (process.env.A04_PRIVATE_DB_NAME !== 'ot_a04_artifact_jobs')
      throw new Error('Private fixture database required');
    const config = {
      get: () => ({
        host: '127.0.0.1',
        port: Number(process.env.A04_PRIVATE_DB_PORT),
        username: 'postgres',
        password: process.env.A04_PRIVATE_DB_PASSWORD,
        database: 'ot_a04_artifact_jobs',
      }),
    };
    db = new DataSource({
      ...loadDatabase(config as never),
      migrationsRun: false,
    });
    await db.initialize();
    await db.runMigrations();
    jobs = db.getRepository(AccountExportJobEntity);
    expect(await jobs.count()).toBe(0);
    root = await mkdtemp(join(tmpdir(), 'a04-ledger-'));
    store = new AccountExportArtifactStoreService(
      new EnvelopeEncryptionService({
        VAULT_STORAGE_KEK: randomBytes(32).toString('base64'),
        VAULT_STORAGE_KEK_ID: 'private-a04',
      }),
      { root: join(root, 'encrypted') }
    );
    service = new AccountExportArtifactService(
      jobs,
      new AccountExportArtifactBuilderService(),
      store
    );
    handles = [];
    for (const [participantId, sources] of Object.entries(
      ACCOUNT_EXPORT_RELEASE_SOURCE_REGISTRY
    )) {
      handles.push(
        await new AccountExportOwnerSpoolService().capture(
          { participantId, accountId, sources, spoolRoot: root },
          async (sink, signal) => {
            const emitter = new AccountExportOwnerEmitter(
              {
                participantId,
                accountId,
                captureId: randomUUID(),
                snapshotAt: new Date().toISOString(),
                sources,
                signal,
              },
              sink
            );
            const readers = Object.fromEntries(
              sources.map((source) => [
                source,
                async function* () {
                  // Synthetic owner streams isolate artifact/ledger behavior. Media transport is qualified separately.
                  if (source !== 'assetMedia')
                    yield {
                      source,
                      data: { id: randomUUID(), fixture: 'a04' },
                    };
                },
              ])
            );
            await emitter.emitSources(readers);
            return emitter.complete();
          }
        )
      );
    }
  }, 60000);

  afterAll(async () => {
    for (const handle of handles || []) await handle.cleanup();
    if (db?.isInitialized) {
      if (jobs) {
        await jobs.delete({ accountId });
        expect(await jobs.count()).toBe(0);
      }
      await db.destroy();
    }
    if (root) await rm(root, { recursive: true, force: true });
  });

  const claim = async () =>
    jobs.save(
      jobs.create({
        accountId,
        appId: 'client-interface',
        kind: 'export',
        idempotencyKey: randomUUID(),
        state: 'running',
        attempt: 1,
        leaseOwner: randomUUID(),
        leaseExpiresAt: new Date(Date.now() + 60000),
        coverageSummary: {},
      })
    );

  it('persists intent before bytes, verifies encrypted readback, and recovers after a new worker claim', async () => {
    const row = await claim();
    const staged = await service.prepare({
      claim: row,
      handles,
      summary: {},
      renewLease: async () => true,
    });
    const persisted = await jobs.findOneByOrFail({ id: row.id });
    expect(persisted.coverageSummary).toMatchObject({
      artifactState: 'assembling',
      artifactAvailable: false,
      privateArtifact: staged.descriptor,
    });
    const opened = await store.openVerified(staged.descriptor);
    expect(opened.sizeBytes).toBe(staged.descriptor.sizeBytes);
    await opened.cleanup();
    // Simulate process death after publish: a new instance/nonce must clean old custody before retry.
    await jobs.update(row.id, { attempt: 2, leaseOwner: randomUUID() });
    const next = await jobs.findOneByOrFail({ id: row.id });
    const restarted = new AccountExportArtifactService(
      jobs,
      new AccountExportArtifactBuilderService(),
      store
    );
    await restarted.recover(next, async () => true);
    expect(await store.inspectAbsent(staged.descriptor.artifactId)).toBe(true);
    expect(
      (await jobs.findOneByOrFail({ id: row.id })).coverageSummary
    ).not.toHaveProperty('privateArtifact');
    const retry = await restarted.prepare({
      claim: next,
      handles,
      summary: {},
      renewLease: async () => true,
    });
    expect(retry.descriptor.artifactId).not.toBe(staged.descriptor.artifactId);
    await restarted.discard(next, retry.descriptor);
    await jobs.delete(row.id);
  });

  it('rejects a stale worker CAS while the current worker retains its own artifact', async () => {
    const old = await claim();
    await jobs.update(old.id, { attempt: 2, leaseOwner: randomUUID() });
    const current = await jobs.findOneByOrFail({ id: old.id });
    await expect(
      service.prepare({
        claim: old,
        handles,
        summary: {},
        renewLease: async () => true,
      })
    ).rejects.toThrow('ARTIFACT_LEASE_LOST');
    const result = await service.prepare({
      claim: current,
      handles,
      summary: {},
      renewLease: async () => true,
    });
    const stale = Object.assign(new AccountExportJobEntity(), current, {
      leaseOwner: old.leaseOwner,
      coverageSummary: { privateArtifact: result.descriptor },
    });
    await expect(service.recover(stale, async () => false)).rejects.toThrow(
      'ARTIFACT_LEASE_LOST'
    );
    expect(await store.inspectAbsent(result.descriptor.artifactId)).toBe(false);
    await service.discard(current, result.descriptor);
    await jobs.delete(old.id);
  });

  it('enforces the account quota from durable private intents and restores rows and files', async () => {
    const a = await claim();
    const b = await claim();
    const c = await claim();
    const first = await service.prepare({
      claim: a,
      handles,
      summary: {},
      renewLease: async () => true,
    });
    const second = await service.prepare({
      claim: b,
      handles,
      summary: {},
      renewLease: async () => true,
    });
    await expect(
      service.prepare({
        claim: c,
        handles,
        summary: {},
        renewLease: async () => true,
      })
    ).rejects.toThrow('ARTIFACT_ACCOUNT_QUOTA_EXCEEDED');
    await service.discard(a, first.descriptor);
    await service.discard(b, second.descriptor);
    await jobs.delete([a.id, b.id, c.id]);
    expect(await jobs.count()).toBe(0);
    expect(await readdir(join(root, 'encrypted'))).toEqual([]);
  });

  it('cleans a crashed job despite missing session authority and retries a storage failure from its durable intent', async () => {
    const row = await claim();
    const staged = await service.prepare({
      claim: row,
      handles,
      summary: {
        privateSessionRef: randomUUID(),
      },
      renewLease: async () => true,
    });
    await jobs.update(row.id, { leaseExpiresAt: new Date(Date.now() - 1000) });
    const worker: any = Object.create(AccountExportJobService.prototype);
    Object.assign(worker, {
      jobs,
      dataSource: db,
      artifacts: service,
      closing: false,
      recovering: false,
      background: new Set(),
    });
    const remove = jest.spyOn(store, 'remove');
    remove.mockRejectedValueOnce(new Error('private transient storage fault'));
    await worker.recoverBackground();
    const retryable = await jobs.findOneByOrFail({ id: row.id });
    expect(retryable.state).toBe('failed');
    expect(retryable.coverageSummary).toMatchObject({
      artifactState: 'cleanup-pending',
      privateArtifact: staged.descriptor,
      artifactAvailable: false,
    });
    expect(retryable.coverageSummary).not.toHaveProperty('privateSessionRef');
    expect(await store.inspectAbsent(staged.descriptor.artifactId)).toBe(false);
    await worker.recoverBackground();
    const cleared = await jobs.findOneByOrFail({ id: row.id });
    expect(cleared.state).toBe('failed');
    expect(cleared.coverageSummary).not.toHaveProperty('privateArtifact');
    expect(await store.inspectAbsent(staged.descriptor.artifactId)).toBe(true);
    remove.mockRestore();
    await jobs.delete(row.id);
  });

  it('serves verified private bytes, denies a revoked session, and expires ciphertext with failed-delete retry', async () => {
    const row = await claim();
    const staged = await service.prepare({
      claim: row,
      handles,
      summary: {
        captureCoverage: { complete: true },
      },
      renewLease: async () => true,
    });
    await jobs.update(row.id, {
      state: 'complete',
      leaseOwner: null,
      leaseExpiresAt: null,
      coverageSummary: { ...staged.summary, artifactAvailable: true },
    });
    const auth = {
      validateToken: jest.fn(async () => ({
        isValid: true,
        data: { userId: accountId, appId: 'client-interface' },
      })),
    };
    const downloads = new AccountExportDownloadService(
      jobs,
      store,
      auth as never
    );
    const request = {
      accountId,
      appId: 'client-interface',
      jobId: row.id,
      token: 'private-fixture-session',
    };
    const opened = await downloads.open(request);
    const first = await downloads.read({
      ...request,
      downloadId: opened.downloadId,
      offset: 0,
      length: 512,
    });
    expect(Buffer.from(first.bytesBase64, 'base64').toString()).toContain(
      'manifest.json'
    );
    auth.validateToken.mockResolvedValueOnce({
      isValid: false,
      data: { userId: accountId, appId: 'client-interface' },
    });
    await expect(
      downloads.read({
        ...request,
        downloadId: opened.downloadId,
        offset: 512,
        length: 512,
      })
    ).rejects.toThrow();
    const next = await downloads.open(request);
    const expired = {
      ...staged.descriptor,
      expiresAt: new Date(Date.now() - 1).toISOString(),
    };
    await jobs.update(row.id, {
      coverageSummary: { ...staged.summary, privateArtifact: expired },
    });
    const retention = new AccountExportArtifactRetentionService(
      jobs,
      store,
      downloads
    );
    const purge = jest.spyOn(store, 'purgeOwnedArtifact');
    purge.mockRejectedValueOnce(new Error('private transient purge fault'));
    expect(await retention.sweep()).toEqual({ removed: 0, failed: 1 });
    expect(
      (await jobs.findOneByOrFail({ id: row.id })).coverageSummary
    ).toMatchObject({
      artifactState: 'cleanup-pending',
      privateArtifact: expired,
      artifactAvailable: false,
    });
    await expect(
      downloads.read({
        ...request,
        downloadId: next.downloadId,
        offset: 0,
        length: 512,
      })
    ).rejects.toThrow();
    expect(await retention.sweep()).toEqual({ removed: 1, failed: 0 });
    expect(await store.inspectAbsent(expired.artifactId)).toBe(true);
    const kept = await jobs.findOneByOrFail({ id: row.id });
    expect(kept.coverageSummary).not.toHaveProperty('privateArtifact');
    expect(kept.coverageSummary).toMatchObject({
      artifactState: 'expired',
      captureCoverage: { complete: true },
    });
    await downloads.onModuleDestroy();
    purge.mockRestore();
    await jobs.delete(row.id);
  });

  it('persists the background session reference through the real launch SQL before returning running status', async () => {
    const row = await claim();
    await jobs.update(row.id, {
      state: 'queued',
      attempt: 0,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ref = randomUUID();
    const worker: any = Object.create(AccountExportJobService.prototype);
    Object.assign(worker, {
      jobs,
      dataSource: db,
      closing: false,
      activeLaunches: 0,
      background: new Set(),
      sessionReference: async () => ref,
      run: async () => pending,
    });
    const status = await worker.launch(
      {
        accountId,
        appId: 'client-interface',
        token: 'memory-only-fixture',
        idempotencyKey: row.idempotencyKey,
      },
      row
    );
    expect(status.state).toBe('running');
    const persisted = await jobs.findOneByOrFail({ id: row.id });
    expect(persisted.coverageSummary.privateSessionRef).toBe(ref);
    expect(JSON.stringify(persisted.coverageSummary)).not.toContain(
      'memory-only-fixture'
    );
    expect(JSON.stringify(status)).not.toContain(ref);
    release();
    await Promise.all([...worker.background]);
    await jobs.delete(row.id);
  });

  it('fences a delayed final writer after expiry acknowledges deletion', async () => {
    const row = await claim();
    let ready!: () => void;
    let release!: () => void;
    const staged = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const put = store.put.bind(store);
    let mutations = 0;
    const interception = jest
      .spyOn(store, 'put')
      .mockImplementationOnce(async (input) =>
        put({
          ...input,
          withCurrentLease: async (commit) => {
            if (++mutations === 2) {
              ready();
              await blocked;
            }
            await input.withCurrentLease!(commit);
          },
        })
      );
    // Observe rejection immediately to avoid an unhandled background promise in the fixture.
    const late = service
      .prepare({
        claim: row,
        handles,
        summary: {},
        renewLease: async () => true,
      })
      .then(
        () => null,
        (error) => error
      );
    await staged;
    const saved = await jobs.findOneByOrFail({ id: row.id });
    const d = saved.coverageSummary.privateArtifact as any;
    await jobs.update(row.id, {
      state: 'incomplete',
      leaseOwner: null,
      leaseExpiresAt: null,
      coverageSummary: {
        ...saved.coverageSummary,
        privateArtifact: {
          ...d,
          expiresAt: new Date(Date.now() - 1).toISOString(),
        },
      },
    });
    const retention = new AccountExportArtifactRetentionService(jobs, store, {
      invalidateJob: async () => undefined,
    } as never);
    expect(await retention.sweep()).toEqual({ removed: 1, failed: 0 });
    expect(await readdir(join(root, 'encrypted'))).toEqual([]);
    release();
    expect((await late).message).toBe('ARTIFACT_LEASE_LOST');
    expect(await store.inspectAbsent(d.artifactId)).toBe(true);
    expect(
      (await jobs.findOneByOrFail({ id: row.id })).coverageSummary
    ).not.toHaveProperty('privateArtifact');
    interception.mockRestore();
    await jobs.delete(row.id);
  });
});
