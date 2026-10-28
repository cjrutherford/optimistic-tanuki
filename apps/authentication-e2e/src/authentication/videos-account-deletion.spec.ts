import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource } from 'typeorm';
import { AccountDeletionOperationEntity } from '../../../authentication/src/account-deletion/account-deletion-operation.entity';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';
import { AccountDeletionController } from '../../../authentication/src/account-deletion/account-deletion.controller';
import { AppService } from '../../../authentication/src/app/app.service';
import {
  AccountDeletionGrant,
  AccountDeletionIdentityDomains,
  DELETED_ACCOUNT_ID,
} from '@optimistic-tanuki/models';
import {
  AccountDeletionAuthorityClient,
  AccountDeletionWriteFenceEntity,
} from '@optimistic-tanuki/storage';
import { VideoCommands } from '@optimistic-tanuki/constants';
import { Channel } from '../../../videos/src/entities/channel.entity';
import { Video } from '../../../videos/src/entities/video.entity';
import { VideoView } from '../../../videos/src/entities/video-view.entity';
import { ChannelSubscription } from '../../../videos/src/entities/channel-subscription.entity';
import { LiveSession } from '../../../videos/src/entities/live-session.entity';
import { ProgramBlock } from '../../../videos/src/entities/program-block.entity';
import { ChannelFeed } from '../../../videos/src/entities/channel-feed.entity';
import { VideosAccountDeletionOwnerService } from '../../../videos/src/app/account-deletion-owner.service';
import { VideosAccountDeletionOwnerController } from '../../../videos/src/app/account-deletion-owner.controller';
import { VideoProcessingService } from '../../../videos/src/app/services/video-processing.service';
import { VideoTranscodeClientService } from '../../../videos/src/app/services/video-transcode-client.service';
import { VideoDeletionProcessingFenceService } from '../../../videos/src/app/services/video-deletion-processing-fence.service';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const gated = process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture';
(gated ? describe : describe.skip)(
  'D04 Videos owner with real PostgreSQL, Auth/Videos TCP and Go worker',
  () => {
    const account = randomUUID(),
      counterpart = randomUUID();
    const profile = randomUUID(),
      counterpartProfile = randomUUID();
    const ownChannel = randomUUID(),
      counterpartChannel = randomUUID();
    const ownVideo = randomUUID(),
      placeholderVideo = randomUUID(),
      counterpartVideo = randomUUID();
    const ownView = randomUUID(),
      foreignOwnView = randomUUID(),
      ownCounterpartView = randomUUID(),
      foreignCounterpartView = randomUUID();
    const ownSub = randomUUID(),
      foreignSub = randomUUID(),
      ownLive = randomUUID(),
      foreignLive = randomUUID();
    const ownBlock = randomUUID(),
      foreignBlock = randomUUID(),
      ownFeed = randomUUID(),
      counterpartFeed = randomUUID();
    const tables = [
      'channel',
      'video',
      'video_view',
      'channel_subscription',
      'live_session',
      'program_block',
      'channel_feed',
      'account_deletion_write_fence',
    ];
    const oldProof = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    const oldWorkerHost = process.env['VIDEO_TRANSCODER_HOST'];
    const oldAssetsHost = process.env['ASSETS_SERVICE_HOST'];
    const oldAssetsPort = process.env['ASSETS_SERVICE_PORT'];
    const mediaRoot = process.env['D04_MEDIA_ROOT'];
    const importsRoot = mediaRoot && path.join(mediaRoot, 'imports');
    const outputRoot = mediaRoot && path.join(mediaRoot, 'output');
    const scope: AccountDeletionIdentityDomains = {
      currentProfileIds: [profile],
      legacyProfileIds: [],
    };
    let authDb: DataSource,
      db: DataSource,
      authority: AccountDeletionAuthorityService;
    let authApp: any, videosApp: any, authClient: any, videosClient: any;
    let operationId = '',
      baseline: Record<string, number>,
      authBaseline: number;
    let processing: VideoProcessingService,
      drain: VideoDeletionProcessingFenceService;
    let ownOutput = '',
      foreignOutput = '',
      ownStage = '',
      foreignStage = '',
      legacyStage = '';
    let otherOwnerFences: Record<string, { fence: boolean }>;
    let ownSubscription = '';
    const port = async () => {
      const server = createServer();
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
      );
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('FIXTURE_PORT_UNAVAILABLE');
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
      return address.port;
    };
    const call = (cmd: string, grant: AccountDeletionGrant) =>
      firstValueFrom(
        videosClient.send({ cmd }, grant).pipe(timeout(30000))
      ) as Promise<{ verified: true }>;
    const counts = async (source: DataSource) =>
      Object.fromEntries(
        await Promise.all(
          tables.map(async (table) => [
            table,
            (
              await source.query(
                `SELECT count(*)::int AS count FROM "${table}"`
              )
            )[0].count,
          ])
        )
      );
    const insertRows = async () =>
      db.transaction(async (m) => {
        await m.query(
          'INSERT INTO channel (id,name,description,"profileId","userId","communityId","communitySlug","appScope","memberCount","isPublic") VALUES ($1,\'Private channel\',\'private channel description\',$2,$3,$4,$5,\'local-hub\',2,true),($6,\'Counterpart channel\',\'counterpart channel description\',$7,$8,$9,$10,\'local-hub\',2,true)',
          [
            ownChannel,
            profile,
            account,
            `community-${ownChannel}`,
            `slug-${ownChannel}`,
            counterpartChannel,
            counterpartProfile,
            counterpart,
            `community-${counterpartChannel}`,
            `slug-${counterpartChannel}`,
          ]
        );
        await m.query(
          "INSERT INTO video (id,title,description,\"assetId\",\"sourceAssetId\",\"channelId\",\"communityId\",\"processingStatus\",\"viewCount\",\"likeCount\",visibility) VALUES ($1,'Private title','private description',$2,$2,$3,$4,'ready',9,4,'public'),($5,'Viewer history','private placeholder source',$6,$6,$3,$4,'ready',3,1,'public'),($7,'Counterpart title','counterpart description',$8,$8,$9,$10,'ready',8,2,'public')",
          [
            ownVideo,
            randomUUID(),
            ownChannel,
            `community-${ownChannel}`,
            placeholderVideo,
            randomUUID(),
            counterpartVideo,
            randomUUID(),
            counterpartChannel,
            `community-${counterpartChannel}`,
          ]
        );
        await m.query(
          'INSERT INTO video_view (id,"videoId","userId","profileId","ipAddress","watchDurationSeconds") VALUES ($1,$2,$3,$4,\'192.0.2.10\',20),($5,$11,$6,$7,\'192.0.2.11\',30),($8,$9,$3,$4,\'192.0.2.12\',40),($10,$9,$6,$7,\'192.0.2.13\',50)',
          [
            ownView,
            ownVideo,
            account,
            profile,
            foreignOwnView,
            counterpart,
            counterpartProfile,
            ownCounterpartView,
            counterpartVideo,
            foreignCounterpartView,
            placeholderVideo,
          ]
        );
        ownSubscription = randomUUID();
        await m.query(
          'INSERT INTO channel_subscription (id,"channelId","userId","profileId") VALUES ($1,$2,$3,$4),($5,$2,$6,$7),($8,$9,$3,$4)',
          [
            ownSub,
            counterpartChannel,
            account,
            profile,
            foreignSub,
            counterpart,
            counterpartProfile,
            ownSubscription,
            ownChannel,
          ]
        );
        await m.query(
          "INSERT INTO live_session (id,\"communityId\",\"channelId\",title,description,status,\"startedByUserId\",\"startedByProfileId\") VALUES ($1,$2,$3,'Own live','private live notes','live',$4,$5),($6,$10,$9,'Counterpart live','preserve title','live',$7,$8)",
          [
            ownLive,
            `community-${counterpartChannel}`,
            counterpartChannel,
            account,
            profile,
            foreignLive,
            counterpart,
            counterpartProfile,
            ownChannel,
            `community-${ownChannel}`,
          ]
        );
        await m.query(
          "INSERT INTO program_block (id,\"communityId\",\"channelId\",\"videoId\",title,description,status,\"startsAt\",\"endsAt\") VALUES ($1,$2,$3,$4,'Own scheduled program','private block','scheduled',now(),now()+interval '1 hour'),($5,$6,$7,$4,'Counterpart scheduled program','retain title','scheduled',now(),now()+interval '1 hour')",
          [
            ownBlock,
            `community-${ownChannel}`,
            ownChannel,
            ownVideo,
            foreignBlock,
            `community-${counterpartChannel}`,
            counterpartChannel,
          ]
        );
        await m.query(
          'INSERT INTO channel_feed (id,"channelId","communityId","activeVideoId","activeLiveSessionId","activeProgramBlockId", "currentMode") VALUES ($1,$2,$3,$4,$5,$6,\'live\'),($7,$8,$9,$4,$5,$6,\'live\')',
          [
            ownFeed,
            ownChannel,
            `community-${ownChannel}`,
            ownVideo,
            ownLive,
            ownBlock,
            counterpartFeed,
            counterpartChannel,
            `community-${counterpartChannel}`,
          ]
        );
      });
    const rejectedDbWrite = async (sql: string, args: unknown[]) =>
      expect(db.query(sql, args)).rejects.toThrow('ACCOUNT_DELETION_FENCED');

    beforeAll(async () => {
      if (
        !mediaRoot ||
        !process.env['VIDEO_TRANSCODER_PORT'] ||
        !process.env['VIDEO_TRANSCODER_DELETION_SECRET']
      )
        throw new Error('D04_PRIVATE_WORKER_FIXTURE_REQUIRED');
      if (!process.env['VIDEO_TRANSCODER_HOST'])
        process.env['VIDEO_TRANSCODER_HOST'] = '127.0.0.1';
      process.env['ACCOUNT_DELETION_PROOF_KEY'] =
        randomBytes(48).toString('base64url');
      const common = {
        type: 'postgres' as const,
        host: process.env['POSTGRES_HOST'],
        port: Number(process.env['POSTGRES_PORT']),
        username: process.env['POSTGRES_USER'],
        password: process.env['POSTGRES_PASSWORD'],
        synchronize: false,
        migrationsRun: false,
        extra: { statement_timeout: 10000, lock_timeout: 5000 },
      };
      authDb = new DataSource({
        ...common,
        database: process.env['POSTGRES_DB'],
        entities: [AccountDeletionOperationEntity],
      });
      db = new DataSource({
        ...common,
        database: process.env['D04_VIDEOS_DB'] ?? 'd04_videos',
        entities: [
          Channel,
          Video,
          VideoView,
          ChannelSubscription,
          LiveSession,
          ProgramBlock,
          ChannelFeed,
          AccountDeletionWriteFenceEntity,
        ],
      });
      await authDb.initialize();
      await db.initialize();
      baseline = await counts(db);
      authBaseline = (
        await authDb.query(
          'SELECT count(*)::int AS count FROM account_deletion_operations'
        )
      )[0].count;
      authority = new AccountDeletionAuthorityService(
        authDb.getRepository(AccountDeletionOperationEntity),
        authDb
      );
      const authPort = await port();
      const authModule = await Test.createTestingModule({
        controllers: [AccountDeletionController],
        providers: [
          { provide: AccountDeletionAuthorityService, useValue: authority },
          {
            provide: AppService,
            useValue: {
              validateToken: () => {
                throw Error('UNEXPECTED_PUBLIC_AUTH');
              },
            },
          },
        ],
      }).compile();
      authApp = authModule.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: authPort },
        logger: false,
      });
      await authApp.listen();
      authClient = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: authPort },
      });
      const assets = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: 1 },
      });
      processing = new VideoProcessingService(
        db.getRepository(Video),
        assets,
        new VideoTranscodeClientService(),
        { assetStorageRoot: importsRoot! }
      );
      drain = new VideoDeletionProcessingFenceService(db);
      (processing as any).deletionFence = drain;
      const owner = new VideosAccountDeletionOwnerService(
        db,
        new AccountDeletionAuthorityClient(authClient),
        new VideoTranscodeClientService(),
        processing
      );
      const ownerModule = await Test.createTestingModule({
        controllers: [VideosAccountDeletionOwnerController],
        providers: [
          { provide: VideosAccountDeletionOwnerService, useValue: owner },
        ],
      }).compile();
      const videosPort = await port();
      videosApp = ownerModule.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: videosPort },
        logger: false,
      });
      await videosApp.listen();
      videosClient = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: videosPort },
      });
      const actual = (
        await db.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public'"
        )
      )
        .map((r: any) => r.tablename)
        .sort();
      expect(actual).toEqual([...tables, 'migrations'].sort());
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM pg_constraint WHERE contype='f' AND confrelid='channel'::regclass"
          )
        )[0].count
      ).toBeGreaterThanOrEqual(1);
      const accepted = await authority.accept(
        account,
        'client-interface',
        randomUUID()
      );
      operationId = accepted.id;
      await authority.claim(operationId);
      await authority.recordProfileScope(
        await authority.issueGrant(operationId, 'profile', 'fence'),
        scope
      );
      // Fixture-only premise: other owner fence acknowledgements are supplied by D00, not discovered here.
      otherOwnerFences = Object.fromEntries(
        [
          'authentication',
          'profile',
          'assets',
          'permissions',
          'social',
          'forum',
          'workspace',
          'app-configurator',
          'chat-collector',
          'classifieds',
          'payments',
        ].map((o) => [o, { fence: true }])
      );
      await authDb.query(
        'UPDATE account_deletion_operations SET "ownerProgress"=$2::jsonb WHERE id=$1',
        [operationId, JSON.stringify(otherOwnerFences)]
      );
      await insertRows();
      await mkdir(path.join(outputRoot!, ownVideo), { recursive: true });
      ownOutput = path.join(outputRoot!, ownVideo, 'playback.mp4');
      await writeFile(ownOutput, 'owned output');
      await mkdir(path.join(outputRoot!, counterpartVideo), {
        recursive: true,
      });
      foreignOutput = path.join(outputRoot!, counterpartVideo, 'playback.mp4');
      await writeFile(foreignOutput, 'counterpart output');
      for (const [videoId, prefix] of [
        [ownVideo, 'own'],
        [counterpartVideo, 'counterpart'],
      ] as const) {
        const dir = path.join(
          importsRoot!,
          '.video-processing-imports',
          videoId,
          'attempt-fixture'
        );
        await mkdir(dir, { recursive: true, mode: 0o700 });
        await writeFile(path.join(dir, `${prefix}.bin`), `${prefix} staging`);
        if (prefix === 'own') ownStage = dir;
        else foreignStage = dir;
      }
      legacyStage = path.join(importsRoot!, 'video-processing-import-legacy');
      await mkdir(legacyStage, { recursive: true, mode: 0o700 });
      await writeFile(path.join(legacyStage, 'legacy.bin'), 'legacy');
    }, 30000);

    afterAll(async () => {
      try {
        if (db?.isInitialized && operationId)
          await db.transaction(async (m) => {
            await m.query(
              "SELECT set_config('ot.deletion_operation',$1,true)",
              [operationId]
            );
            await m.query(
              'DELETE FROM video_view WHERE "videoId"=ANY($1::uuid[])',
              [[ownVideo, placeholderVideo, counterpartVideo]]
            );
            await m.query(
              'DELETE FROM channel_subscription WHERE id=ANY($1::uuid[])',
              [[ownSub, foreignSub, ownSubscription]]
            );
            await m.query('DELETE FROM live_session WHERE id=ANY($1::uuid[])', [
              [ownLive, foreignLive],
            ]);
            await m.query(
              'DELETE FROM program_block WHERE id=ANY($1::uuid[])',
              [[ownBlock, foreignBlock]]
            );
            await m.query('DELETE FROM channel_feed WHERE id=ANY($1::uuid[])', [
              [ownFeed, counterpartFeed],
            ]);
            await m.query('DELETE FROM video WHERE id=ANY($1::uuid[])', [
              [ownVideo, placeholderVideo, counterpartVideo],
            ]);
            await m.query('DELETE FROM channel WHERE id=ANY($1::uuid[])', [
              [ownChannel, counterpartChannel],
            ]);
            await m.query(
              'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
              [operationId]
            );
          });
        if (db?.isInitialized) expect(await counts(db)).toEqual(baseline);
        for (const p of [ownStage, foreignStage, legacyStage])
          if (p) await rm(p, { recursive: true, force: true });
        for (const p of [ownVideo, counterpartVideo])
          if (p)
            await rm(path.join(outputRoot || '', p), {
              recursive: true,
              force: true,
            });
        if (authDb?.isInitialized && operationId) {
          await authDb.query(
            'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
            [operationId]
          );
          await authDb.query(
            'DELETE FROM account_deletion_operations WHERE id=$1',
            [operationId]
          );
          expect(
            (
              await authDb.query(
                'SELECT count(*)::int AS count FROM account_deletion_operations'
              )
            )[0].count
          ).toBe(authBaseline);
        }
      } finally {
        videosClient?.close();
        authClient?.close();
        await videosApp?.close();
        await authApp?.close();
        if (db?.isInitialized) await db.destroy();
        if (authDb?.isInitialized) await authDb.destroy();
        if (oldProof === undefined)
          delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
        else process.env['ACCOUNT_DELETION_PROOF_KEY'] = oldProof;
        if (oldWorkerHost === undefined)
          delete process.env['VIDEO_TRANSCODER_HOST'];
        else process.env['VIDEO_TRANSCODER_HOST'] = oldWorkerHost;
        if (oldAssetsHost === undefined)
          delete process.env['ASSETS_SERVICE_HOST'];
        else process.env['ASSETS_SERVICE_HOST'] = oldAssetsHost;
        if (oldAssetsPort === undefined)
          delete process.env['ASSETS_SERVICE_PORT'];
        else process.env['ASSETS_SERVICE_PORT'] = oldAssetsPort;
      }
    }, 30000);

    it('drains processing, fences owned writes, erases personal projections, preserves counterpart data, and reports readback', async () => {
      // Hold the production shared lease; the owner fence must be observed waiting in PostgreSQL.
      let release!: () => void;
      let entered!: () => void;
      const workEntered = new Promise<void>((r) => (entered = r));
      const hold = new Promise<void>((r) => (release = r));
      const admitted = drain.run(ownVideo, async () => {
        entered();
        await hold;
      });
      await workEntered;
      const fenceGrant = await authority.issueGrant(
        operationId,
        'videos',
        'fence'
      );
      const waiting = call(
        VideoCommands.FENCE_ACCOUNT_DELETION,
        fenceGrant
      ).then(
        (value) => ({ value }),
        (error) => ({ error })
      );
      try {
        let blocked = false;
        for (let i = 0; i < 80; i++) {
          const rows = await db.query(
            "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'"
          );
          if (rows[0].count > 0) {
            blocked = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 25));
        }
        expect(blocked).toBe(true);
      } finally {
        release();
      }
      await admitted;
      expect(await waiting).toHaveProperty('error');
      expect(await readFile(foreignOutput, 'utf8')).toBe('counterpart output');
      await rejectedDbWrite(
        'INSERT INTO video_view (id,"videoId","userId","profileId") VALUES ($1,$2,$3,$4)',
        [randomUUID(), counterpartVideo, account, profile]
      );
      await rejectedDbWrite('UPDATE channel SET "profileId"=$1 WHERE id=$2', [
        randomUUID(),
        ownChannel,
      ]);
      await rejectedDbWrite(
        'UPDATE channel_feed SET "activeProgramBlockId"=$1 WHERE id=$2',
        [ownBlock, counterpartFeed]
      );
      await db.query('UPDATE channel SET description=$1 WHERE id=$2', [
        'counterpart write allowed',
        counterpartChannel,
      ]);
      await expect(
        call(VideoCommands.FENCE_ACCOUNT_DELETION, fenceGrant)
      ).rejects.toBeTruthy();
      await expect(
        processing.purgeDeletionStaging([ownVideo, placeholderVideo])
      ).rejects.toThrow('VIDEO_LEGACY_IMPORT_ATTRIBUTION_UNRESOLVED');
      expect(
        (
          await authDb
            .getRepository(AccountDeletionOperationEntity)
            .findOneByOrFail({ id: operationId })
        ).ownerProgress['videos']
      ).toBeUndefined();
      await rm(legacyStage, { recursive: true, force: true });
      expect(
        (await call(VideoCommands.FENCE_ACCOUNT_DELETION, fenceGrant)).verified
      ).toBe(true);
      expect(
        (await readdir(path.dirname(path.dirname(ownStage)))).sort()
      ).toEqual([counterpartVideo]);
      expect(await readFile(foreignStage + '/counterpart.bin', 'utf8')).toBe(
        'counterpart staging'
      );
      expect(await readFile(foreignOutput, 'utf8')).toBe('counterpart output');
      await expect(readFile(ownOutput)).rejects.toMatchObject({
        code: 'ENOENT',
      });
      await expect(readFile(ownStage + '/own.bin')).rejects.toMatchObject({
        code: 'ENOENT',
      });
      await authority.acknowledge(fenceGrant);
      const eraseGrant = await authority.issueGrant(
        operationId,
        'videos',
        'erase'
      );
      expect(
        (await call(VideoCommands.ERASE_ACCOUNT_DELETION, eraseGrant)).verified
      ).toBe(true);
      await authority.acknowledge(eraseGrant);
      await authDb.query(
        'UPDATE account_deletion_operations SET "ownerProgress"=$2::jsonb WHERE id=$1',
        [
          operationId,
          JSON.stringify({
            ...otherOwnerFences!,
            videos: { fence: true, erase: true },
          }),
        ]
      );
      const ownRows = await db.query(
        'SELECT count(*)::int AS count FROM channel WHERE lower("userId")=$1 OR lower("profileId")=ANY($2::text[]) UNION ALL SELECT count(*)::int FROM video_view WHERE lower("userId")=$1 OR lower("profileId")=ANY($2::text[]) UNION ALL SELECT count(*)::int FROM channel_subscription WHERE lower("userId")=$1 OR lower("profileId")=ANY($2::text[]) UNION ALL SELECT count(*)::int FROM live_session WHERE lower("startedByUserId")=$1 OR lower("startedByProfileId")=ANY($2::text[])',
        [account, [profile]]
      );
      expect(ownRows.map((r: any) => r.count)).toEqual([0, 0, 0, 0]);
      expect(
        await db.query(
          'SELECT id FROM video WHERE id=ANY($1::uuid[]) ORDER BY id',
          [[ownVideo, placeholderVideo]]
        )
      ).toHaveLength(1);
      const placeholder = (
        await db.query(
          'SELECT title,description,"assetId","sourceAssetId","playbackAssetId","hlsManifestAssetId","thumbnailAssetId","communityId","processingError","viewCount","likeCount",visibility FROM video WHERE id=$1',
          [placeholderVideo]
        )
      )[0];
      expect(placeholder).toMatchObject({
        title: 'Deleted account',
        description: null,
        assetId: DELETED_ACCOUNT_ID,
        sourceAssetId: null,
        playbackAssetId: null,
        hlsManifestAssetId: null,
        thumbnailAssetId: null,
        communityId: null,
        processingError: null,
        viewCount: 0,
        likeCount: 0,
        visibility: 'private',
      });
      expect(
        await db.query(
          'SELECT "userId","profileId" FROM video_view WHERE "videoId"=$1',
          [placeholderVideo]
        )
      ).toEqual([{ userId: counterpart, profileId: counterpartProfile }]);
      expect(
        await db.query(
          'SELECT "userId","profileId" FROM channel_subscription WHERE id=$1',
          [foreignSub]
        )
      ).toEqual([{ userId: counterpart, profileId: counterpartProfile }]);
      expect(
        await db.query(
          'SELECT "channelId",title,"startedByUserId" FROM live_session WHERE id=$1',
          [foreignLive]
        )
      ).toEqual([
        {
          channelId: null,
          title: 'Counterpart live',
          startedByUserId: counterpart,
        },
      ]);
      expect(
        await db.query(
          'SELECT "videoId",title FROM program_block WHERE id=$1',
          [foreignBlock]
        )
      ).toEqual([{ videoId: null, title: 'Counterpart scheduled program' }]);
      expect(
        await db.query(
          'SELECT "activeVideoId","activeLiveSessionId","activeProgramBlockId" FROM channel_feed WHERE id=$1',
          [counterpartFeed]
        )
      ).toEqual([
        {
          activeVideoId: null,
          activeLiveSessionId: null,
          activeProgramBlockId: null,
        },
      ]);
      expect(
        await db.query(
          'SELECT "userId","profileId","name","description" FROM channel WHERE id=$1',
          [ownChannel]
        )
      ).toEqual([
        {
          userId: DELETED_ACCOUNT_ID,
          profileId: DELETED_ACCOUNT_ID,
          name: 'Deleted account',
          description: null,
        },
      ]);
      expect(
        await db.query(
          'SELECT title,description,"assetId" FROM video WHERE id=$1',
          [counterpartVideo]
        )
      ).toEqual([
        {
          title: 'Counterpart title',
          description: 'counterpart description',
          assetId: (
            await db.query('SELECT "assetId" FROM video WHERE id=$1', [
              counterpartVideo,
            ])
          )[0].assetId,
        },
      ]);
      const readGrant = await authority.issueGrant(
        operationId,
        'videos',
        'readback'
      );
      expect(
        (await call(VideoCommands.READBACK_ACCOUNT_DELETION, readGrant))
          .verified
      ).toBe(true);
      await authority.acknowledge(readGrant);
      const report = {
        fixture: 'D04 Videos account deletion',
        result: 'passed',
        operationId,
        ownVideoIds: [ownVideo, placeholderVideo],
        counterpartVideoId: counterpartVideo,
        verifiedAt: new Date().toISOString(),
        checks: [
          'production TCP fence/erase/readback',
          'processing drain lock wait',
          'legacy staging rejection without acknowledgement',
          'producer insert and OLD identity update denied',
          'counterpart writes and bytes preserved',
          'erase projection and placeholders independently read back',
        ],
      };
      const reportPath = path.join(
        process.cwd(),
        '.runtime-artifacts/account-rights/deletion/d04-fixture-report.json'
      );
      await mkdir(path.dirname(reportPath), { recursive: true });
      await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', {
        mode: 0o600,
      });
    });
  }
);
