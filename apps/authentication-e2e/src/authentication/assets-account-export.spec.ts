import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Client as PgClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, unlink, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AssetCommands,
  AuthCommands,
  ProfileCommands,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AssetsAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import { EnvelopeEncryptionService } from '@optimistic-tanuki/storage';

// Only the host fixture's unrelated adapter dependency is substituted.
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

describe('Assets account export real leased service integration', () => {
  it('captures Assets over leased RPC and jobs, fences access, and recaptures after private restart', async () => {
    if (process.env.ASSETS_JOB_E2E_MARKER !== 'private-assets-j9-v1')
      throw Error('Private Assets fixture marker required');
    const container = process.env.ASSETS_JOB_E2E_CONTAINER_ID || '';
    if (!/^[a-f0-9]{64}$/.test(container))
      throw Error('Private Assets container required');
    const command = promisify(execFile);
    const inspected = JSON.parse(
      (await command('docker', ['inspect', container], { timeout: 10000 }))
        .stdout
    )[0];
    expect(inspected.Config.Labels['com.docker.compose.project']).toBe(
      'ot-df007-assets-integration'
    );
    expect(inspected.Config.Labels['com.docker.compose.service']).toBe(
      'assets'
    );
    expect(
      inspected.Config.Labels[
        'io.optimistic-tanuki.account-rights.private-project'
      ]
    ).toBe('ot-df007-assets-integration');
    const dir = await realpath(process.env.ASSETS_JOB_E2E_MEDIA_DIR || '');
    expect(dir).toBe(
      resolve(
        '.runtime-artifacts/account-rights/finish-sequence/assets-integration/runtime/media-fixtures'
      )
    );
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
      profile = connect(3002);
    let assets = connect(3005);
    const databases = ['ot_authentication', 'ot_profile', 'ot_assets'].map(
      (database) =>
        new PgClient({
          host: '127.0.0.1',
          port: 15548,
          user: 'postgres',
          password: 'postgres',
          database,
        })
    );
    const [authDb, profileDb, assetDb] = databases;
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
    const assetIds = [randomUUID(), randomUUID(), randomUUID()];
    const activityId = randomUUID();
    const fileNames = [
      'fixture-owned.png.env',
      'fixture-owned.mp4.env',
      'fixture-foreign.png.env',
    ];
    let parent: AccountExportSnapshotDescriptor | undefined,
      child: AssetsAccountExportSnapshotDescriptor | undefined,
      grant: AccountExportCaptureGrant | undefined;
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xWQAAAAASUVORK5CYII=',
      'base64'
    );
    const encryption = new EnvelopeEncryptionService({
      VAULT_STORAGE_KEK: 'isolated-assets-j9-fixture-kek',
    });
    try {
      await Promise.all(databases.map((db) => db.connect()));
      await Promise.all([auth.connect(), profile.connect(), assets.connect()]);
      for (const label of ['a', 'b']) {
        const email = `account-export-assets-${label}-${randomUUID()}@example.test`,
          password = 'AccountExportE2E!123';
        const reg = await rpc(auth, AuthCommands.Register, {
          email,
          fn: 'Assets',
          ln: label,
          password,
          confirm: password,
          ageEligibilityStatus: 'adult',
        });
        const id = reg.data.user.id;
        users.push({ id, token: '' });
        const login = await rpc(auth, AuthCommands.Login, {
          email,
          password,
          appId: 'client-interface',
        });
        users[users.length - 1].token = login.data.newToken;
        const idProfile = randomUUID();
        profiles.push(idProfile);
        await profileDb.query(
          `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'assets-j9','Assets fixture','','','','','','','')`,
          [idProfile, id]
        );
      }
      await command(
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
          join(dir, 'fixture.mp4'),
        ],
        { timeout: 10000 }
      );
      const mp4 = await readFile(join(dir, 'fixture.mp4'));
      await unlink(join(dir, 'fixture.mp4'));
      for (const [i, bytes] of [
        [0, png],
        [1, mp4],
        [2, png],
      ] as const)
        await writeFile(join(dir, fileNames[i]), encryption.encrypt(bytes), {
          mode: 0o600,
        });
      for (let i = 0; i < 3; i++)
        await assetDb.query(
          `INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId") VALUES ($1,$2,$3,'local_block_storage',$4,$5)`,
          [
            assetIds[i],
            i === 1 ? 'owned.mp4' : 'owned.png',
            i === 1 ? 'video' : 'image',
            fileNames[i],
            profiles[i === 2 ? 1 : 0],
          ]
        );
      await assetDb.query(
        `INSERT INTO guardian_asset_activity (id,"actorUserId","dependentUserId","profileId","assetId","appId",operation) VALUES ($1,$2,$3,$4,$5,'client-interface','read')`,
        [activityId, users[1].id, users[0].id, profiles[0], assetIds[0]]
      );
      const before = await assetDb.query(
        'SELECT jsonb_agg(to_jsonb(a) ORDER BY id)::text AS data FROM asset_entity a'
      );
      const request = {
        accountId: users[0].id,
        token: users[0].token,
        appId: 'client-interface',
        idempotencyKey: randomUUID(),
      };
      const created = await rpc(
        auth,
        AuthCommands.CreateAccountExportJob,
        request
      );
      jobIds.push(created.jobId);
      const job = await rpc(
        auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: created.jobId },
        55000
      );
      expect(job.state).toBe('incomplete');
      expect(job.coverageSummary.capturedDatabaseOwners).toEqual([
        'authentication',
        'profile',
        'assets',
      ]);
      expect(job.coverageSummary.artifactAvailable).toBe(false);
      expect(JSON.stringify(job)).not.toContain(users[0].token);
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
            assets,
            AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, ...override, profileSnapshot: parent },
            55000
          )
        ).rejects.toBeDefined();
      child = await rpc(
        assets,
        AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child).toMatchObject({
        participantId: 'assets',
        accountId: users[0].id,
        profileHandleId: parent.handleId,
        profileCaptureId: parent.captureId,
        profileSnapshotAt: parent.snapshotAt,
        identityCount: 0,
      });
      const chunks: Buffer[] = [];
      for (let offset = 0; offset < child.sizeBytes; ) {
        const length = Math.min(65536, child.sizeBytes - offset);
        const read = await rpc(
          assets,
          AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE,
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
      const records = body
        .toString('utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
        .flatMap((page) => page.records);
      expect(records.filter((r) => r.source === 'asset')).toHaveLength(2);
      expect(
        records.filter((r) => r.source === 'guardianActivity')
      ).toHaveLength(1);
      for (const [id, expected, mime] of [
        [assetIds[0], png, 'image/png'],
        [assetIds[1], mp4, 'video/mp4'],
      ] as const) {
        const media = records.filter(
          (r) => r.source === 'assetMedia' && r.data.assetId === id
        );
        expect(
          Buffer.concat(
            media
              .filter((r) => r.data.kind === 'bytes')
              .map((r) => Buffer.from(r.data.bytesBase64, 'base64'))
          )
        ).toEqual(expected);
        expect(
          media.find((r) => r.data.kind === 'manifest').data
        ).toMatchObject({
          mimeType: mime,
          sizeBytes: expected.length,
          sha256: createHash('sha256').update(expected).digest('hex'),
        });
      }
      for (const secret of [
        users[1].id,
        profiles[1],
        assetIds[2],
        users[0].token,
        grant.leaseOwner,
        'storagePath',
        'fixture-owned.png.env',
      ])
        expect(body.toString('utf8')).not.toContain(secret);
      await expect(
        rpc(assets, AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          leaseOwner: randomUUID(),
          handleId: child.handleId,
        })
      ).rejects.toBeDefined();
      await authDb.query(
        `UPDATE account_export_jobs SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE id=$1`,
        [grant.jobId]
      );
      await expect(
        rpc(assets, AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
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
      await assets.close();
      await command('docker', ['restart', '--time', '5', container], {
        timeout: 20000,
      });
      const deadline = Date.now() + 20000;
      while (true) {
        assets = connect(3005);
        try {
          await rpc(
            assets,
            AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, handleId: old.handleId, offset: 0, length: 1 },
            1500
          );
          throw Error('Restart preserved an old Assets handle');
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
        await assets.close();
        await new Promise((r) => setTimeout(r, 200));
      }
      child = undefined;
      // Profile survives the child restart and remains leased until all dependent reads finish.
      child = await rpc(
        assets,
        AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      expect(child.captureId).not.toBe(old.captureId);
      await rpc(assets, AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE, {
        ...grant,
        handleId: child.handleId,
      });
      child = undefined;
      await writeFile(
        join(dir, fileNames[0]),
        Buffer.from('corrupted envelope'),
        { mode: 0o600 }
      );
      await expect(
        rpc(
          assets,
          AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
          { ...grant, profileSnapshot: parent },
          55000
        )
      ).rejects.toBeDefined();
      await rpc(profile, ProfileCommands.ReleaseAccountExportCapture, {
        ...grant,
        handleId: parent.handleId,
      });
      parent = undefined;
      await authDb.query(
        `UPDATE account_export_jobs SET state='incomplete',"leaseOwner"=NULL,"leaseExpiresAt"=NULL WHERE id=$1`,
        [grant.jobId]
      );
      const failed = await rpc(
        auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: grant.jobId },
        55000
      );
      expect(failed.state).toBe('failed');
      expect(failed.coverageSummary.capturedDatabaseOwners).toEqual([
        'authentication',
        'profile',
      ]);
      expect(failed.coverageSummary.blockers).toContain(
        'assets-capture-unavailable'
      );
      await writeFile(join(dir, fileNames[0]), encryption.encrypt(png), {
        mode: 0o600,
      });
      const recovered = await rpc(
        auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: grant.jobId },
        55000
      );
      expect(recovered.state).toBe('incomplete');
      expect(recovered.coverageSummary.capturedDatabaseOwners).toEqual([
        'authentication',
        'profile',
        'assets',
      ]);
      grant = {
        ...grant,
        attempt: recovered.attempt + 1,
        leaseOwner: randomUUID(),
      };
      await authDb.query(
        `UPDATE account_export_jobs SET state='running',attempt=$2,"leaseOwner"=$3,"leaseExpiresAt"=clock_timestamp()+interval '5 minutes' WHERE id=$1`,
        [grant.jobId, grant.attempt, grant.leaseOwner]
      );
      parent = await rpc(
        profile,
        ProfileCommands.OpenAccountExportCapture,
        grant,
        55000
      );
      child = await rpc(
        assets,
        AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      await rpc(auth, AuthCommands.Logout, { token: users[0].token });
      await expect(
        rpc(assets, AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId: child.handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
      await rpc(assets, AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE, {
        ...grant,
        handleId: child.handleId,
      });
      child = undefined;
      expect(
        await assetDb.query(
          'SELECT jsonb_agg(to_jsonb(a) ORDER BY id)::text AS data FROM asset_entity a'
        )
      ).toEqual(before);
    } finally {
      if (child && grant)
        await rpc(assets, AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE, {
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
      await assetDb.query('DELETE FROM guardian_asset_activity WHERE id=$1', [
        activityId,
      ]);
      await assetDb.query('DELETE FROM asset_entity WHERE id=ANY($1::uuid[])', [
        assetIds,
      ]);
      await profileDb.query('DELETE FROM profile WHERE id=ANY($1::uuid[])', [
        profiles,
      ]);
      const ids = users.map((u) => u.id);
      await authDb.query(
        'DELETE FROM account_export_jobs WHERE id=ANY($1::uuid[])',
        [jobIds]
      );
      await authDb.query('DELETE FROM token WHERE "userId"=ANY($1::uuid[])', [
        ids,
      ]);
      const keyRows = await authDb.query(
        'SELECT "keyDataId" FROM user_entity WHERE id=ANY($1::uuid[])',
        [ids]
      );
      const keyIds = keyRows.rows.map((r) => r.keyDataId).filter(Boolean);
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
      await Promise.all(databases.map((db) => db.end()));
      await Promise.all([auth.close(), profile.close(), assets.close()]);
      for (const name of fileNames)
        await unlink(join(dir, name)).catch(() => undefined);
    }
  }, 180000);
});
