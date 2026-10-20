import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
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
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerSpoolService,
  EnvelopeEncryptionService,
  LocalStorageAdapter,
  VerifiedMediaSpoolService,
  rewriteAccountExportHlsPlaylist,
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

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const DB = 'assets_hls_j12_fixture';
const enabled =
  process.env['ASSETS_HLS_PG_OPT_IN'] === DB &&
  process.env['ASSETS_HLS_PG_NAME'] === DB &&
  process.env['ASSETS_HLS_PG_HOST'] === '127.0.0.1' &&
  process.env['ASSETS_HLS_PG_PORT'] === '15552' &&
  process.env['ASSETS_HLS_PG_USER'] === 'assets_fixture' &&
  !!process.env['ASSETS_HLS_PG_PASSWORD'];
const describePg = enabled ? describe : describe.skip;
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';
const PROFILE_A = '33333333-3333-4333-8333-333333333333';
const PROFILE_B = '44444444-4444-4444-8444-444444444444';
const PROFILE_FOREIGN = '55555555-5555-4555-8555-555555555555';
const exec = promisify(execFile);

describePg('Assets real PostgreSQL HLS capture acceptance', () => {
  jest.setTimeout(30_000);
  let db: DataSource;
  let root: string;
  let storedRoot: string;
  let mediaRoot: string;
  let ownerRoot: string;
  let encryption: EnvelopeEncryptionService;
  let adapter: LocalStorageAdapter;
  let reader: AssetsAccountExportOwnerService;
  let allowLease = true;
  let sourceVideo: Buffer;
  let originalPlaylist: Buffer;
  let segmentBytes: Buffer[] = [];
  let manifestId = randomUUID();
  let segmentIds: string[] = [];
  let segmentPaths: string[] = [];
  const spool = new AccountExportOwnerSpoolService();
  const grant: AccountExportCaptureGrant = {
    accountId: ACCOUNT,
    appId: 'client-interface',
    token: 'private-fixture-session',
    jobId: randomUUID(),
    attempt: 1,
    leaseOwner: randomUUID(),
  };
  const descriptor: AccountExportSnapshotDescriptor = {
    participantId: 'profile',
    accountId: ACCOUNT,
    handleId: randomUUID(),
    captureId: randomUUID(),
    snapshotAt: '2026-10-20 00:00:00.123456+00',
    identityCount: 2,
    sizeBytes: 1,
    sha256: 'a'.repeat(64),
    rowCount: 2,
    sources: ['profileIdentity'],
    sourceRowCounts: { profileIdentity: 2 },
    sourceDispositions: { profileIdentity: 'retained' },
    expiresAt: '2099-01-01T00:00:00.000Z',
  };
  const profiles = [PROFILE_A, PROFILE_B];
  const profileSend = jest.fn((pattern: { cmd: string }, request: any) => {
    if (pattern.cmd === ProfileCommands.ReadAccountExportCaptureIdentities) {
      const end = Math.min(request.offset + request.limit, profiles.length);
      return of({
        handleId: request.handleId,
        captureId: descriptor.captureId,
        accountId: request.accountId,
        snapshotAt: descriptor.snapshotAt,
        profileIds: profiles.slice(request.offset, end),
        total: profiles.length,
        nextOffset: end < profiles.length ? end : null,
      });
    }
    if (pattern.cmd === ProfileCommands.Get)
      return of({
        id: request.id,
        userId: request.id === PROFILE_FOREIGN ? FOREIGN : ACCOUNT,
      });
    throw Error('Unexpected profile fixture command');
  });
  const authSend = jest.fn((pattern: { cmd: string }) => {
    if (pattern.cmd !== AuthCommands.ValidateAccountExportLease)
      throw Error('Unexpected auth command');
    return of(allowLease ? { valid: true } : { valid: false });
  });

  async function playlist(ids: string[]): Promise<Buffer> {
    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:6',
      '#EXT-X-MEDIA-SEQUENCE:0',
    ];
    for (const id of ids) lines.push('#EXTINF:6.000,', `/api/asset/${id}`);
    lines.push('#EXT-X-ENDLIST');
    return Buffer.from(lines.join('\n') + '\n');
  }
  async function encryptedWrite(name: string, bytes: Buffer) {
    await writeFile(join(storedRoot, name), encryption.encrypt(bytes));
  }
  async function capture(
    onChunk?: (chunk: any) => Promise<void>,
    signal?: AbortSignal
  ) {
    let producer:
      | ReturnType<AssetsAccountExportOwnerService['captureAccount']>
      | undefined;
    try {
      return await spool.capture(
        {
          participantId: 'assets',
          accountId: ACCOUNT,
          sources: ASSETS_ACCOUNT_EXPORT_SOURCES,
          spoolRoot: ownerRoot,
          signal,
        },
        (sink, innerSignal) =>
          (producer = reader.captureAccount({
            grant,
            profileSnapshot: descriptor,
            signal: innerSignal,
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
    const chunks: Buffer[] = [];
    for await (const part of handle.createReadStream())
      chunks.push(Buffer.from(part));
    return Buffer.concat(chunks)
      .toString('utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .flatMap((chunk) => chunk.records) as { source: string; data: any }[];
  }
  async function fingerprint() {
    const [assets, activities] = await Promise.all([
      db.query(
        'SELECT jsonb_agg(to_jsonb(a) ORDER BY id)::text AS data FROM asset_entity a'
      ),
      db.query(
        'SELECT jsonb_agg(to_jsonb(a) ORDER BY id)::text AS data FROM guardian_asset_activity a'
      ),
    ]);
    return { assets, activities };
  }
  async function assertClean() {
    const [temp] = await db.query(
      "SELECT count(*)::int AS n FROM pg_class WHERE relpersistence='t' AND relname LIKE 'assets_export_scope_%'"
    );
    expect(temp.n).toBe(0);
    const links = await Promise.all(
      (
        await readdir('/proc/self/fd')
      ).map(async (fd) => {
        try {
          return await readlink(`/proc/self/fd/${fd}`);
        } catch {
          return '';
        }
      })
    );
    expect(
      links.filter((path) =>
        path.startsWith(join(ownerRoot, 'ot-owner-spool-'))
      )
    ).toEqual([]);
    for (const directory of await readdir(mediaRoot))
      expect(await readdir(join(mediaRoot, directory))).toEqual([]);
  }

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'assets-hls-pg-'));
    storedRoot = join(root, 'stored');
    mediaRoot = join(root, 'media');
    ownerRoot = join(root, 'owner');
    await Promise.all([mkdir(storedRoot), mkdir(mediaRoot), mkdir(ownerRoot)]);
    encryption = new EnvelopeEncryptionService({
      VAULT_STORAGE_KEK: 'isolated-assets-hls-fixture-kek',
    });
    const verified = new VerifiedMediaSpoolService(encryption, {
      spoolRoot: mediaRoot,
      maxPlaintextBytes: 128 * 1024 * 1024,
      maxConcurrent: 1,
      spoolBudgetBytes: 256 * 1024 * 1024,
    });
    adapter = new LocalStorageAdapter(
      new Logger('AssetsHlsFixture'),
      storedRoot,
      encryption,
      undefined,
      { isZfsRequired: () => false } as any,
      verified
    );
    const input = join(root, 'input.mp4');
    await exec(
      'ffmpeg',
      [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=160x90:rate=25:duration=13',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=13',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-y',
        input,
      ],
      { timeout: 10_000 }
    );
    sourceVideo = await readFile(input);
    const hlsDir = join(root, 'hls');
    await mkdir(hlsDir);
    const playback = join(hlsDir, 'playback.mp4');
    await writeFile(playback, sourceVideo);
    await exec(
      'ffmpeg',
      [
        '-v',
        'error',
        '-y',
        '-i',
        playback,
        '-codec',
        'copy',
        '-start_number',
        '0',
        '-hls_time',
        '6',
        '-hls_list_size',
        '0',
        '-hls_segment_filename',
        join(hlsDir, 'segment-%03d.ts'),
        '-f',
        'hls',
        join(hlsDir, 'stream.m3u8'),
      ],
      { timeout: 10_000 }
    );
    const generated = await readFile(join(hlsDir, 'stream.m3u8'), 'utf8');
    const leaves = generated
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'));
    expect(leaves.length).toBeGreaterThanOrEqual(2);
    segmentBytes = await Promise.all(
      leaves.map((leaf) => readFile(join(hlsDir, leaf)))
    );
    segmentIds = leaves.map(() => randomUUID());
    segmentPaths = leaves.map((_, i) => `fixture-segment-${i}.env`);
    let leafIndex = 0;
    originalPlaylist = Buffer.from(
      generated.replace(
        /segment-\d+\.ts/g,
        () => `/api/asset/${segmentIds[leafIndex++]}`
      )
    );
    await encryptedWrite('playback.env', sourceVideo);
    await Promise.all(
      segmentBytes.map((bytes, i) => encryptedWrite(segmentPaths[i], bytes))
    );
    await encryptedWrite('manifest.env', originalPlaylist);
    const options = loadDatabase({
      get: () => ({
        host: '127.0.0.1',
        port: 15552,
        username: 'assets_fixture',
        database: DB,
      }),
    } as any);
    db = new DataSource({
      ...options,
      password: process.env['ASSETS_HLS_PG_PASSWORD'],
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
    await db.query(
      `INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId") VALUES
      ($1,'capture.mp4','video','local_block_storage','playback.env',$2),
      ($3,'stream.m3u8','video','local_block_storage','manifest.env',$2)`,
      [randomUUID(), PROFILE_A, manifestId]
    );
    await db.query(
      `INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId")
      SELECT u.id, 'segment-' || u.ordinality || '.ts', 'video', 'local_block_storage', u.path,
      CASE WHEN u.ordinality % 2 = 0 THEN $3 ELSE $4 END
      FROM unnest($1::uuid[], $2::text[]) WITH ORDINALITY AS u(id,path,ordinality)`,
      [segmentIds, segmentPaths, PROFILE_A, PROFILE_B]
    );
    const profileClient = { send: profileSend } as unknown as ClientProxy;
    reader = new AssetsAccountExportOwnerService(
      db,
      new AssetsAccountExportProfileSnapshotClient(profileClient),
      new AssetsAccountExportMediaReader({
        openAuthenticatedMedia: (asset, options) =>
          adapter.openAuthenticatedMedia(asset as any, options),
      }),
      { send: authSend } as unknown as ClientProxy,
      profileClient
    );
  });

  afterAll(async () => {
    try {
      if (db?.isInitialized) {
        await db.query('DELETE FROM guardian_asset_activity');
        await db.query('DELETE FROM asset_entity');
        const [assets] = await db.query(
          'SELECT count(*)::int AS n FROM asset_entity'
        );
        const [activities] = await db.query(
          'SELECT count(*)::int AS n FROM guardian_asset_activity'
        );
        expect(assets.n).toBe(0);
        expect(activities.n).toBe(0);
        await assertClean();
      }
    } finally {
      await db?.destroy();
      if (root) await rm(root, { recursive: true, force: true });
    }
  });

  it('captures exact encrypted HLS bytes and cross-profile TS references that assemble and probe offline', async () => {
    const before = await fingerprint();
    const handle = await capture();
    try {
      const all = await records(handle);
      const media = all
        .filter((record) => record.source === 'assetMedia')
        .map((record) => record.data);
      const manifests = media.filter((record) => record.kind === 'manifest');
      const manifest = manifests.find(
        (record) => record.assetId === manifestId
      )!;
      expect(manifest).toMatchObject({
        mimeType: 'application/vnd.apple.mpegurl',
        hlsReferenceAssetIds: segmentIds,
      });
      const reconstruct = (id: string) => {
        const parts = media
          .filter((record) => record.assetId === id && record.kind === 'bytes')
          .sort((a, b) => a.offset - b.offset);
        for (let i = 0, offset = 0; i < parts.length; i++) {
          expect(parts[i].offset).toBe(offset);
          offset += Buffer.from(parts[i].bytesBase64, 'base64').length;
        }
        return Buffer.concat(
          parts.map((part) => Buffer.from(part.bytesBase64, 'base64'))
        );
      };
      const capturedManifest = reconstruct(manifestId);
      expect(capturedManifest).toEqual(originalPlaylist);
      expect(manifest.sha256).toBe(
        createHash('sha256').update(originalPlaylist).digest('hex')
      );
      const fileIndex = new Map<
        string,
        { fileName: string; mimeType: string }
      >();
      const files = new Map<string, Buffer>();
      for (const record of manifests) {
        fileIndex.set(record.assetId, {
          fileName: record.fileName,
          mimeType: record.mimeType,
        });
        files.set(record.assetId, reconstruct(record.assetId));
      }
      for (let i = 0; i < segmentIds.length; i++) {
        const bytes = reconstruct(segmentIds[i]);
        expect(bytes).toEqual(segmentBytes[i]);
        const terminal = manifests.find(
          (record) => record.assetId === segmentIds[i]
        );
        expect(terminal).toMatchObject({
          mimeType: 'video/mp2t',
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
        expect(files.get(segmentIds[i])).toEqual(bytes);
      }
      expect(
        new Set(
          segmentIds.map(
            (id) => manifests.find((record) => record.assetId === id)?.profileId
          )
        )
      ).toEqual(new Set([PROFILE_A, PROFILE_B]));
      const offline = join(root, 'offline');
      await mkdir(offline);
      for (const record of manifests)
        await writeFile(
          join(offline, record.fileName),
          files.get(record.assetId)!
        );
      await writeFile(
        join(offline, manifest.fileName),
        rewriteAccountExportHlsPlaylist(capturedManifest, (id) =>
          fileIndex.get(id)
        )
      );
      const probe = await exec(
        'ffprobe',
        [
          '-v',
          'error',
          '-protocol_whitelist',
          'file,crypto',
          '-count_frames',
          '-show_entries',
          'stream=codec_name,codec_type,nb_read_frames:format=duration',
          '-of',
          'json',
          join(offline, manifest.fileName),
        ],
        { timeout: 10_000 }
      );
      const probed = JSON.parse(probe.stdout);
      expect(Number(probed.format.duration)).toBeGreaterThan(0);
      expect(probed.streams).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codec_name: 'h264', codec_type: 'video' }),
          expect.objectContaining({ codec_name: 'aac', codec_type: 'audio' }),
        ])
      );
      expect(
        probed.streams.some((stream: any) => Number(stream.nb_read_frames) > 0)
      ).toBe(true);
      expect(await fingerprint()).toEqual(before);
    } finally {
      await handle.cleanup();
    }
    await assertClean();
  }, 30_000);

  it.each(['missing', 'foreign', 'pending', 'database-storage'])(
    'rejects %s HLS references before returning playlist bytes',
    async (kind) => {
      const before = await fingerprint();
      const id = randomUUID();
      const storage = kind === 'database-storage';
      const lifecycle = kind === 'pending';
      if (kind === 'foreign' || storage || lifecycle) {
        await db.query(
          'INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId","lifecycleState") VALUES ($1,$2,\'video\',$3,$4,$5,$6)',
          [
            id,
            'unsafe.ts',
            storage ? 'database_storage' : 'local_block_storage',
            segmentPaths[0],
            kind === 'foreign' ? PROFILE_FOREIGN : PROFILE_A,
            lifecycle ? 'pending-upload' : 'active',
          ]
        );
      }
      const invalid = await playlist([id]);
      await encryptedWrite('manifest.env', invalid);
      const bytesSeen: string[] = [];
      try {
        await expect(
          capture(async (chunk) => {
            for (const record of chunk.records)
              if (
                record.source === 'assetMedia' &&
                record.data.assetId === manifestId &&
                record.data.kind === 'bytes'
              )
                bytesSeen.push(record.data.assetId);
          })
        ).rejects.toBeDefined();
        expect(bytesSeen).toEqual([]);
      } finally {
        await encryptedWrite('manifest.env', originalPlaylist);
        if (kind !== 'missing')
          await db.query('DELETE FROM asset_entity WHERE id=$1', [id]);
      }
      expect(await fingerprint()).toEqual(before);
      await assertClean();
    }
  );

  it('rejects corrupted authenticated segment storage and removes partial spool resources', async () => {
    const before = await fingerprint();
    const damaged = encryption.encrypt(segmentBytes[0]);
    damaged[damaged.length - 1] ^= 0xff;
    await writeFile(join(storedRoot, segmentPaths[0]), damaged);
    try {
      await expect(capture()).rejects.toBeDefined();
    } finally {
      await encryptedWrite(segmentPaths[0], segmentBytes[0]);
    }
    expect(await fingerprint()).toEqual(before);
    await assertClean();
  });

  it('validates more than 200 unique references in bounded SQL batches', async () => {
    const ids = Array.from({ length: 201 }, () => randomUUID());
    const before = await fingerprint();
    await db.query(
      `INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId") SELECT x,'batch.ts','video','local_block_storage',$2,CASE WHEN n%2=0 THEN $3 ELSE $4 END FROM unnest($1::uuid[]) WITH ORDINALITY AS u(x,n)`,
      [ids, segmentPaths[0], PROFILE_A, PROFILE_B]
    );
    await encryptedWrite('manifest.env', await playlist(ids));
    const batchSizes: number[] = [];
    const originalCreate = db.createQueryRunner.bind(db);
    db.createQueryRunner = ((...args: Parameters<typeof originalCreate>) => {
      const runner = originalCreate(...args);
      const query = runner.query.bind(runner);
      runner.query = async (...queryArgs: Parameters<typeof query>) => {
        if (
          /a\.id=ANY\(\$1::uuid\[\]\)[\s\S]*a\.type='video'/.test(
            String(queryArgs[0])
          )
        )
          batchSizes.push((queryArgs[1]?.[0] as string[])?.length ?? 0);
        return query(...queryArgs);
      };
      return runner;
    }) as typeof db.createQueryRunner;
    let handle: Awaited<ReturnType<typeof capture>> | undefined;
    try {
      handle = await capture();
      expect(batchSizes).toEqual([200, 1]);
    } finally {
      await handle?.cleanup();
      db.createQueryRunner = originalCreate;
      await encryptedWrite('manifest.env', originalPlaylist);
      await db.query('DELETE FROM asset_entity WHERE id=ANY($1::uuid[])', [
        ids,
      ]);
    }
    expect(await fingerprint()).toEqual(before);
    await assertClean();
  }, 30_000);

  it('aborts and rejects after capture lease invalidation with resource cleanup', async () => {
    const before = await fingerprint();
    const abort = new AbortController();
    await expect(
      capture(async (chunk) => {
        if (
          chunk.records.some(
            (record: any) =>
              record.source === 'assetMedia' &&
              record.data.assetId === manifestId &&
              record.data.kind === 'bytes'
          )
        )
          abort.abort();
      }, abort.signal)
    ).rejects.toBeDefined();
    await assertClean();
    try {
      let invalidated = false;
      await expect(
        capture(async (chunk) => {
          if (
            !invalidated &&
            chunk.records.some((record: any) => record.source === 'asset')
          ) {
            invalidated = true;
            allowLease = false;
          }
        })
      ).rejects.toBeDefined();
      expect(invalidated).toBe(true);
    } finally {
      allowLease = true;
    }
    expect(await fingerprint()).toEqual(before);
    await assertClean();
  });

  it('bounds an occupied single-connection pool using production connection timeout', async () => {
    const original = reader;
    const options = loadDatabase({
      get: () => ({
        host: '127.0.0.1',
        port: 15552,
        username: 'assets_fixture',
        database: DB,
      }),
    } as any);
    const occupied = new DataSource({
      ...options,
      password: process.env['ASSETS_HLS_PG_PASSWORD'],
      synchronize: false,
      logging: false,
      extra: { max: 1 },
    });
    await occupied.initialize();
    const held = occupied.createQueryRunner();
    await held.connect();
    const profileClient = { send: profileSend } as unknown as ClientProxy;
    reader = new AssetsAccountExportOwnerService(
      occupied,
      new AssetsAccountExportProfileSnapshotClient(profileClient),
      new AssetsAccountExportMediaReader({
        openAuthenticatedMedia: (asset, options) =>
          adapter.openAuthenticatedMedia(asset as any, options),
      }),
      { send: authSend } as unknown as ClientProxy,
      profileClient
    );
    const started = Date.now();
    try {
      expect(options.connectTimeoutMS).toBe(3000);
      await expect(capture()).rejects.toBeDefined();
      expect(Date.now() - started).toBeGreaterThanOrEqual(2_500);
      expect(Date.now() - started).toBeLessThan(8_000);
    } finally {
      reader = original;
      await held.release();
      await occupied.destroy();
    }
    await assertClean();
  }, 15_000);
});
