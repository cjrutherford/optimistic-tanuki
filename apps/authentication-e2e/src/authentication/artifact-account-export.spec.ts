import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Client as PgClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { request as httpRequest } from 'node:http';
import { promisify } from 'node:util';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AuthCommands,
  ProfileCommands,
  PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import { PaymentCommands } from '@optimistic-tanuki/payments-contracts';
import { EnvelopeEncryptionService } from '@optimistic-tanuki/storage';
import { ACCOUNT_EXPORT_RELEASE_COVERAGE_VERSION } from '../../../authentication/src/account-export-jobs/account-export-release-registry';
import {
  AccountExportCaptureGrant,
  AccountExportOwnerCaptureVerifier,
  AccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

describe('A07 real 12-service account export artifact integration', () => {
  it('builds and downloads an owner-scoped portable artifact and fences stale access', async () => {
    if (
      process.env.ARTIFACT_JOB_E2E_MARKER !== 'private-a07-artifact-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-payments-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15560' ||
      process.env.AUTH_AUTO_VERIFY_EMAILS !== 'true'
    )
      throw Error('Private A07 artifact fixture required');
    const reportPath = process.env.ARTIFACT_JOB_E2E_REPORT_PATH,
      paymentsContainer = process.env.ARTIFACT_PAYMENTS_CONTAINER_ID || '',
      authContainer = process.env.ARTIFACT_AUTH_CONTAINER_ID || '',
      mediaInputDir = process.env.A07_MEDIA_INPUT_DIR,
      mediaStorageDir = process.env.A07_MEDIA_STORAGE_DIR;
    if (
      !reportPath ||
      !mediaInputDir ||
      !mediaStorageDir ||
      !/^[a-f0-9]{64}$/.test(paymentsContainer) ||
      !/^[a-f0-9]{64}$/.test(authContainer)
    )
      throw Error('Private A07 report, media paths, and targets required');
    const command = promisify(execFile);
    const inspected = JSON.parse(
      (
        await command('docker', ['inspect', paymentsContainer], {
          timeout: 10000,
        })
      ).stdout
    )[0];
    for (const [key, value] of Object.entries({
      'com.docker.compose.project': 'ot-df007-artifact-integration',
      'com.docker.compose.service': 'payments',
      'io.optimistic-tanuki.account-rights.private-project':
        'ot-df007-artifact-integration',
    }))
      expect(inspected.Config.Labels[key]).toBe(value);
    const inspectedAuth = JSON.parse(
      (await command('docker', ['inspect', authContainer], { timeout: 10000 }))
        .stdout
    )[0];
    for (const [key, value] of Object.entries({
      'com.docker.compose.project': 'ot-df007-artifact-integration',
      'com.docker.compose.service': 'authentication',
      'io.optimistic-tanuki.account-rights.private-project':
        'ot-df007-artifact-integration',
    }))
      expect(inspectedAuth.Config.Labels[key]).toBe(value);
    const connect = (port: number) =>
      ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port },
      });
    const clients: Record<string, ClientProxy> = {
      auth: connect(14801),
      profile: connect(14802),
      payments: connect(14804),
    };
    const databaseNames = [
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
      'payments',
    ];
    const databases = databaseNames.map(
      (name) =>
        new PgClient({
          host: '127.0.0.1',
          port: 15560,
          user: 'postgres',
          password: 'postgres',
          database: 'ot_' + name.replace(/-/g, '_'),
        })
    );
    const authDb = databases[0],
      profileDb = databases[1],
      assetsDb = databases[2],
      socialDb = databases[databaseNames.indexOf('social')],
      paymentsDb = databases[databaseNames.indexOf('payments')];
    const rpc = <T = any>(
      client: ClientProxy,
      cmd: string,
      payload: unknown,
      ms = 5000
    ) =>
      firstValueFrom(
        client.send<T>({ cmd }, payload).pipe(timeout({ first: ms }))
      );
    const pause = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const pollJob = async (request: Record<string, unknown>) => {
      const deadline = Date.now() + 90_000;
      let status: any;
      do {
        status = await rpc(
          clients.auth,
          AuthCommands.GetAccountExportJob,
          request
        );
        if (!['queued', 'running'].includes(status.state)) return status;
        await pause(100);
      } while (Date.now() < deadline);
      throw new Error('Account export job poll deadline');
    };
    const getHttp = (path: string, headers: Record<string, string>) =>
      new Promise<{
        status: number;
        headers: Record<string, string>;
        body: Buffer;
      }>((resolve, reject) => {
        const req = httpRequest(
          { host: '127.0.0.1', port: 14880, path, method: 'GET', headers },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            res.on('end', () =>
              resolve({
                status: res.statusCode ?? 0,
                headers: res.headers as Record<string, string>,
                body: Buffer.concat(chunks),
              })
            );
          }
        );
        req.setTimeout(15000, () =>
          req.destroy(new Error('A07 gateway HTTP timeout'))
        );
        req.on('error', reject);
        req.end();
      });
    const users: { id: string; token: string }[] = [];
    let ownerLogin: { email: string; password: string } | undefined;
    const profiles = Array.from({ length: 3 }, () => randomUUID());
    const ids = Array.from({ length: 12 }, () => randomUUID());
    const donationIds = Array.from({ length: 205 }, () => randomUUID());
    const assetIds = Array.from({ length: 5 }, () => randomUUID());
    const socialPostIds = [randomUUID(), randomUUID()];
    const productId = randomUUID();
    const providerOrderId = randomUUID();
    const jobs: string[] = [];
    let businessThemeId = randomUUID(),
      sponsorshipId = randomUUID();
    const localHubJobs: string[] = [];
    let baseline: Record<string, Record<string, string>> | undefined,
      parent: AccountExportSnapshotDescriptor | undefined,
      grant: AccountExportCaptureGrant | undefined,
      handleId: string | undefined,
      parentHandle: string | undefined,
      failure: unknown;
    const report: Record<string, any> = {
      result: 'RUNNING',
      participantId: 'payments',
      mockedCapabilities: [],
      stage: {},
      cleanup: {},
    };
    const counts = async () => {
      const out: Record<string, Record<string, string>> = {};
      for (let i = 0; i < databases.length; i++) {
        const db = databases[i],
          ts = (
            await db.query(
              "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
            )
          ).rows;
        out[databaseNames[i]] = {};
        for (const { table_name } of ts)
          out[databaseNames[i]][table_name] = (
            await db.query(
              `SELECT count(*)::text count FROM public."${String(
                table_name
              ).replace(/"/g, '""')}"`
            )
          ).rows[0].count;
      }
      return out;
    };
    try {
      await Promise.all(databases.map((db) => db.connect()));
      await Promise.all(Object.values(clients).map((c) => c.connect()));
      baseline = await counts();
      report.phase = 'register-and-seed';
      for (const label of ['owner', 'counterpart']) {
        const email = `a07-artifact-${label}-${randomUUID().slice(
            0,
            8
          )}@example.test`,
          password = 'ChatExportE2E!123';
        const reg = await rpc(clients.auth, AuthCommands.Register, {
          email,
          fn: 'PayExport',
          ln: label,
          password,
          confirm: password,
          ageEligibilityStatus: 'adult',
        });
        users.push({ id: reg.data.user.id, token: '' });
        if (label === 'owner') ownerLogin = { email, password };
        const login = await rpc(clients.auth, AuthCommands.Login, {
          email,
          password,
          appId: 'client-interface',
        });
        users.at(-1)!.token = login.data.newToken;
      }
      await profileDb.query(
        `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'client-interface','Owner','','','','','','',''),($3,$2,'local-hub','Second','','','','','','',''),($4,$5,'client-interface','Counterpart','','','','','','','')`,
        [profiles[0], users[0].id, profiles[1], profiles[2], users[1].id]
      );
      mkdirSync(mediaInputDir, { recursive: true, mode: 0o700 });
      mkdirSync(mediaStorageDir, { recursive: true, mode: 0o700 });
      const png = readFileSync(join(mediaInputDir, 'image.png'));
      const mp4 = readFileSync(join(mediaInputDir, 'video.mp4'));
      const segment = readFileSync(join(mediaInputDir, 'segment.ts'));
      const playlist = Buffer.from(
        `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:1,\n/api/asset/${assetIds[2]}\n#EXT-X-ENDLIST\n`
      );
      const mediaBytes = [png, mp4, segment, playlist, png];
      const envelope = new EnvelopeEncryptionService({
        VAULT_STORAGE_KEK: 'isolated-assets-j9-fixture-kek',
        VAULT_STORAGE_KEK_ID: 'isolated-assets-j9-fixture-kek',
      } as NodeJS.ProcessEnv);
      for (let i = 0; i < mediaBytes.length; i++) {
        const storageName = `${assetIds[i]}.bin`;
        writeFileSync(
          join(mediaStorageDir, storageName),
          envelope.encrypt(mediaBytes[i]),
          { mode: 0o600 }
        );
        await assetsDb.query(
          `INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId") VALUES ($1,$2,$3,'local_block_storage',$4,$5)`,
          [
            assetIds[i],
            `${assetIds[i]}.${['png', 'mp4', 'ts', 'm3u8', 'png'][i]}`,
            i === 0 || i === 4 ? 'image' : 'video',
            storageName,
            i === 4 ? profiles[2] : profiles[0],
          ]
        );
      }
      await socialDb.query(
        `INSERT INTO post (id,title,content,"profileId","userId","appScope",visibility) VALUES ($1,'A07 owned media canary','owned canary <img src="/api/asset/${assetIds[0]}">',$3,$4,'client-interface','public'),($2,'A07 foreign media canary','foreign counterpart canary',$5,$6,'client-interface','public')`,
        [
          socialPostIds[0],
          socialPostIds[1],
          profiles[0],
          users[0].id,
          profiles[2],
          users[1].id,
        ]
      );
      const dates = "'2026-10-23 01:02:03.123456'";
      for (let i = 0; i < 205; i++)
        await paymentsDb.query(
          `INSERT INTO donations (id,"userId","profileId",amount,"isRecurring",status,currency,"createdAt") VALUES ($1,$2,$3,$4,false,'completed','USD',${dates})`,
          [
            donationIds[i],
            users[i < 202 ? 0 : 1].id,
            profiles[i < 202 ? i % 2 : 2],
            i === 0 ? '99999999.99' : (i + 1).toFixed(2),
          ]
        );
      await paymentsDb.query(
        `INSERT INTO classified_payments (id,"classifiedId","buyerId","sellerId",amount,"platformFeeAmount","sellerReceivesAmount",status,"createdAt") VALUES ($1,$2,$3,$4,12.30,1.00,11.30,'confirmed',${dates}),($5,$6,$7,$8,12.30,1.00,11.30,'released',${dates})`,
        [
          ids[0],
          randomUUID(),
          users[0].id,
          users[1].id,
          ids[1],
          randomUUID(),
          users[1].id,
          users[0].id,
        ]
      );
      await paymentsDb.query(
        `INSERT INTO seller_wallets (id,"sellerId","availableBalance","pendingBalance","totalEarned","totalPaidOut") VALUES ($1,$2,10.20,2.30,12.50,0),($3,$4,99.99,0,99.99,0)`,
        [ids[2], users[0].id, ids[3], users[1].id]
      );
      await paymentsDb.query(
        `INSERT INTO payment_events (id,"userId",type,direction,amount,"platformFee","netAmount",currency,status) VALUES ($1,$2,'donation','incoming',12.30,1,11.30,'USD','completed'),($3,$4,'payout','outgoing',20,0,20,'USD','completed')`,
        [ids[4], users[0].id, ids[5], users[1].id]
      );
      await paymentsDb.query(
        `INSERT INTO offers (id,"classifiedId","buyerId","sellerId","offeredAmount",status,"expiresAt") VALUES ($1,$2,$3,$4,20,'pending','2026-11-23'),($5,$6,$7,$8,30,'accepted','2026-11-23')`,
        [
          ids[6],
          randomUUID(),
          users[0].id,
          users[1].id,
          ids[7],
          randomUUID(),
          users[1].id,
          users[0].id,
        ]
      );
      await paymentsDb.query(
        `INSERT INTO payout_requests (id,"sellerId",amount,status,"payoutMethod") VALUES ($1,$2,10,'pending','paypal'),($3,$4,20,'completed','venmo')`,
        [ids[8], users[0].id, ids[9], users[1].id]
      );
      await paymentsDb.query(
        `INSERT INTO business_pages (id,"communityId","ownerId",name,tier,"subscriptionStatus") VALUES ($1,$2,$3,'Fixture Shop','pro','active'),($4,$5,$6,'Foreign Shop','basic','inactive')`,
        [ids[10], randomUUID(), users[0].id, ids[11], randomUUID(), users[1].id]
      );
      // Seed remaining relationship sources and keep provider configuration out of scope.
      await paymentsDb.query(
        'INSERT INTO business_themes (id,"businessPageId") VALUES ($1,$2)',
        [businessThemeId, ids[10]]
      );
      await paymentsDb.query(
        `INSERT INTO community_sponsorships (id,"communityId","businessPageId","userId",type,amount,status,"startsAt","expiresAt",months) VALUES ($1,$2,$3,$4,'banner',10,'active','2026-10-23','2026-11-23',1)`,
        [sponsorshipId, randomUUID(), ids[10], users[0].id]
      );
      await paymentsDb.query(
        `INSERT INTO lemon_squeezy_products (id,"appScope",tier,"lemonSqueezyProductId",name) VALUES ($1,'local-hub','classified-fee','PRIVATE_PROVIDER_PRODUCT','PRIVATE_PROVIDER_CONFIG')`,
        [productId]
      );
      await paymentsDb.query(
        `UPDATE classified_payments SET "paymentIntentId"='PRIVATE_PAYMENT_INTENT',"proofImageUrl"='https://PRIVATE_PROOF.invalid/private',"disputeReason"='PRIVATE_DISPUTE',"LemonSqueezyOrderId"=$2::uuid WHERE id=ANY($1::uuid[])`,
        [ids.slice(0, 2), providerOrderId]
      );
      await paymentsDb.query(
        `UPDATE seller_wallets SET "payoutEmail"='PRIVATE_PAYOUT@example.test',"bankAccountLast4"='9876' WHERE id=ANY($1::uuid[])`,
        [ids.slice(2, 4)]
      );
      const paymentRows = async () => {
        const result: Record<string, unknown> = {};
        for (const table of [
          'donations',
          'classified_payments',
          'seller_wallets',
          'payment_events',
          'offers',
          'payout_requests',
          'business_pages',
          'business_themes',
          'community_sponsorships',
          'lemon_squeezy_products',
        ])
          result[table] = (
            await paymentsDb.query(
              `SELECT row_to_json(r) AS row FROM "${table}" r ORDER BY id`
            )
          ).rows;
        return result;
      };
      const paymentBefore = await paymentRows();
      const request = {
        accountId: users[0].id,
        token: users[0].token,
        appId: 'client-interface',
        idempotencyKey: randomUUID(),
      };
      report.phase = 'recover-durable-queued-job';
      // Reproduce a process death after the queued ledger commit and before launch.
      clients.auth.close();
      await command('docker', ['stop', '--time', '0', authContainer], {
        timeout: 30000,
      });
      const tokenRow = (
        await authDb.query(
          'SELECT id FROM token WHERE "tokenData"=$1 AND "userId"=$2 AND revoked=false',
          [users[0].token, users[0].id]
        )
      ).rows[0];
      expect(tokenRow?.id).toBeDefined();
      const made = { jobId: randomUUID() };
      jobs.push(made.jobId);
      await authDb.query(
        `INSERT INTO account_export_jobs (id,"accountId","appId",kind,"idempotencyKey",state,"coverageVersion",attempt,"coverageSummary") VALUES ($1,$2,'client-interface','export',$3,'queued',$4,0,$5::jsonb)`,
        [
          made.jobId,
          request.accountId,
          request.idempotencyKey,
          ACCOUNT_EXPORT_RELEASE_COVERAGE_VERSION,
          JSON.stringify({
            privateSessionRef: tokenRow.id,
            artifactAvailable: false,
            blockers: ['not-started'],
            participantCount: 0,
          }),
        ]
      );
      await command('docker', ['start', authContainer], { timeout: 30000 });
      const readyDeadline = Date.now() + 30000;
      for (;;) {
        clients.auth = connect(14801);
        try {
          await rpc(
            clients.auth,
            AuthCommands.GetAccountExportJob,
            { ...request, jobId: made.jobId },
            1500
          );
          break;
        } catch (error) {
          clients.auth.close();
          if (Date.now() >= readyDeadline) throw error;
          await pause(250);
        }
      }
      let job = await pollJob({ ...request, jobId: made.jobId });
      expect(job.attempt).toBe(1);
      report.stage.queuedJobRecoveredAfterProcessRestart = true;
      const expected = [
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
        'payments',
      ];
      expect(job.coverageSummary.capturedDatabaseOwners).toEqual(expected);
      expect(job.coverageSummary.captureCoverage.complete).toBe(true);
      const expectedJobState =
        process.env.A07_EXPECT_COMPLETE === 'true' ? 'complete' : 'incomplete';
      expect(job.state).toBe(expectedJobState);
      if (expectedJobState === 'incomplete') expect(job.artifactUrl).toBeNull();
      else {
        expect(job.artifactUrl).toBe(
          `/api/authentication/account-export/${made.jobId}/download`
        );
        expect(job.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(job.coverageSummary.participantCount).toBe(12);
      }
      expect(JSON.stringify(job)).not.toMatch(
        /privateArtifact|privateSessionRef/
      );
      if (expectedJobState === 'complete') {
        const same = await rpc(
          clients.auth,
          AuthCommands.CreateAccountExportJob,
          request
        );
        const resumed = await rpc(
          clients.auth,
          AuthCommands.ResumeAccountExportJob,
          { ...request, jobId: made.jobId }
        );
        expect(same).toMatchObject({
          jobId: made.jobId,
          attempt: job.attempt,
          state: 'complete',
        });
        expect(resumed).toMatchObject({
          jobId: made.jobId,
          attempt: job.attempt,
          state: 'complete',
          artifactUrl: job.artifactUrl,
        });
      }
      {
        report.phase = 'download-artifact';
        if (expectedJobState === 'complete')
          expect(job.coverageSummary.artifactAvailable).toBe(true);
        const open = await rpc<any>(
          clients.auth,
          AuthCommands.OpenAccountExportDownload,
          { ...request, jobId: made.jobId }
        );
        const internalChunks: Buffer[] = [];
        for (let offset = 0; offset < open.sizeBytes; ) {
          const length = Math.min(65536, open.sizeBytes - offset);
          const page = await rpc<any>(
            clients.auth,
            AuthCommands.ReadAccountExportDownload,
            {
              ...request,
              jobId: made.jobId,
              downloadId: open.downloadId,
              offset,
              length,
            }
          );
          internalChunks.push(Buffer.from(page.bytesBase64, 'base64'));
          offset += length;
        }
        const artifact = Buffer.concat(internalChunks);
        expect(createHash('sha256').update(artifact).digest('hex')).toBe(
          open.sha256
        );
        await rpc(clients.auth, AuthCommands.CloseAccountExportDownload, {
          ...request,
          jobId: made.jobId,
          downloadId: open.downloadId,
        });
        const authHeader = `Bearer ${users[0].token}`;
        const full = await getHttp(
          `/api/authentication/account-export/${made.jobId}/download`,
          { authorization: authHeader, origin: 'http://127.0.0.1:14881' }
        );
        expect(full.status).toBe(200);
        expect(full.body).toEqual(artifact);
        expect(full.headers['content-type']).toContain('application/x-tar');
        expect(full.headers['content-length']).toBe(String(artifact.length));
        expect(full.headers['content-disposition']).toBe(
          'attachment; filename="account-export.tar"'
        );
        expect(full.headers['cache-control']).toBe('private, no-store');
        const cookieRead = await getHttp(
          `/api/authentication/account-export/${made.jobId}/download`,
          {
            cookie: `ot_session=${users[0].token}`,
            origin: 'http://127.0.0.1:14881',
            range: 'bytes=0-15',
          }
        );
        expect(cookieRead.status).toBe(206);
        expect(cookieRead.body).toEqual(artifact.subarray(0, 16));
        const range = await getHttp(
          `/api/authentication/account-export/${made.jobId}/download`,
          {
            authorization: authHeader,
            origin: 'http://127.0.0.1:14881',
            range: 'bytes=10-31',
          }
        );
        expect(range.status).toBe(206);
        expect(range.body).toEqual(artifact.subarray(10, 32));
        expect(
          (
            await getHttp(
              `/api/authentication/account-export/${made.jobId}/download`,
              {
                authorization: `Bearer ${users[1].token}`,
                origin: 'http://127.0.0.1:14881',
              }
            )
          ).status
        ).toBe(403);
        expect(
          (
            await getHttp(
              `/api/authentication/account-export/${made.jobId}/download`,
              { authorization: authHeader, origin: 'http://127.0.0.1:14883' }
            )
          ).status
        ).toBe(401);
        expect(
          (
            await getHttp(
              `/api/authentication/account-export/${made.jobId}/download`,
              { origin: 'http://127.0.0.1:14881' }
            )
          ).status
        ).toBe(401);
        const tar = parseTar(artifact);
        const manifest = JSON.parse(tar.get('manifest.json')!.toString('utf8'));
        expect(manifest.owners).toHaveLength(12);
        for (const owner of manifest.owners) {
          const raw = tar.get(`owners/${owner.owner}.ndjson`)!;
          expect(raw.length).toBe(owner.sizeBytes);
          expect(createHash('sha256').update(raw).digest('hex')).toBe(
            owner.sha256
          );
          const records = raw
            .toString('utf8')
            .trim()
            .split('\n')
            .flatMap((line) => JSON.parse(line).records || []);
          expect(records.length).toBe(owner.rowCount);
          const counts = Object.fromEntries(
            Object.keys(owner.sourceRowCounts).map((key) => [key, 0])
          );
          for (const record of records) {
            expect(counts).toHaveProperty(record.source);
            counts[record.source]++;
          }
          expect(counts).toEqual(owner.sourceRowCounts);
        }
        expect(manifest.media).toHaveLength(4);
        expect(manifest.media.map((m: any) => m.assetId).sort()).toEqual(
          assetIds.slice(0, 4).sort()
        );
        for (const media of manifest.media) {
          const bytes = tar.get(`media/${media.fileName}`)!;
          expect(createHash('sha256').update(bytes).digest('hex')).toBe(
            media.sha256
          );
          if (media.sourceSha256)
            expect(media.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
          expect(bytes.length).toBe(media.sizeBytes);
        }
        const portablePlaylist = tar
          .get(`media/${assetIds[3]}.m3u8`)!
          .toString('utf8');
        expect(portablePlaylist).toContain(`${assetIds[2]}.ts`);
        expect(portablePlaylist).not.toContain('/api/asset/');
        const contents = Buffer.concat([...tar.values()]).toString('utf8');
        const socialPages = tar
          .get('owners/social.ndjson')!
          .toString('utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line));
        const ownPosts = socialPages
          .flatMap((page) => page.records || [])
          .filter((record) => record.source === 'Post');
        expect(
          ownPosts.some(
            (record) =>
              record.data.content ===
              `owned canary <img src="/api/asset/${assetIds[0]}">`
          )
        ).toBe(true);
        expect(tar.get(`media/${assetIds[0]}.png`)).toEqual(png);
        expect(tar.get(`media/${assetIds[1]}.mp4`)).toEqual(mp4);
        expect(tar.get(`media/${assetIds[2]}.ts`)).toEqual(segment);
        expect(contents).not.toContain('foreign counterpart canary');
        expect(contents).not.toContain(users[1].id);
        expect(contents).not.toContain(providerOrderId);
        expect(contents).not.toMatch(
          /PRIVATE_(?:PAYMENT_INTENT|PROOF|DISPUTE|PAYOUT)/
        );
        const temporaryLogin = await rpc(clients.auth, AuthCommands.Login, {
          ...ownerLogin!,
          appId: 'client-interface',
        });
        const temporary = {
          ...request,
          jobId: made.jobId,
          token: temporaryLogin.data.newToken,
        };
        const cap = await rpc(
          clients.auth,
          AuthCommands.OpenAccountExportDownload,
          temporary
        );
        await rpc(clients.auth, AuthCommands.ReadAccountExportDownload, {
          ...temporary,
          downloadId: cap.downloadId,
          offset: 0,
          length: 1,
        });
        await rpc(clients.auth, AuthCommands.Logout, {
          token: temporary.token,
        });
        await expect(
          rpc(clients.auth, AuthCommands.ReadAccountExportDownload, {
            ...temporary,
            downloadId: cap.downloadId,
            offset: 1,
            length: 1,
          })
        ).rejects.toBeDefined();
        expect(
          (
            await getHttp(
              `/api/authentication/account-export/${made.jobId}/download`,
              {
                authorization: `Bearer ${temporary.token}`,
                origin: 'http://127.0.0.1:14881',
              }
            )
          ).status
        ).toBe(401);
        report.stage.revokedDownloadSessionDenied = true;
        report.stage.artifactDownloadAndMedia = true;
        await authDb.query(
          `UPDATE account_export_jobs SET "coverageSummary"=jsonb_set("coverageSummary",'{privateArtifact,expiresAt}',to_jsonb(to_char(clock_timestamp()-interval '1 second','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) WHERE id=$1`,
          [made.jobId]
        );
        expect(
          (
            await getHttp(
              `/api/authentication/account-export/${made.jobId}/download`,
              { authorization: authHeader, origin: 'http://127.0.0.1:14881' }
            )
          ).status
        ).toBeGreaterThanOrEqual(400);
        await waitForArtifactRemoval(
          authDb,
          made.jobId,
          command,
          authContainer
        );
      }
      await paymentsDb.query(
        'UPDATE donations SET "profileId"=$2 WHERE id=$1',
        [donationIds[0], profiles[2]]
      );
      const retryMade = await rpc(
        clients.auth,
        AuthCommands.CreateAccountExportJob,
        { ...request, idempotencyKey: randomUUID() },
        55000
      );
      jobs.push(retryMade.jobId);
      job = await pollJob({ ...request, jobId: retryMade.jobId });
      expect(job.state).toBe('failed');
      expect(job.coverageSummary.capturedDatabaseOwners).toEqual(
        expected.slice(0, 11)
      );
      await paymentsDb.query(
        'UPDATE donations SET "profileId"=$2 WHERE id=$1',
        [donationIds[0], profiles[0]]
      );
      job = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: retryMade.jobId },
        55000
      );
      job = await pollJob({ ...request, jobId: retryMade.jobId });
      expect(job.state).toBe(expectedJobState);
      await expireFixtureJob(authDb, retryMade.jobId);
      await waitForArtifactRemoval(
        authDb,
        retryMade.jobId,
        command,
        authContainer
      );
      const tsLogin = await rpc(clients.auth, AuthCommands.Login, {
        ...ownerLogin!,
        appId: 'local-hub',
      });
      const tsRequest = {
        accountId: users[0].id,
        token: tsLogin.data.newToken,
        appId: 'local-hub',
        idempotencyKey: randomUUID(),
      };
      const tsMade = await rpc(
        clients.auth,
        AuthCommands.CreateAccountExportJob,
        tsRequest,
        55000
      );
      jobs.push(tsMade.jobId);
      const tsStatus = await pollJob({ ...tsRequest, jobId: tsMade.jobId });
      expect(tsStatus.state).toBe(expectedJobState);
      expect(tsStatus.coverageSummary.captureCoverage.complete).toBe(true);
      const tsDownload = await getHttp(
        `/api/authentication/account-export/${tsMade.jobId}/download`,
        {
          authorization: `Bearer ${tsRequest.token}`,
          origin: 'http://127.0.0.1:14883',
        }
      );
      expect(tsDownload.status).toBe(200);
      expect(parseTar(tsDownload.body).has('manifest.json')).toBe(true);
      await expireFixtureJob(authDb, tsMade.jobId);
      await waitForArtifactRemoval(
        authDb,
        tsMade.jobId,
        command,
        authContainer
      );
      report.stage.localHubSessionDownload = true;
      grant = {
        accountId: users[0].id,
        token: users[0].token,
        appId: 'client-interface',
        jobId: retryMade.jobId,
        attempt: job.attempt + 1,
        leaseOwner: randomUUID(),
      };
      await authDb.query(
        'UPDATE account_export_jobs SET state=\'running\',attempt=$2,"leaseOwner"=$3,"leaseExpiresAt"=clock_timestamp()+interval \'5 minutes\' WHERE id=$1',
        [grant.jobId, grant.attempt, grant.leaseOwner]
      );
      parent = await rpc(
        clients.profile,
        ProfileCommands.OpenAccountExportCapture,
        grant,
        55000
      );
      parentHandle = parent.handleId;
      const child = await rpc(
        clients.payments,
        PaymentCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      handleId = child.handleId;
      for (const over of [
        { accountId: users[1].id, token: users[1].token },
        { token: users[1].token },
        { appId: 'forgeofwill' },
        { leaseOwner: randomUUID() },
      ])
        await expect(
          rpc(clients.payments, PaymentCommands.OPEN_ACCOUNT_EXPORT_CAPTURE, {
            ...grant,
            profileSnapshot: parent,
            ...over,
          })
        ).rejects.toBeDefined();
      const chunks: Buffer[] = [];
      for (let offset = 0; offset < child.sizeBytes; ) {
        const length = Math.min(65536, child.sizeBytes - offset),
          page = await rpc(
            clients.payments,
            PaymentCommands.READ_ACCOUNT_EXPORT_CAPTURE,
            { ...grant, handleId, offset, length }
          );
        chunks.push(Buffer.from(page.bytesBase64, 'base64'));
        offset += length;
      }
      const body = Buffer.concat(chunks);
      expect(createHash('sha256').update(body).digest('hex')).toBe(
        child.sha256
      );
      const pages = body
        .toString()
        .trim()
        .split('\n')
        .map((x) => JSON.parse(x));
      const verifier = new AccountExportOwnerCaptureVerifier(
        'payments',
        users[0].id,
        PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
        createHash('sha256')
      );
      expect(pages.map((p) => verifier.accept(p)).at(-1)).toBe(true);
      const records = pages.flatMap((p) => p.records || []);
      expect(child.sourceRowCounts.Donation).toBe(202);
      expect(records.filter((r) => r.source === 'Donation')).toHaveLength(202);
      expect(child.sourceRowCounts.Donation).toBeGreaterThan(200);
      const json = JSON.stringify(records);
      expect(json).not.toContain(users[1].id);
      expect(json).not.toContain('lemonSqueezy');
      expect(json).not.toContain('proofImageUrl');
      expect(json).not.toContain('disputeReason');
      expect(records.some((r) => r.data.amount === '99999999.99')).toBe(true);
      expect(json).not.toContain('PRIVATE_');
      expect(json).not.toContain(providerOrderId);
      expect(
        records.find((r) => r.source === 'Donation')?.data.createdAt
      ).toContain('.123456Z');
      expect(child.sourceRowCounts.LemonSqueezyProduct).toBe(0);
      expect(await paymentRows()).toEqual(paymentBefore);
      report.stage = {
        ...report.stage,
        capturedOwners: expected,
        invalidProfileFailure: true,
        retryComplete: true,
        checksum: true,
        terminalVerifier: true,
        pagination: true,
        privacy: true,
      };
      const staleHandle = handleId;
      await clients.payments.close();
      await command('docker', ['restart', paymentsContainer], {
        timeout: 120000,
      });
      report.phase = 'restart-rpc-readiness';
      const deadline = Date.now() + 60000;
      for (;;) {
        clients.payments = connect(14804);
        try {
          await rpc(
            clients.payments,
            PaymentCommands.GET_DONATION_GOAL,
            {},
            2000
          );
          break;
        } catch {
          await clients.payments.close();
          if (Date.now() > deadline)
            throw new Error('Payments RPC readiness deadline');
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      report.phase = 'stale-handle-after-restart';
      await expect(
        rpc(
          clients.payments,
          PaymentCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          { ...grant, handleId: staleHandle, offset: 0, length: 1 },
          2000
        )
      ).rejects.toBeDefined();
      report.phase = 'fresh-capture-after-restart';
      const fresh = await rpc(
        clients.payments,
        PaymentCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
        { ...grant, profileSnapshot: parent },
        55000
      );
      handleId = fresh.handleId;
      expect(handleId).not.toBe(staleHandle);
      await rpc(clients.payments, PaymentCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
        ...grant,
        handleId,
        offset: 0,
        length: 1,
      });
      report.phase = 'session-revocation';
      await rpc(clients.auth, AuthCommands.Logout, { token: users[0].token });
      users[0].token = '';
      await expect(
        rpc(clients.payments, PaymentCommands.READ_ACCOUNT_EXPORT_CAPTURE, {
          ...grant,
          handleId,
          offset: 0,
          length: 1,
        })
      ).rejects.toBeDefined();
      report.stage.restartInvalidatedHandle = true;
      report.stage.revokedSessionDenied = true;
    } catch (e) {
      report.failedPhase = report.phase;
      failure = e;
    } finally {
      const attempt = async (work: () => Promise<unknown>) => {
        try {
          await work();
        } catch (e) {
          failure ??= e;
        }
      };
      if (users.length) {
        await attempt(async () => {
          const rows = await authDb.query(
            'SELECT id FROM account_export_jobs WHERE "accountId"=ANY($1::uuid[])',
            [users.map((user) => user.id)]
          );
          for (const row of rows.rows)
            if (!jobs.includes(row.id)) jobs.push(row.id);
        });
      }
      if (jobs.length) {
        await attempt(() =>
          authDb.query(
            `UPDATE account_export_jobs SET state='failed',"leaseOwner"=NULL,"leaseExpiresAt"=NULL WHERE id=ANY($1::uuid[]) AND state='running'`,
            [jobs]
          )
        );
        for (const id of jobs)
          await attempt(() => expireFixtureJob(authDb, id));
        for (const id of jobs)
          await attempt(() =>
            waitForArtifactRemoval(authDb, id, command, authContainer)
          );
      }
      await attempt(() =>
        socialDb.query('DELETE FROM post WHERE id=ANY($1::uuid[])', [
          socialPostIds,
        ])
      );
      await attempt(() =>
        assetsDb.query('DELETE FROM asset_entity WHERE id=ANY($1::uuid[])', [
          assetIds,
        ])
      );
      for (const id of assetIds)
        await attempt(async () => {
          rmSync(join(mediaStorageDir, `${id}.bin`), { force: true });
        });
      if (handleId && grant)
        await attempt(() =>
          rpc(
            clients.payments,
            PaymentCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
            { ...grant!, handleId }
          )
        );
      if (parentHandle && grant)
        await attempt(() =>
          rpc(clients.profile, ProfileCommands.ReleaseAccountExportCapture, {
            ...grant!,
            handleId: parentHandle,
          })
        );
      for (const u of users)
        if (u.token)
          await attempt(() =>
            rpc(clients.auth, AuthCommands.Logout, { token: u.token })
          );
      await attempt(() =>
        paymentsDb.query('DELETE FROM community_sponsorships WHERE id=$1', [
          sponsorshipId,
        ])
      );
      await attempt(() =>
        paymentsDb.query('DELETE FROM business_themes WHERE id=$1', [
          businessThemeId,
        ])
      );
      await attempt(() =>
        paymentsDb.query(
          'DELETE FROM business_pages WHERE id=ANY($1::uuid[])',
          [ids.slice(10, 12)]
        )
      );
      await attempt(() =>
        paymentsDb.query(
          'DELETE FROM payout_requests WHERE id=ANY($1::uuid[])',
          [ids.slice(8, 10)]
        )
      );
      await attempt(() =>
        paymentsDb.query('DELETE FROM offers WHERE id=ANY($1::uuid[])', [
          ids.slice(6, 8),
        ])
      );
      await attempt(() =>
        paymentsDb.query(
          'DELETE FROM payment_events WHERE id=ANY($1::uuid[])',
          [ids.slice(4, 6)]
        )
      );
      await attempt(() =>
        paymentsDb.query(
          'DELETE FROM seller_wallets WHERE id=ANY($1::uuid[])',
          [ids.slice(2, 4)]
        )
      );
      await attempt(() =>
        paymentsDb.query(
          'DELETE FROM classified_payments WHERE id=ANY($1::uuid[])',
          [ids.slice(0, 2)]
        )
      );
      await attempt(() =>
        paymentsDb.query('DELETE FROM lemon_squeezy_products WHERE id=$1', [
          productId,
        ])
      );
      await attempt(() =>
        paymentsDb.query(
          'DELETE FROM donations WHERE "userId"=ANY($1::uuid[])',
          [users.map((u) => u.id)]
        )
      );
      await attempt(() =>
        profileDb.query('DELETE FROM profile WHERE id=ANY($1::uuid[])', [
          profiles,
        ])
      );
      await attempt(() =>
        authDb.query(
          'DELETE FROM account_export_jobs WHERE id=ANY($1::uuid[])',
          [jobs]
        )
      );
      const userIds = users.map((u) => u.id);
      if (userIds.length) {
        await attempt(() =>
          authDb.query('DELETE FROM token WHERE "userId"=ANY($1::uuid[])', [
            userIds,
          ])
        );
        const keyRows = await authDb
          .query(
            'SELECT "keyDataId" FROM user_entity WHERE id=ANY($1::uuid[])',
            [userIds]
          )
          .catch((e) => {
            failure ??= e;
            return { rows: [] };
          });
        const keys = keyRows.rows.map((r: any) => r.keyDataId).filter(Boolean);
        await attempt(() =>
          authDb.query(
            'UPDATE user_entity SET "keyDataId"=NULL WHERE id=ANY($1::uuid[])',
            [userIds]
          )
        );
        if (keys.length)
          await attempt(() =>
            authDb.query(
              'UPDATE key_datum SET "userId"=NULL WHERE id=ANY($1::uuid[])',
              [keys]
            )
          );
        await attempt(() =>
          authDb.query('DELETE FROM user_entity WHERE id=ANY($1::uuid[])', [
            userIds,
          ])
        );
        if (keys.length)
          await attempt(() =>
            authDb.query('DELETE FROM key_datum WHERE id=ANY($1::uuid[])', [
              keys,
            ])
          );
      }
      if (baseline) {
        report.cleanup.countsBefore = baseline;
        report.cleanup.countsAfter = await counts().catch((e) => {
          failure ??= e;
          return {};
        });
        report.cleanup.countsRestored =
          JSON.stringify(report.cleanup.countsAfter) ===
          JSON.stringify(baseline);
        if (!report.cleanup.countsRestored)
          failure ??= new Error('Payments fixture table counts differ');
      }
      report.cleanup.complete = !failure;
      report.result = failure ? 'FAIL' : 'PASS';
      report.mockedCapabilities = [];
      try {
        writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
      } catch (e) {
        failure ??= e;
      }
      await Promise.all(databases.map((db) => db.end().catch(() => undefined)));
      await Promise.all(
        Object.values(clients).map((c) =>
          Promise.resolve()
            .then(() => c.close())
            .catch(() => undefined)
        )
      );
    }
    if (failure) throw failure;
  }, 480000);
});

function parseTar(bytes: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  for (let offset = 0; offset + 512 <= bytes.length; ) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const checksum = Buffer.from(header);
    checksum.fill(32, 148, 156);
    expect([...checksum].reduce((sum, value) => sum + value, 0)).toBe(
      parseInt(header.toString('ascii', 148, 154), 8)
    );
    const name = header.toString('ascii', 0, 100).replace(/\0.*$/, '');
    expect(name).not.toMatch(/(^\/|\.\.|\\)/);
    const size = parseInt(
      header.toString('ascii', 124, 135).replace(/\0.*$/, ''),
      8
    );
    expect(Number.isSafeInteger(size) && size >= 0).toBe(true);
    expect(offset + 512 + size).toBeLessThanOrEqual(bytes.length);
    expect(entries.has(name)).toBe(false);
    entries.set(
      name,
      Buffer.from(bytes.subarray(offset + 512, offset + 512 + size))
    );
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}
async function expireFixtureJob(db: PgClient, id: string) {
  await db.query(
    `UPDATE account_export_jobs SET "coverageSummary"=jsonb_set("coverageSummary",'{privateArtifact,expiresAt}',to_jsonb(to_char(clock_timestamp()-interval '1 second','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) WHERE id=$1`,
    [id]
  );
}
async function waitForArtifactRemoval(
  db: PgClient,
  id: string,
  command: any,
  container: string
) {
  const deadline = Date.now() + 75000;
  while (Date.now() < deadline) {
    const row = (
      await db.query(
        `SELECT "coverageSummary" FROM account_export_jobs WHERE id=$1`,
        [id]
      )
    ).rows[0];
    if (!row.coverageSummary.privateArtifact) {
      const files = JSON.parse(
        (
          await command(
            'docker',
            [
              'exec',
              container,
              'node',
              '-e',
              'process.stdout.write(JSON.stringify(require("node:fs").readdirSync("/tmp/ot-account-export-artifacts")))',
            ],
            { timeout: 10000 }
          )
        ).stdout
      );
      if (files.length === 0) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Artifact expiry and independent byte-removal deadline');
}
