import loadDatabase from './loadDatabase';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { of } from 'rxjs';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import * as entities from '../entities';
import { Initial1770152975983 } from '../../migrations/1770152975983-initial';
import { CommunityBroadcast1786715103205 } from '../../migrations/1786715103205-community-broadcast';
import { VideoProcessingPipeline1786715106275 } from '../../migrations/1786715106275-video-processing-pipeline';
import {
  VideosAccountExportOwnerService,
  VIDEOS_ACCOUNT_EXPORT_SOURCES,
} from './account-export-owner.service';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const DB = 'videos_owner_j10_fixture';
const enabled =
  process.env.VIDEOS_OWNER_PG_OPT_IN === DB &&
  process.env.VIDEOS_OWNER_PG_HOST === '127.0.0.1' &&
  process.env.VIDEOS_OWNER_PG_PORT === '15551';
const pgDescribe = enabled ? describe : describe.skip;
const A = 'abcdef11-1111-4111-8111-111111111111',
  B = 'abcdef22-2222-4222-8222-222222222222';
const ZERO = '00000000-0000-0000-0000-000000000000',
  PB = randomUUID();
const tables = [
  'channel',
  'video',
  'channel_subscription',
  'video_view',
  'channel_feed',
  'program_block',
  'live_session',
];

pgDescribe('Videos owner real PostgreSQL component', () => {
  jest.setTimeout(60000);
  let db: DataSource, owner: VideosAccountExportOwnerService, spoolRoot: string;
  let allowLease = true;
  const profiles = [
    ZERO,
    ...Array.from(
      { length: 1005 },
      (_, i) => `abcdef00-0000-4000-8000-${i.toString(16).padStart(12, '0')}`
    ),
  ].sort();
  const channels = profiles.map((_, i) => (i === 0 ? ZERO : randomUUID()));
  const videos = profiles.map((_, i) => (i === 0 ? ZERO : randomUUID()));
  const foreignChannel = randomUUID(),
    foreignVideo = randomUUID();
  const grant: AccountExportCaptureGrant = {
    accountId: A,
    appId: 'client-interface',
    token: 'private-videos-session',
    jobId: randomUUID(),
    attempt: 1,
    leaseOwner: randomUUID(),
  };
  const parent: AccountExportSnapshotDescriptor = {
    handleId: randomUUID(),
    participantId: 'profile',
    accountId: A,
    captureId: randomUUID(),
    snapshotAt: '2026-10-20T12:00:00.000Z',
    sizeBytes: 1,
    sha256: 'a'.repeat(64),
    rowCount: 0,
    sources: ['profile'],
    sourceRowCounts: { profile: 0 },
    sourceDispositions: { profile: 'no-retained-rows' },
    identityCount: profiles.length,
    expiresAt: '2099-01-01T00:00:00.000Z',
  };
  const profileSend = jest.fn((pattern: any, request: any) => {
    if (pattern.cmd !== ProfileCommands.ReadAccountExportCaptureIdentities)
      throw Error('Unexpected profile command');
    const captured = request.accountId === A ? profiles : [];
    const end = Math.min(captured.length, request.offset + request.limit);
    return of({
      handleId: parent.handleId,
      captureId: parent.captureId,
      accountId: request.accountId,
      snapshotAt: parent.snapshotAt,
      total: captured.length,
      profileIds: captured.slice(request.offset, end),
      nextOffset: end < captured.length ? end : null,
    });
  });
  const authSend = jest.fn((pattern: any) => {
    if (pattern.cmd !== AuthCommands.ValidateAccountExportLease)
      throw Error('Unexpected auth command');
    return of({ valid: allowLease });
  });
  function makeOwner() {
    return new VideosAccountExportOwnerService(
      db,
      new AccountExportProfileSnapshotClient({
        send: profileSend,
      } as unknown as ClientProxy),
      { send: authSend } as unknown as ClientProxy
    );
  }
  async function fingerprint() {
    const out: Record<string, unknown> = {};
    for (const t of tables)
      out[t] = await db.query(
        `SELECT jsonb_agg(to_jsonb(t) ORDER BY id)::text AS data FROM "${t}" t`
      );
    return out;
  }
  async function resources() {
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM pg_class WHERE relpersistence='t'"
        )
      )[0].n
    ).toBe(0);
    const fds = await Promise.all(
      (
        await readdir('/proc/self/fd')
      ).map(async (f) => {
        try {
          return await readlink('/proc/self/fd/' + f);
        } catch {
          return '';
        }
      })
    );
    expect(
      fds.filter((x) => x.startsWith(join(spoolRoot, 'ot-owner-spool-')))
    ).toEqual([]);
    expect(await readdir(spoolRoot)).toEqual([]);
  }
  async function capture(
    onChunk?: (c: any) => Promise<void>,
    signal?: AbortSignal,
    inputGrant = grant,
    descriptor = parent
  ) {
    let producer:
      | ReturnType<VideosAccountExportOwnerService['captureAccount']>
      | undefined;
    try {
      return await new AccountExportOwnerSpoolService().capture(
        {
          participantId: 'videos',
          accountId: inputGrant.accountId,
          sources: VIDEOS_ACCOUNT_EXPORT_SOURCES,
          spoolRoot,
          signal,
        },
        (sink, combined) =>
          (producer = owner.captureAccount({
            grant: inputGrant,
            profileSnapshot: descriptor,
            signal: combined,
            onChunk: async (c) => {
              await onChunk?.(c);
              await sink(c);
            },
          }))
      );
    } finally {
      if (producer) await producer.catch(() => undefined);
    }
  }
  async function records(h: Awaited<ReturnType<typeof capture>>) {
    const parts: Buffer[] = [];
    for await (const p of h.createReadStream()) parts.push(Buffer.from(p));
    return Buffer.concat(parts)
      .toString()
      .trim()
      .split('\n')
      .flatMap((line) => JSON.parse(line).records) as {
      source: string;
      data: any;
    }[];
  }
  beforeAll(async () => {
    spoolRoot = await mkdtemp(join(tmpdir(), 'videos-j10-owner-'));
    db = new DataSource({
      type: 'postgres',
      host: '127.0.0.1',
      port: 15551,
      username: 'videos_fixture',
      password: process.env.VIDEOS_OWNER_PG_PASSWORD,
      database: DB,
      entities: Object.values(entities),
      migrations: [
        Initial1770152975983,
        CommunityBroadcast1786715103205,
        VideoProcessingPipeline1786715106275,
      ],
      synchronize: false,
      logging: false,
      extra: { max: 4 },
    });
    await db.initialize();
    expect((await db.runMigrations()).length).toBe(3);
    await db.query(
      `INSERT INTO channel(id,name,description,"profileId","userId","communityId") SELECT c,'owned channel',repeat('description ',2000),upper(p),upper($3),'community-'||c FROM unnest($1::uuid[],$2::text[]) AS t(c,p)`,
      [channels, profiles, A]
    );
    await db.query(
      `INSERT INTO channel(id,name,"profileId","userId","communityId") VALUES($1,'foreign',$2,$3,'foreign-community')`,
      [foreignChannel, PB, B]
    );
    await db.query(
      `INSERT INTO video(id,title,description,"assetId","channelId","communityId","processingStatus","processingError") SELECT v,'owned video',repeat('full text ',2000),v::text,c,'community-'||c,'ready','PRIVATE_PROCESS_ERROR' FROM unnest($1::uuid[],$2::uuid[]) AS t(v,c)`,
      [videos, channels]
    );
    await db.query(
      `INSERT INTO video(id,title,"assetId","channelId","communityId","processingStatus") VALUES($1::uuid,'foreign',$1::text,$2,'foreign-community','ready')`,
      [foreignVideo, foreignChannel]
    );
    await db.query(
      `INSERT INTO channel_subscription("channelId","userId","profileId") VALUES($1,upper($2),upper($3)),($4,$5,$6)`,
      [foreignChannel, A, profiles[1], channels[0], B, PB]
    );
    await db.query(
      `INSERT INTO video_view("videoId","userId","profileId","ipAddress","watchDurationSeconds") VALUES($1,upper($2),upper($3),'PRIVATE_IP',42),($1,NULL,upper($4),'PRIVATE_IP',1),($1,$5,$6,'FOREIGN_IP',2),($1,NULL,NULL,'ANON_IP',3)`,
      [videos[0], A, profiles[2], profiles[3], B, PB]
    );
    await db.query(
      `INSERT INTO video_view("videoId","userId","profileId","ipAddress","watchDurationSeconds") VALUES($1,upper($2),upper($3),'PRIVATE_IP',7)`,
      [foreignVideo, A, profiles[4]]
    );
    await db.query(
      `INSERT INTO channel_feed("channelId","communityId") VALUES($1,$2)`,
      [channels[0], 'community-' + channels[0]]
    );
    await db.query(
      `INSERT INTO program_block("channelId","communityId","videoId",title,"startsAt","endsAt") VALUES($1,$2,$3,'own schedule',now(),now()+interval '1 hour')`,
      [channels[0], 'community-' + channels[0], videos[0]]
    );
    await db.query(
      `INSERT INTO live_session("channelId","communityId",title,"startedByUserId","startedByProfileId","liveSourceUrl") VALUES($1,$2,'own live',upper($3),upper($4),'rtmp://PRIVATE_URL/key'),($1,$2,'other host',$5,$6,'rtmp://FOREIGN_URL/key'),(NULL,'other-community','own unbound',upper($3),upper($4),'rtmp://PRIVATE_URL/key')`,
      [channels[0], 'community-' + channels[0], A, profiles[5], B, PB]
    );
    owner = makeOwner();
  });
  afterAll(async () => {
    try {
      if (db?.isInitialized) {
        for (const t of [...tables].reverse())
          await db.query(`DELETE FROM "${t}"`);
        for (const t of tables)
          expect(
            (await db.query(`SELECT count(*)::int AS n FROM "${t}"`))[0].n
          ).toBe(0);
        await resources();
      }
    } finally {
      if (db?.isInitialized) await db.destroy();
      if (spoolRoot) await rm(spoolRoot, { recursive: true, force: true });
    }
  });
  it('captures seven sources and over1000 identities with full text, minimum UUID and counterpart privacy', async () => {
    const before = await fingerprint();
    const uppercaseRows = await db.query(
      `SELECT (SELECT count(*)::int FROM channel WHERE "profileId"<>lower("profileId") AND lower("profileId")=ANY($1::text[])) AS channels, (SELECT count(*)::int FROM channel_subscription WHERE "profileId"<>lower("profileId") AND lower("profileId")=ANY($1::text[])) AS subscriptions, (SELECT count(*)::int FROM video_view WHERE ("profileId"<>lower("profileId") AND lower("profileId")=ANY($1::text[])) OR ("userId"<>lower("userId") AND lower("userId")=$2)) AS views, (SELECT count(*)::int FROM live_session WHERE ("startedByUserId"<>lower("startedByUserId") AND lower("startedByUserId")=$2) OR ("startedByProfileId"<>lower("startedByProfileId") AND lower("startedByProfileId")=ANY($1::text[]))) AS sessions`,
      [profiles, A]
    );
    expect(uppercaseRows[0]).toMatchObject({
      channels: 1005,
      subscriptions: 1,
      views: 3,
      sessions: 2,
    });
    const h = await capture();
    try {
      const all = await records(h);
      expect(Object.keys(h.metadata.sourceDispositions)).toEqual([
        ...VIDEOS_ACCOUNT_EXPORT_SOURCES,
      ]);
      expect(all.filter((r) => r.source === 'channel')).toHaveLength(1006);
      const ownedChannels = all.filter((r) => r.source === 'channel');
      expect(ownedChannels.map((r) => r.data.profileId).sort()).toEqual(
        [...profiles].sort()
      );
      expect(all.filter((r) => r.source === 'video')).toHaveLength(1006);
      expect(
        all.filter((r) => r.source === 'channelSubscription')
      ).toHaveLength(1);
      expect(all.filter((r) => r.source === 'videoView')).toHaveLength(3);
      expect(all.filter((r) => r.source === 'channelFeed')).toHaveLength(1);
      expect(all.filter((r) => r.source === 'programBlock')).toHaveLength(1);
      expect(all.filter((r) => r.source === 'liveSession')).toHaveLength(3);
      expect(
        all.some((r) => r.source === 'channel' && r.data.id === ZERO)
      ).toBe(true);
      expect(all.find((r) => r.source === 'video')!.data.description).toBe(
        'full text '.repeat(2000)
      );
      const text = JSON.stringify(all);
      for (const secret of [
        B,
        PB,
        'PRIVATE_IP',
        'FOREIGN_IP',
        'ANON_IP',
        'PRIVATE_URL',
        'FOREIGN_URL',
        'PRIVATE_PROCESS_ERROR',
        grant.token,
        grant.leaseOwner,
        'storagePath',
      ])
        expect(text).not.toContain(secret);
      expect(profileSend.mock.calls.some(([, r]) => r.offset === 1000)).toBe(
        true
      );
    } finally {
      await h.cleanup();
    }
    expect(await fingerprint()).toEqual(before);
    await resources();
  });
  it('holds one database snapshot across all source pages and handles a genuinely empty account', async () => {
    const late = randomUUID();
    let inserted = false;
    const h = await capture(async () => {
      if (!inserted) {
        inserted = true;
        await db.query(
          `INSERT INTO channel(id,name,"profileId","userId","communityId") VALUES($1,'late',$2,$3,$4)`,
          [late, ZERO, A, 'late-' + late]
        );
      }
    });
    try {
      expect(
        (await records(h)).filter((r) => r.source === 'channel')
      ).toHaveLength(1006);
    } finally {
      await h.cleanup();
      await db.query('DELETE FROM channel WHERE id=$1', [late]);
    }
    const emptyGrant = { ...grant, accountId: randomUUID() };
    const empty = await capture(undefined, undefined, emptyGrant, {
      ...parent,
      accountId: emptyGrant.accountId,
      identityCount: 0,
    });
    try {
      expect(await records(empty)).toEqual([]);
    } finally {
      await empty.cleanup();
    }
    await resources();
  });
  it('fails closed on processing races, contradictory identities, and oversized text, then recovers cleanly', async () => {
    for (const [sql, args, restore, restoreArgs] of [
      [
        'UPDATE video SET "processingStatus"=\'processing\' WHERE id=$1',
        [videos[0]],
        'UPDATE video SET "processingStatus"=\'ready\' WHERE id=$1',
        [videos[0]],
      ],
      [
        'UPDATE channel SET "userId"=$2 WHERE id=$1',
        [channels[0], B],
        'UPDATE channel SET "userId"=$2 WHERE id=$1',
        [channels[0], A],
      ],
      [
        'UPDATE channel_feed SET "communityId"=\'contradiction\' WHERE "channelId"=$1',
        [channels[0]],
        'UPDATE channel_feed SET "communityId"=$2 WHERE "channelId"=$1',
        [channels[0], 'community-' + channels[0]],
      ],
      [
        "UPDATE video SET description=repeat('x',2000000) WHERE id=$1",
        [videos[0]],
        'UPDATE video SET description=$2 WHERE id=$1',
        [videos[0], 'full text '.repeat(2000)],
      ],
    ] as [string, any[], string, any[]][]) {
      await db.query(sql, args);
      try {
        await expect(capture()).rejects.toBeDefined();
      } finally {
        await db.query(restore, restoreArgs);
      }
      await resources();
    }
    const h = await capture();
    await h.cleanup();
    await resources();
  });
  it('drains abort and lease denial without verified partial capture or retained temporary state', async () => {
    const controller = new AbortController();
    await expect(
      capture(async () => controller.abort(), controller.signal)
    ).rejects.toBeDefined();
    await resources();
    let changed = false;
    try {
      await expect(
        capture(async () => {
          if (!changed) {
            changed = true;
            allowLease = false;
          }
        })
      ).rejects.toBeDefined();
    } finally {
      allowLease = true;
    }
    await resources();
    const h = await capture();
    await h.cleanup();
    await resources();
  });
  it('evicts a real dirty PostgreSQL connection and quarantines the owner after cleanup failure', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    const [{ pid }] = await runner.query('SELECT pg_backend_pid() AS pid');
    const actualQuery = runner.query.bind(runner);
    const query = jest
      .spyOn(runner, 'query')
      .mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.startsWith('DROP TABLE'))
          throw Error('PRIVATE_DATABASE_DETAIL');
        return actualQuery(sql, params);
      });
    const create = jest
      .spyOn(db, 'createQueryRunner')
      .mockReturnValueOnce(runner);
    try {
      await expect(capture()).rejects.toBeDefined();
      expect(runner.isReleased).toBe(true);
      expect(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=$1',
            [pid]
          )
        )[0].n
      ).toBe(0);
      await expect(capture()).rejects.toBeDefined();
    } finally {
      query.mockRestore();
      create.mockRestore();
      owner = makeOwner();
    }
    await resources();
    const h = await capture();
    await h.cleanup();
    await resources();
  });
  it('bounds an occupied pool with the production connection timeout and leaves no capture resources', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    let options: ReturnType<typeof loadDatabase>;
    try {
      options = loadDatabase({
        get: () => ({
          host: '127.0.0.1',
          port: 15551,
          username: 'videos_fixture',
          password: process.env.VIDEOS_OWNER_PG_PASSWORD,
          database: DB,
        }),
      } as unknown as ConfigService);
    } finally {
      log.mockRestore();
    }
    if (options.type !== 'postgres') throw Error('Expected PostgreSQL options');
    expect(options.connectTimeoutMS).toBe(3000);
    const occupied = new DataSource({
      ...options,
      synchronize: false,
      logging: false,
      extra: { max: 1 },
    });
    await occupied.initialize();
    const held = occupied.createQueryRunner();
    await held.connect();
    const previous = owner;
    owner = new VideosAccountExportOwnerService(
      occupied,
      new AccountExportProfileSnapshotClient({ send: profileSend } as any),
      { send: authSend } as any
    );
    const started = Date.now();
    try {
      await expect(capture()).rejects.toBeDefined();
      expect(Date.now() - started).toBeGreaterThanOrEqual(2500);
      expect(Date.now() - started).toBeLessThan(10000);
    } finally {
      owner = previous;
      await held.release();
      await occupied.destroy();
    }
    await resources();
  });
});
