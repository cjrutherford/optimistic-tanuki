import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Client as PgClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AuthCommands,
  ProfileCommands,
  PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/constants';
import { PaymentCommands } from '@optimistic-tanuki/payments-contracts';
import {
  AccountExportCaptureGrant,
  AccountExportOwnerCaptureVerifier,
  AccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

describe('Payments account export private TCP integration', () => {
  it('captures registered Payments sources under a leased profile snapshot and fences stale access', async () => {
    if (
      process.env.PAYMENTS_JOB_E2E_MARKER !== 'private-payments-a01-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_MARKER !==
        'auth-profile-payments-export-fixture-v1' ||
      process.env.ACCOUNT_EXPORT_E2E_DB_HOST !== '127.0.0.1' ||
      process.env.E2E_DB_PORT !== '15560' ||
      process.env.AUTH_AUTO_VERIFY_EMAILS !== 'true'
    )
      throw Error('Private Payments A01 fixture required');
    const reportPath = process.env.PAYMENTS_JOB_E2E_REPORT_PATH,
      container = process.env.PAYMENTS_JOB_E2E_CONTAINER_ID || '';
    if (!reportPath || !/^[a-f0-9]{64}$/.test(container))
      throw Error('Private Payments report and target required');
    const command = promisify(execFile);
    const inspected = JSON.parse(
      (await command('docker', ['inspect', container], { timeout: 10000 }))
        .stdout
    )[0];
    for (const [key, value] of Object.entries({
      'com.docker.compose.project': 'ot-df007-payments-integration',
      'com.docker.compose.service': 'payments',
      'io.optimistic-tanuki.account-rights.private-project':
        'ot-df007-payments-integration',
    }))
      expect(inspected.Config.Labels[key]).toBe(value);
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
    const users: { id: string; token: string }[] = [];
    const profiles = Array.from({ length: 3 }, () => randomUUID());
    const ids = Array.from({ length: 12 }, () => randomUUID());
    const donationIds = Array.from({ length: 205 }, () => randomUUID());
    const productId = randomUUID();
    const providerOrderId = randomUUID();
    const jobs: string[] = [];
    let businessThemeId = randomUUID(),
      sponsorshipId = randomUUID();
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
      for (const label of ['owner', 'counterpart']) {
        const email = `payments-a01-${label}-${randomUUID().slice(
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
      const made = await rpc(
        clients.auth,
        AuthCommands.CreateAccountExportJob,
        request,
        55000
      );
      jobs.push(made.jobId);
      let job = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: made.jobId },
        55000
      );
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
      expect(job.state).toBe('incomplete');
      expect(job.artifactUrl).toBeNull();
      await paymentsDb.query(
        'UPDATE donations SET "profileId"=$2 WHERE id=$1',
        [donationIds[0], profiles[2]]
      );
      job = await rpc(
        clients.auth,
        AuthCommands.ResumeAccountExportJob,
        { ...request, jobId: made.jobId },
        55000
      );
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
        { ...request, jobId: made.jobId },
        55000
      );
      expect(job.state).toBe('incomplete');
      grant = {
        accountId: users[0].id,
        token: users[0].token,
        appId: 'client-interface',
        jobId: made.jobId,
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
      await command('docker', ['restart', container], { timeout: 120000 });
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
  }, 180000);
});
