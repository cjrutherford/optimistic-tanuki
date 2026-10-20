import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  readlink,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { of } from 'rxjs';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AssetType,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerSpoolService,
  EnvelopeEncryptionService,
  LocalStorageAdapter,
  VerifiedMediaSpoolService,
} from '@optimistic-tanuki/storage';
import {
  AssetsAccountExportOwnerService,
  ASSETS_ACCOUNT_EXPORT_SOURCES,
} from './account-export-owner.service';
import { AssetsAccountExportMediaReader } from './account-export-media-reader';
import { AssetsAccountExportProfileSnapshotClient } from './account-export-profile-snapshot.client';
import loadDatabase from './loadDatabase';
import { Initial1750254462767 } from '../../migrations/1750254462767-initial';
import { AddAssetAudience1791388918098 } from '../../migrations/1791388918098-AddAssetAudience';
import { AddAssetAudienceRestrictions1791404042845 } from '../../migrations/1791404042845-AddAssetAudienceRestrictions';
import { GuardianAssetLifecycleAndActivity1792070262860 } from '../../migrations/1792070262860-GuardianAssetLifecycleAndActivity';
import { GuardianMediaStageProvenance1792114070986 } from '../../migrations/1792114070986-GuardianMediaStageProvenance';

// Unrelated adapter dependency is ESM-only in this Jest configuration.
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const DB = 'assets_owner_j8_fixture';
const enabled =
  process.env['ASSETS_OWNER_PG_OPT_IN'] === DB &&
  process.env['ASSETS_OWNER_PG_NAME'] === DB &&
  process.env['ASSETS_OWNER_PG_HOST'] === '127.0.0.1' &&
  process.env['ASSETS_OWNER_PG_PORT'] === '15550' &&
  process.env['ASSETS_OWNER_PG_USER'] === 'assets_fixture' &&
  !!process.env['ASSETS_OWNER_PG_PASSWORD'];
const describePg = enabled ? describe : describe.skip;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const PA = '00000000-0000-0000-0000-000000000000';
const PA2 = '44444444-4444-4444-8444-444444444444';
const PB = '55555555-5555-4555-8555-555555555555';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xWQAAAAASUVORK5CYII=',
  'base64'
);

describePg(
  'Assets complete owner real PostgreSQL and encrypted storage component',
  () => {
    jest.setTimeout(90_000);
    let db: DataSource;
    let root: string;
    let mediaRoot: string;
    let ownerRoot: string;
    let storedRoot: string;
    let adapter: LocalStorageAdapter;
    let encryption: EnvelopeEncryptionService;
    let verified: VerifiedMediaSpoolService;
    let reader: AssetsAccountExportOwnerService;
    const spool = new AccountExportOwnerSpoolService();
    const ownedProfiles = [
      PA,
      PA2,
      ...Array.from({ length: 1004 }, () => randomUUID()),
    ].sort();
    const imageIds = [
      '00000000-0000-0000-0000-000000000000',
      ...Array.from({ length: 1004 }, () => randomUUID()),
    ].sort();
    const videoId = randomUUID();
    const foreignAssetId = randomUUID();
    const lateId = randomUUID();
    const deletedAssetId = randomUUID();
    const activityIds = Array.from({ length: 6 }, () => randomUUID());
    let video: Buffer;
    let pngEnvelope: Buffer;
    let allowLease = true;
    const grant: AccountExportCaptureGrant = {
      accountId: A,
      appId: 'client-interface',
      token: 'private-fixture-session',
      jobId: randomUUID(),
      attempt: 1,
      leaseOwner: randomUUID(),
    };
    const descriptor: AccountExportSnapshotDescriptor = {
      participantId: 'profile',
      accountId: A,
      handleId: randomUUID(),
      captureId: randomUUID(),
      snapshotAt: '2026-10-20 00:00:00.123456+00',
      identityCount: ownedProfiles.length,
      sizeBytes: 1,
      sha256: 'a'.repeat(64),
      rowCount: ownedProfiles.length,
      sources: ['profileIdentity'],
      sourceRowCounts: { profileIdentity: ownedProfiles.length },
      sourceDispositions: { profileIdentity: 'retained' },
      expiresAt: '2099-01-01T00:00:00.000Z',
    };
    const profileSend = jest.fn((pattern: { cmd: string }, request: any) => {
      if (pattern.cmd === ProfileCommands.ReadAccountExportCaptureIdentities) {
        const ids = request.accountId === C ? [] : ownedProfiles;
        const end = Math.min(request.offset + request.limit, ids.length);
        return of({
          handleId: request.handleId,
          captureId: descriptor.captureId,
          accountId: request.accountId,
          snapshotAt: descriptor.snapshotAt,
          profileIds: ids.slice(request.offset, end),
          total: ids.length,
          nextOffset: end < ids.length ? end : null,
        });
      }
      if (pattern.cmd === ProfileCommands.Get)
        return of({
          id: request.id,
          userId:
            request.id === PB
              ? B
              : ownedProfiles.includes(request.id)
              ? A
              : null,
        });
      throw Error('Unexpected profile fixture command');
    });
    const authSend = jest.fn((pattern: { cmd: string }) => {
      if (pattern.cmd !== AuthCommands.ValidateAccountExportLease)
        throw Error('Unexpected authentication fixture command');
      return of(allowLease ? { valid: true } : { valid: false });
    });

    async function fingerprint() {
      return {
        assets: await db.query(
          'SELECT jsonb_agg(to_jsonb(a) ORDER BY id)::text AS data FROM asset_entity a'
        ),
        activities: await db.query(
          'SELECT jsonb_agg(to_jsonb(a) ORDER BY id)::text AS data FROM guardian_asset_activity a'
        ),
      };
    }
    async function resources() {
      const temp = await db.query(
        "SELECT count(*)::int AS n FROM pg_class WHERE relpersistence='t' AND relname LIKE 'assets_export_scope_%'"
      );
      expect(temp[0].n).toBe(0);
      const descriptors = await Promise.all(
        (
          await readdir('/proc/self/fd')
        ).map(async (fd) => {
          try {
            return await readlink('/proc/self/fd/' + fd);
          } catch {
            return '';
          }
        })
      );
      expect(
        descriptors.filter((p) =>
          p.startsWith(join(ownerRoot, 'ot-owner-spool-'))
        )
      ).toEqual([]);
      const mediaDirs = await readdir(mediaRoot);
      for (const dir of mediaDirs)
        expect(await readdir(join(mediaRoot, dir))).toEqual([]);
    }
    async function capture(
      inputGrant = grant,
      inputDescriptor = descriptor,
      onChunk?: (chunk: any) => Promise<void>,
      externalSignal?: AbortSignal
    ) {
      let producer:
        | ReturnType<AssetsAccountExportOwnerService['captureAccount']>
        | undefined;
      try {
        return await spool.capture(
          {
            participantId: 'assets',
            accountId: inputGrant.accountId,
            sources: ASSETS_ACCOUNT_EXPORT_SOURCES,
            spoolRoot: ownerRoot,
            signal: externalSignal,
          },
          (sink, signal) =>
            (producer = reader.captureAccount({
              grant: inputGrant,
              profileSnapshot: inputDescriptor,
              signal,
              onChunk: async (chunk) => {
                await onChunk?.(chunk);
                await sink(chunk);
              },
            }))
        );
      } finally {
        if (producer) await producer.catch(() => undefined);
      }
    }
    async function records(handle: Awaited<ReturnType<typeof capture>>) {
      const parts: Buffer[] = [];
      for await (const part of handle.createReadStream())
        parts.push(Buffer.from(part));
      return Buffer.concat(parts)
        .toString('utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
        .flatMap((chunk) => chunk.records) as { source: string; data: any }[];
    }

    beforeAll(async () => {
      root = await mkdtemp(join(tmpdir(), 'assets-owner-pg-'));
      mediaRoot = join(root, 'media');
      ownerRoot = join(root, 'owner');
      storedRoot = join(root, 'stored');
      await mkdir(storedRoot);
      await mkdir(mediaRoot);
      await mkdir(ownerRoot);
      encryption = new EnvelopeEncryptionService({
        VAULT_STORAGE_KEK: 'isolated-assets-owner-fixture-kek',
      });
      verified = new VerifiedMediaSpoolService(encryption, {
        spoolRoot: mediaRoot,
        maxPlaintextBytes: 1024 * 1024,
        maxConcurrent: 1,
        spoolBudgetBytes: 1024 * 1024,
      });
      adapter = new LocalStorageAdapter(
        new Logger('AssetsOwnerFixture'),
        storedRoot,
        encryption,
        undefined,
        { isZfsRequired: () => false } as any,
        verified
      );
      pngEnvelope = encryption.encrypt(PNG);
      await writeFile(join(storedRoot, 'fixture.png.env'), pngEnvelope);
      const videoPath = join(root, 'fixture.mp4');
      await promisify(execFile)(
        'ffmpeg',
        [
          '-v',
          'error',
          '-f',
          'lavfi',
          '-i',
          'color=c=blue:s=16x16:d=0.1',
          '-an',
          '-c:v',
          'mpeg4',
          '-y',
          videoPath,
        ],
        { timeout: 10_000 }
      );
      video = await readFile(videoPath);
      await writeFile(
        join(storedRoot, 'fixture.mp4.env'),
        encryption.encrypt(video)
      );
      // Keep fixture credentials out of the existing datasource factory's diagnostic output.
      const options = loadDatabase({
        get: () => ({
          host: '127.0.0.1',
          port: 15550,
          username: 'assets_fixture',
          database: DB,
        }),
      } as any);
      db = new DataSource({
        ...options,
        password: process.env['ASSETS_OWNER_PG_PASSWORD'],
        synchronize: false,
        logging: false,
        migrations: [
          Initial1750254462767,
          AddAssetAudience1791388918098,
          AddAssetAudienceRestrictions1791404042845,
          GuardianAssetLifecycleAndActivity1792070262860,
          GuardianMediaStageProvenance1792114070986,
        ],
        extra: { max: 3, connectionTimeoutMillis: 3000 },
      });
      await db.initialize();
      await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      expect(await db.runMigrations()).toHaveLength(5);
      for (let i = 0; i < imageIds.length; i += 100)
        await db.query(
          `INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId") SELECT x,'owned.png','image','local_block_storage','fixture.png.env',$2 FROM unnest($1::uuid[]) x`,
          [imageIds.slice(i, i + 100), PA]
        );
      await db.query(
        `INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId") VALUES ($1,'owned.mp4','video','local_block_storage','fixture.mp4.env',$2),($3,'foreign.png','image','local_block_storage','fixture.png.env',$4)`,
        [videoId, PA2, foreignAssetId, PB]
      );
      const activityRows = [
        [A, B, PB, foreignAssetId, 'read'],
        [B, A, PA, imageIds[0], 'upload'],
        [A, A, PA2, videoId, 'read'],
        [A, A, PA, deletedAssetId, 'delete'],
        [A, A, PA, '*', 'list'],
        [B, B, PB, foreignAssetId, 'read'],
      ];
      for (let i = 0; i < activityRows.length; i++) {
        const [actor, dependent, profile, asset, operation] = activityRows[i];
        await db.query(
          `INSERT INTO guardian_asset_activity (id,"actorUserId","dependentUserId","profileId","assetId","appId",operation,"changedFieldNames","createdAt") VALUES ($1,$2,$3,$4,$5,'client-interface',$6,'[]','2026-10-20 01:02:03.123456+00')`,
          [activityIds[i], actor, dependent, profile, asset, operation]
        );
      }
      const profileClient = { send: profileSend } as unknown as ClientProxy;
      reader = new AssetsAccountExportOwnerService(
        db,
        new AssetsAccountExportProfileSnapshotClient(profileClient),
        new AssetsAccountExportMediaReader({
          openAuthenticatedMedia: (asset, opts) =>
            adapter.openAuthenticatedMedia(asset as any, opts),
        }),
        { send: authSend } as unknown as ClientProxy,
        profileClient
      );
    });
    afterAll(async () => {
      try {
        if (db?.isInitialized) {
          await db.query(
            'DELETE FROM guardian_asset_activity WHERE id=ANY($1::uuid[])',
            [activityIds]
          );
          await db.query('DELETE FROM asset_entity WHERE id=ANY($1::uuid[])', [
            [...imageIds, videoId, foreignAssetId, lateId],
          ]);
          const [a] = await db.query(
            'SELECT count(*)::int AS n FROM asset_entity'
          );
          const [g] = await db.query(
            'SELECT count(*)::int AS n FROM guardian_asset_activity'
          );
          expect(a.n).toBe(0);
          expect(g.n).toBe(0);
          await resources();
        }
      } finally {
        await db?.destroy();
        if (root) await rm(root, { recursive: true, force: true });
      }
    });

    it('captures over1000 unreferenced owned assets and real image/video bytes, preserves guardian roles and counterparts', async () => {
      const before = await fingerprint();
      const handle = await capture();
      try {
        const all = await records(handle);
        const assets = all.filter((r) => r.source === 'asset');
        const media = all.filter((r) => r.source === 'assetMedia');
        const activities = all.filter((r) => r.source === 'guardianActivity');
        expect(assets).toHaveLength(1006);
        expect(assets.map((r) => r.data.id).sort()).toEqual(
          [...imageIds, videoId].sort()
        );
        expect(activities).toHaveLength(5);
        expect(activities.map((r) => r.data.id).sort()).toEqual(
          activityIds.slice(0, 5).sort()
        );
        for (const [id, bytes, mime] of [
          [imageIds[0], PNG, 'image/png'],
          [videoId, video, 'video/mp4'],
        ] as const) {
          const assetMedia = media.filter((r) => r.data.assetId === id);
          expect(
            Buffer.concat(
              assetMedia
                .filter((r) => r.data.kind === 'bytes')
                .map((r) => Buffer.from(r.data.bytesBase64, 'base64'))
            )
          ).toEqual(bytes);
          expect(
            assetMedia.find((r) => r.data.kind === 'manifest')?.data
          ).toMatchObject({
            mimeType: mime,
            sizeBytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'),
            validation: 'signature',
          });
        }
        const serialized = JSON.stringify(all);
        for (const privateValue of [
          B,
          PB,
          foreignAssetId,
          activityIds[5],
          'fixture.png.env',
          'storagePath',
          grant.token,
          grant.leaseOwner,
          'isolated-assets-owner-fixture-kek',
        ])
          expect(serialized).not.toContain(privateValue);
        expect(serialized).toContain(deletedAssetId);
        expect(serialized).toContain('.123456');
        expect(handle.metadata.sourceRowCounts.asset).toBe(1006);
        expect(handle.metadata.sourceRowCounts.guardianActivity).toBe(5);
        expect(
          profileSend.mock.calls.filter(
            ([p]) =>
              p.cmd === ProfileCommands.ReadAccountExportCaptureIdentities
          ).length
        ).toBe(11);
      } finally {
        await handle.cleanup();
      }
      expect(await fingerprint()).toEqual(before);
      await resources();
    });

    it('holds one Assets snapshot while a later owned row is inserted and verifies an actually empty account', async () => {
      let added = false;
      const handle = await capture(grant, descriptor, async (chunk) => {
        if (!added && chunk.source === 'asset' && chunk.records.length) {
          added = true;
          await db.query(
            `INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId") VALUES ($1,'late.png','image','local_block_storage','fixture.png.env',$2)`,
            [lateId, PA]
          );
        }
      });
      try {
        expect(
          (await records(handle)).find((r) => r.data.id === lateId)
        ).toBeUndefined();
        expect(handle.metadata.sourceRowCounts.asset).toBe(1006);
      } finally {
        await handle.cleanup();
        await db.query('DELETE FROM asset_entity WHERE id=$1', [lateId]);
      }
      const empty = await capture(
        { ...grant, accountId: C },
        { ...descriptor, accountId: C, identityCount: 0 }
      );
      try {
        expect(empty.metadata.rowCount).toBe(0);
        expect(empty.metadata.sourceRowCounts).toEqual({
          asset: 0,
          assetMedia: 0,
          guardianActivity: 0,
        });
      } finally {
        await empty.cleanup();
      }
      await resources();
    });

    it('fails closed for missing/corrupted media, pending rows, hostile names, contradictory relationships and revoked lease', async () => {
      const before = await fingerprint();
      for (const [field, value] of [
        ['storagePath', 'missing.env'],
        ['storageStrategy', 'database_storage'],
        ['lifecycleState', 'pending-delete'],
        ['name', '../private.png'],
      ] as const) {
        const [original] = await db.query(
          `SELECT "${field}" FROM asset_entity WHERE id=$1`,
          [imageIds[0]]
        );
        try {
          await db.query(`UPDATE asset_entity SET "${field}"=$2 WHERE id=$1`, [
            imageIds[0],
            value,
          ]);
          await expect(capture()).rejects.toBeDefined();
        } finally {
          await db.query(`UPDATE asset_entity SET "${field}"=$2 WHERE id=$1`, [
            imageIds[0],
            original[field],
          ]);
        }
        await resources();
      }
      const damaged = Buffer.from(pngEnvelope);
      damaged[damaged.length - 1] ^= 0xff;
      try {
        await writeFile(join(storedRoot, 'fixture.png.env'), damaged);
        await expect(capture()).rejects.toBeDefined();
      } finally {
        await writeFile(join(storedRoot, 'fixture.png.env'), pngEnvelope);
      }
      try {
        await db.query(
          'UPDATE guardian_asset_activity SET "dependentUserId"=$2 WHERE id=$1',
          [activityIds[0], A]
        );
        await expect(capture()).rejects.toBeDefined();
      } finally {
        await db.query(
          'UPDATE guardian_asset_activity SET "dependentUserId"=$2 WHERE id=$1',
          [activityIds[0], B]
        );
      }
      try {
        allowLease = false;
        await expect(capture()).rejects.toBeDefined();
      } finally {
        allowLease = true;
      }
      expect(await fingerprint()).toEqual(before);
      await resources();
    });
    it('discards partial captures on cancellation and lease loss, and evicts a dirty pooled connection', async () => {
      const before = await fingerprint();
      const abort = new AbortController();
      await expect(
        capture(
          grant,
          descriptor,
          async (chunk) => {
            if (chunk.source === 'asset' && chunk.records.length) abort.abort();
          },
          abort.signal
        )
      ).rejects.toBeDefined();
      await resources();
      try {
        await expect(
          capture(grant, descriptor, async (chunk) => {
            if (chunk.source === 'asset' && chunk.records.length)
              allowLease = false;
          })
        ).rejects.toBeDefined();
      } finally {
        allowLease = true;
      }
      await resources();
      const original = reader;
      const profileClient = { send: profileSend } as unknown as ClientProxy;
      let connections = 0;
      const isolated = {
        createQueryRunner: () => {
          connections++;
          const runner = db.createQueryRunner();
          const query = runner.query.bind(runner);
          runner.query = async (...args: Parameters<typeof query>) => {
            if (String(args[0]).startsWith('DROP TABLE'))
              throw Error('synthetic private cleanup failure');
            return query(...args);
          };
          return runner;
        },
      } as unknown as DataSource;
      reader = new AssetsAccountExportOwnerService(
        isolated,
        new AssetsAccountExportProfileSnapshotClient(profileClient),
        new AssetsAccountExportMediaReader({
          openAuthenticatedMedia: (asset, options) =>
            adapter.openAuthenticatedMedia(asset as any, options),
        }),
        { send: authSend } as unknown as ClientProxy,
        profileClient
      );
      try {
        // Empty scope keeps this fault isolated to real transaction/temporary-table cleanup.
        await expect(
          capture(
            { ...grant, accountId: C },
            { ...descriptor, accountId: C, identityCount: 0 }
          )
        ).rejects.toBeDefined();
        await expect(capture()).rejects.toBeDefined();
        expect(connections).toBe(1);
        const until = Date.now() + 2000;
        while (true) {
          const [row] = await db.query(
            "SELECT count(*)::int AS n FROM pg_class WHERE relpersistence='t' AND relname LIKE 'assets_export_scope_%'"
          );
          if (row.n === 0) break;
          if (Date.now() >= until)
            throw Error('Dirty export connection was not evicted');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      } finally {
        reader = original;
      }
      expect(await fingerprint()).toEqual(before);
      await resources();
    });
  }
);
