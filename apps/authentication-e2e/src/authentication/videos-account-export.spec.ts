import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Client as PgClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AuthCommands,
  ProfileCommands,
  VideoCommands,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  VideosAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

describe('Videos account export private integration', () => {
  it('captures Videos over leased RPC and jobs, fences access, and recaptures after private restart', async () => {
    if (process.env.VIDEOS_JOB_E2E_MARKER !== 'private-videos-j11-v1')
      throw Error('Private Videos fixture marker required');
    const fixtureProject =
      process.env.PERMISSIONS_JOB_E2E_MARKER === 'private-permissions-j15-v1'
        ? 'ot-df007-permissions-integration'
        : 'ot-df007-videos-integration';
    const container = process.env.VIDEOS_JOB_E2E_CONTAINER_ID || '';
    if (!/^[a-f0-9]{64}$/.test(container))
      throw Error('Private Videos container required');
    const command = promisify(execFile);
    const inspected = JSON.parse(
      (await command('docker', ['inspect', container], { timeout: 10000 }))
        .stdout
    )[0];
    expect(inspected.Config.Labels['com.docker.compose.project']).toBe(
      fixtureProject
    );
    expect(inspected.Config.Labels['com.docker.compose.service']).toBe(
      'videos'
    );
    expect(
      inspected.Config.Labels[
        'io.optimistic-tanuki.account-rights.private-project'
      ]
    ).toBe(fixtureProject);
    if (
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15548'
    )
      throw Error('Private database fixture required');

    const connect = (port: number) =>
      ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port },
      });
    const auth = connect(3001),
      profile = connect(3002),
      assets = connect(3005);
    let videos = connect(3022);
    const databases = [
      'ot_authentication',
      'ot_profile',
      'ot_assets',
      'ot_videos',
    ].map(
      (database) =>
        new PgClient({
          host: '127.0.0.1',
          port: 15548,
          user: 'postgres',
          password: 'postgres',
          database,
        })
    );
    const [authDb, profileDb, , videoDb] = databases;
    const rpc = <T = any>(
      client: ClientProxy,
      cmd: string,
      payload: unknown,
      ms = 5000
    ) =>
      firstValueFrom(
        client.send<T>({ cmd }, payload).pipe(timeout({ first: ms }))
      );
    const users: { id: string; token: string }[] = [];
    const profiles: string[] = [];
    const jobIds: string[] = [];
    const channelIds = [randomUUID(), randomUUID()];
    const videoIds = [randomUUID(), randomUUID()];
    const subscriptionId = randomUUID(),
      viewId = randomUUID(),
      feedId = randomUUID(),
      blockId = randomUUID();
    const liveIds = [randomUUID(), randomUUID()];
    let parent: AccountExportSnapshotDescriptor | undefined;
    let child: VideosAccountExportSnapshotDescriptor | undefined;
    let grant: AccountExportCaptureGrant | undefined;
    let before: Record<string, string> | undefined;
    const tables = [
      'channel',
      'video',
      'channel_subscription',
      'video_view',
      'channel_feed',
      'program_block',
      'live_session',
    ] as const;
    const fingerprint = async () =>
      Object.fromEntries(
        await Promise.all(
          tables.map(async (table) => {
            const result = await videoDb.query(
              `SELECT jsonb_agg(to_jsonb(t) ORDER BY id)::text AS data FROM "${table}" t`
            );
            return [table, result.rows[0]?.data ?? 'null'];
          })
        )
      );
    try {
      await Promise.all(databases.map((db) => db.connect()));
      await Promise.all([
        auth.connect(),
        profile.connect(),
        assets.connect(),
        videos.connect(),
      ]);
      for (const label of ['owner', 'counterpart']) {
        const email = `account-export-videos-${
            label === 'owned' ? 'a' : 'b'
          }-${randomUUID()}@example.test`,
          password = 'AccountExportE2E!123';
        const registered = await rpc(auth, AuthCommands.Register, {
          email,
          fn: 'Videos',
          ln: label,
          password,
          confirm: password,
          ageEligibilityStatus: 'adult',
        });
        const id = registered.data.user.id;
        users.push({ id, token: '' });
        const login = await rpc(auth, AuthCommands.Login, {
          email,
          password,
          appId: 'client-interface',
        });
        users[users.length - 1].token = login.data.newToken;
        const profileId = randomUUID();
        profiles.push(profileId);
        await profileDb.query(
          `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'videos-j11','Videos fixture','','','','','','','')`,
          [profileId, id]
        );
      }

      const communityIds = [randomUUID(), randomUUID()];
      await videoDb.query(
        `INSERT INTO channel (id,name,description,"profileId","userId","communityId","communitySlug","joinPolicy","appScope","memberCount","isPublic",timezone) VALUES ($1,'Owned channel','owned channel description',$2,$3,$4,'owned-channel','open','videos-j11',3,true,'UTC'),($5,'Foreign channel','counterpart channel',$6,$7,$8,'foreign-channel','open','videos-j11',1,true,'UTC')`,
        [
          channelIds[0],
          profiles[0],
          users[0].id,
          communityIds[0],
          channelIds[1],
          profiles[1],
          users[1].id,
          communityIds[1],
        ]
      );
      await videoDb.query(
        `INSERT INTO video (id,title,description,"assetId","sourceAssetId","playbackAssetId","hlsManifestAssetId","thumbnailAssetId","channelId","communityId","durationSeconds",resolution,encoding,"processingStatus","processingError","viewCount","likeCount",visibility,"publishedAt") VALUES ($1,'Owned recording',repeat('supported detail ',1200),$2,$3,$4,$5,$6,$7,$8,42,'720p','h264','ready','PRIVATE_PROCESSING_ERROR',$9,8,'unlisted',now()),($10,'Counterpart recording','foreign title',$11,NULL,NULL,NULL,NULL,$12,$13,20,'480p','h264','ready','FOREIGN_ERROR',4,1,'public',now())`,
        [
          videoIds[0],
          randomUUID(),
          randomUUID(),
          randomUUID(),
          randomUUID(),
          randomUUID(),
          channelIds[0],
          communityIds[0],
          3,
          videoIds[1],
          randomUUID(),
          channelIds[1],
          communityIds[1],
        ]
      );
      await videoDb.query(
        `INSERT INTO channel_subscription (id,"channelId","userId","profileId") VALUES ($1,$2,$3,$4)`,
        [subscriptionId, channelIds[1], users[0].id, profiles[0]]
      );
      await videoDb.query(
        `INSERT INTO video_view (id,"videoId","userId","profileId","ipAddress","watchDurationSeconds") VALUES ($1,$2,$3,$4,'203.0.113.77',17)`,
        [viewId, videoIds[1], users[0].id, profiles[0]]
      );
      await videoDb.query(
        `INSERT INTO channel_feed (id,"channelId","communityId",timezone,"currentMode","activeVideoId") VALUES ($1,$2,$3,'UTC','scheduled',$4)`,
        [feedId, channelIds[0], communityIds[0], videoIds[0]]
      );
      await videoDb.query(
        `INSERT INTO program_block (id,"communityId","channelId","videoId","blockType",title,description,status,"startsAt","endsAt") VALUES ($1,$2,$3,$4,'prerecorded','Owned schedule','safe schedule metadata','scheduled',now(),now()+interval '1 hour')`,
        [blockId, communityIds[0], channelIds[0], videoIds[0]]
      );
      await videoDb.query(
        `INSERT INTO live_session (id,"communityId","channelId",title,description,status,"startedByUserId","startedByProfileId","thumbnailAssetId","liveSourceUrl") VALUES ($1,$2,$3,'Owned live session','safe live metadata','live',$4,$5,$6,'https://private.invalid/stream-secret'),($7,$2,$3,'Counterpart hosted session','safe attached metadata','ended',$8,$9,NULL,'https://private.invalid/other-secret')`,
        [
          liveIds[0],
          communityIds[0],
          channelIds[0],
          users[0].id,
          profiles[0],
          randomUUID(),
          liveIds[1],
          users[1].id,
          profiles[1],
        ]
      );
      before = await fingerprint();

      const requestValue = {
        accountId: users[0].id,
        token: users[0].token,
        appId: 'client-interface',
        idempotencyKey: randomUUID(),
      };
      const created = await rpc(
        auth,
        AuthCommands.CreateAccountExportJob,
        requestValue
      );
      jobIds.push(created.jobId);
      let job = await rpc(
        auth,
        AuthCommands.ResumeAccountExportJob,
        { ...requestValue, jobId: created.jobId },
        55000
      );
      const expectedOwners = [
        'authentication',
        'profile',
        'assets',
        'videos',
        'permissions',
        'social',
        'forum',
        'workspace',
        'app-configurator',
        'chat-collector',
        'classifieds',
      ];
      expect(job.state).toBe('incomplete');
      expect(job.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners
      );
      expect(job.coverageSummary.artifactAvailable).toBe(false);

      await videoDb.query(
        `UPDATE video SET "processingStatus"='processing' WHERE id=$1`,
        [videoIds[0]]
      );
      const unavailable = await rpc(
        auth,
        AuthCommands.ResumeAccountExportJob,
        { ...requestValue, jobId: created.jobId },
        55000
      );
      expect(unavailable.state).toBe('failed');
      expect(unavailable.coverageSummary.capturedDatabaseOwners).toEqual([
        'authentication',
        'profile',
        'assets',
      ]);
      expect(unavailable.coverageSummary.blockers).toContain(
        'videos-capture-unavailable'
      );
      await videoDb.query(
        `UPDATE video SET "processingStatus"='ready' WHERE id=$1`,
        [videoIds[0]]
      );
      job = await rpc(
        auth,
        AuthCommands.ResumeAccountExportJob,
        { ...requestValue, jobId: created.jobId },
        55000
      );
      expect(job.state).toBe('incomplete');
      expect(job.coverageSummary.capturedDatabaseOwners).toEqual(
        expectedOwners
      );

      grant = {
        accountId: users[0].id,
        token: users[0].token,
        appId: 'client-interface',
        jobId: created.jobId,
        attempt: job.attempt + 1,
        leaseOwner: randomUUID(),
      };
      await authDb.query(
        `UPDATE account_export_jobs SET state='running',attempt=$2,"leaseOwner"=$3,"leaseExpiresAt"=clock_timestamp()+interval '5 minutes' WHERE id=$1`,
        [created.jobId, grant.attempt, grant.leaseOwner]
      );
      parent = await rpc(
        profile,
        ProfileCommands.OpenAccountExportCapture,
        grant,
        55000
      );
      for (const override of [
        { accountId: users[1].id, token: users[1].token },
        { appId: 'forgeofwill' },
        { attempt: grant.attempt + 1 },
        { leaseOwner: randomUUID() },
      ])
        await expect(
          rpc(
            videos,
            VideoCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, ...override, profileSnapshot: parent },
            55000
          )
        ).rejects.toBeDefined();
      child = await rpc(
        videos,
        VideoCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child).toMatchObject({
        participantId: 'videos',
        accountId: users[0].id,
        profileHandleId: parent.handleId,
        profileCaptureId: parent.captureId,
        profileSnapshotAt: parent.snapshotAt,
        identityCount: 0,
      });
      expect(child.sources).toEqual([
        'channel',
        'video',
        'channelSubscription',
        'videoView',
        'channelFeed',
        'programBlock',
        'liveSession',
      ]);

      const chunks: Buffer[] = [];
      for (let offset = 0; offset < child.sizeBytes; ) {
        const length = Math.min(65536, child.sizeBytes - offset);
        const read = await rpc(
          videos,
          VideoCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          { ...grant, handleId: child.handleId, offset, length }
        );
        expect(read.offset).toBe(offset);
        expect(read.captureId).toBe(child.captureId);
        const bytes = Buffer.from(read.bytesBase64, 'base64');
        expect(bytes.length).toBe(length);
        chunks.push(bytes);
        offset += bytes.length;
      }
      const body = Buffer.concat(chunks);
      expect(createHash('sha256').update(body).digest('hex')).toBe(
        child.sha256
      );
      const pages = body
        .toString('utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      const records = pages.flatMap((page) => page.records);
      expect(pages[pages.length - 1]).toMatchObject({
        source: 'end',
        complete: true,
        rowCount: 8,
        checksum: createHash('sha256')
          .update(
            records.map((record) => `${JSON.stringify(record)}\n`).join('')
          )
          .digest('hex'),
      });
      expect(child.sourceRowCounts).toEqual({
        channel: 1,
        video: 1,
        channelSubscription: 1,
        videoView: 1,
        channelFeed: 1,
        programBlock: 1,
        liveSession: 2,
      });
      expect(records.filter((r) => r.source === 'liveSession')).toHaveLength(2);
      expect(records.find((r) => r.source === 'channel')?.data.profileId).toBe(
        profiles[0]
      );
      expect(records.find((r) => r.source === 'videoView')?.data.videoId).toBe(
        videoIds[1]
      );
      expect(
        records.find((r) => r.source === 'video')?.data.assetId
      ).toBeTruthy();
      expect(records.some((r) => r.source === 'assetMedia')).toBe(false);
      const json = body.toString('utf8');
      for (const secret of [
        users[1].id,
        profiles[1],
        '203.0.113.77',
        'PRIVATE_PROCESSING_ERROR',
        'FOREIGN_ERROR',
        'stream-secret',
        'other-secret',
        'liveSourceUrl',
        'processingError',
        'ipAddress',
      ])
        expect(json).not.toContain(secret);

      await expect(
        rpc(videos, VideoCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          appId: 'other',
          handleId: child.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_SNAPSHOT_NOT_FOUND' });
      await authDb.query(
        `UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE id=$1`,
        [grant.jobId]
      );
      await expect(
        rpc(videos, VideoCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      await authDb.query(
        `UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()+interval '5 minutes' WHERE id=$1`,
        [grant.jobId]
      );

      const old = child;
      await videos.close();
      await command('docker', ['restart', '--time', '5', container], {
        timeout: 20000,
      });
      const deadline = Date.now() + 20000;
      while (true) {
        videos = connect(3022);
        try {
          await rpc(
            videos,
            VideoCommands.READ_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, handleId: old.handleId, offset: 0, length: 1 },
            1500
          );
          throw Error('Restart preserved an old Videos handle');
        } catch (error) {
          const e = error as { code?: string; name?: string; message?: string };
          if (e.code === 'OWNER_SNAPSHOT_NOT_FOUND') break;
          if (
            Date.now() > deadline ||
            !(
              e.name === 'TimeoutError' ||
              ['ECONNREFUSED', 'ECONNRESET'].includes(e.code || '') ||
              e.message === 'Connection closed'
            )
          )
            throw error;
        }
        await videos.close();
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      child = undefined;
      const staleRelease = await rpc(
        videos,
        VideoCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, handleId: old.handleId }
      );
      expect(staleRelease.released).toBe(true);
      child = await rpc(
        videos,
        VideoCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child.captureId).not.toBe(old.captureId);
      expect(child.profileCaptureId).toBe(parent.captureId);
      await rpc(auth, AuthCommands.Logout, { token: users[0].token });
      await expect(
        rpc(videos, VideoCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      await rpc(videos, VideoCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE, {
        ...grant,
        handleId: child.handleId,
      });
      child = undefined;
      await rpc(profile, ProfileCommands.ReleaseAccountExportCapture, {
        ...grant,
        handleId: parent.handleId,
      });
      parent = undefined;
      expect(await fingerprint()).toEqual(before);
    } finally {
      if (child && grant)
        await rpc(videos, VideoCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
        }).catch(() => undefined);
      if (parent && grant)
        await rpc(profile, ProfileCommands.ReleaseAccountExportCapture, {
          ...grant,
          handleId: parent.handleId,
        }).catch(() => undefined);
      for (const user of users)
        if (user.token)
          await rpc(auth, AuthCommands.Logout, { token: user.token }).catch(
            () => undefined
          );
      await videoDb.query('DELETE FROM video_view WHERE id=$1', [viewId]);
      await videoDb.query('DELETE FROM channel_subscription WHERE id=$1', [
        subscriptionId,
      ]);
      await videoDb.query('DELETE FROM channel_feed WHERE id=$1', [feedId]);
      await videoDb.query('DELETE FROM program_block WHERE id=$1', [blockId]);
      await videoDb.query('DELETE FROM live_session WHERE id=ANY($1::uuid[])', [
        liveIds,
      ]);
      await videoDb.query('DELETE FROM video WHERE id=ANY($1::uuid[])', [
        videoIds,
      ]);
      await videoDb.query('DELETE FROM channel WHERE id=ANY($1::uuid[])', [
        channelIds,
      ]);
      await profileDb.query('DELETE FROM profile WHERE id=ANY($1::uuid[])', [
        profiles,
      ]);
      await authDb.query(
        'DELETE FROM account_export_jobs WHERE id=ANY($1::uuid[])',
        [jobIds]
      );
      const ids = users.map((user) => user.id);
      await authDb.query('DELETE FROM token WHERE "userId"=ANY($1::uuid[])', [
        ids,
      ]);
      const keyRows = await authDb.query(
        'SELECT "keyDataId" FROM user_entity WHERE id=ANY($1::uuid[])',
        [ids]
      );
      const keyIds = keyRows.rows.map((row) => row.keyDataId).filter(Boolean);
      await authDb.query(
        'UPDATE user_entity SET "keyDataId"=NULL WHERE id=ANY($1::uuid[])',
        [ids]
      );
      await authDb.query(
        'UPDATE key_datum SET "userId"=NULL WHERE id=ANY($1::uuid[])',
        [keyIds]
      );
      await authDb.query('DELETE FROM user_entity WHERE id=ANY($1::uuid[])', [
        ids,
      ]);
      await authDb.query('DELETE FROM key_datum WHERE id=ANY($1::uuid[])', [
        keyIds,
      ]);
      await Promise.all(databases.map((db) => db.end().catch(() => undefined)));
      await Promise.all(
        [auth, profile, assets, videos].map((client) =>
          Promise.resolve()
            .then(() => client.close())
            .catch(() => undefined)
        )
      );
    }
  }, 120000);
});
