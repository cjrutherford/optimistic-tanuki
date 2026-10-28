/** Optional real-process R2 proof inside the guarded D27 disposable fixture. */
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { AccountDeletionOwner } from '@optimistic-tanuki/models';
interface Options {
  settings: {
    root: string;
    base: { jwtSecret: string };
    gateways: Array<{ host: string; port: number }>;
  };
  dbs: Map<AccountDeletionOwner, DataSource>;
  workers: Array<{
    config: { owner: AccountDeletionOwner; privateRoot: string };
    request(type: string): Promise<any>;
  }>;
  auth: ClientProxy;
  authReplica: ClientProxy;
  account: string;
  profile: string;
  profile2: string;
  other: string;
  otherProfile: string;
  ids: Record<string, string>;
  tokens: Record<string, string>;
}
export async function verifyR2Runtime(o: Options) {
  if (
    process.env['R2_RETENTION_CONTROLS'] !== '1' ||
    process.env['D27_LIVE_FIXTURE'] !== 'private-d27-otts-v1'
  )
    throw Error('R2_PRIVATE_FIXTURE_REQUIRED');
  const db = o.dbs.get('authentication')!;
  const call = (client: ClientProxy, cmd: string, input: unknown) =>
    firstValueFrom(client.send({ cmd }, input).pipe(timeout(90000)));
  const worker = o.workers.find((w) =>
    w.config.privateRoot.endsWith('auth-primary')
  )!;
  const old = await o.dbs
    .get('social')!
    .query('SELECT count(*)::text AS n FROM activity WHERE id=$1::uuid', [
      o.ids['r2OldActivity'],
    ]);
  expect(old[0].n).toBe('0'); // persisted before both Social replicas started, not an explicit manual sweep
  const jwt = new JwtService({ secret: o.settings.base.jwtSecret });
  const request = async (
    token: string,
    app: string,
    index: number,
    cookie = true
  ) =>
    fetch(
      `http://127.0.0.1:${o.settings.gateways[index].port}/api/authentication/session`,
      {
        headers: {
          'x-ot-appscope': app,
          Origin: `http://127.0.0.1:${
            app === 'client-interface' ? 19080 : 19081
          }`,
          ...(cookie
            ? { Cookie: `ot_session=${token}` }
            : { Authorization: `Bearer ${token}` }),
        },
        signal: AbortSignal.timeout(15000),
      }
    );
  const now = Math.floor(Date.now() / 1000);
  const checks: string[] = [
    'cold-start persisted log cleanup across Social replicas',
  ];
  for (const [app, p, index] of [
    ['client-interface', o.profile2, 0],
    ['local-hub', o.profile, 1],
  ] as const) {
    const id = randomUUID();
    const token = jwt.sign({
      userId: o.account,
      profileId: p,
      appId: app,
      iat: now - 100 * 86400,
      exp: now - 99 * 86400,
      jti: id,
    });
    await db.query(
      'INSERT INTO token (id,"userId","profileId","tokenData",revoked,"lastActivityAt") VALUES ($1,$2,$3,$4,false,clock_timestamp()-interval \'1 day\')',
      [id, o.account, p, token]
    );
    expect(
      (
        await call(o.authReplica, AuthCommands.Validate, {
          token,
          userId: o.account,
          appId: app,
        })
      ).isValid
    ).toBe(true);
    const response = await request(token, app, index);
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/Max-Age=604800/);
    const body = await response.json();
    expect(Date.parse(body.data.sessionExpiresAt) - Date.now()).toBeGreaterThan(
      6.99 * 86400000
    );
    expect(
      (await request(token, app, index, false)).headers.get('set-cookie')
    ).toBeNull();
    // A new legacy token with no persisted activity is judged by signed iat, never migration time.
    await db.query('UPDATE token SET "lastActivityAt"=NULL WHERE id=$1', [id]);
    expect((await request(token, app, index)).status).toBe(401);
    await db.query(
      'UPDATE token SET "lastActivityAt"=clock_timestamp()-interval \'7 days\' WHERE id=$1',
      [id]
    );
    expect((await request(token, app, index)).status).toBe(401);
    // Explicit observer fixture setup, not a product refresh of an expired session.
    await db.query(
      'UPDATE token SET "lastActivityAt"=clock_timestamp(),revoked=true WHERE id=$1',
      [id]
    );
    for (const endpoint of [o.auth, o.authReplica]) {
      const result = await call(endpoint, AuthCommands.Validate, {
        token,
        userId: o.account,
        appId: app,
      }).catch(() => ({ isValid: false }));
      expect(result.isValid).toBe(false);
    }
    expect((await request(token, app, index)).status).toBe(401);
    checks.push(
      `${app}: 100-day issued session, rolling cookie, exact idle boundary, legacy expiry, replica revocation`
    );
  }
  const session = o.ids['otherSession'];
  await db.query(
    'UPDATE token SET "lastActivityAt"=clock_timestamp()-interval \'6 days\' WHERE id=$1',
    [session]
  );
  const before = (
    await db.query(
      'SELECT "lastActivityAt"::text AS activity FROM token WHERE id=$1',
      [session]
    )
  )[0].activity;
  const job = await call(o.auth, AuthCommands.CreateAccountExportJob, {
    accountId: o.other,
    appId: 'local-hub',
    token: o.tokens['other'],
    idempotencyKey: randomUUID(),
  });
  const deadline = Date.now() + 90000;
  let status = job;
  while (
    ['queued', 'running'].includes(status.state) &&
    Date.now() < deadline
  ) {
    await new Promise((done) => setTimeout(done, 100));
    status = await call(o.auth, AuthCommands.GetAccountExportJob, {
      accountId: o.other,
      appId: 'local-hub',
      token: o.tokens['other'],
      jobId: job.jobId,
    });
  }
  expect(status.state).toBe('complete');
  expect(
    (
      await db.query(
        'SELECT "lastActivityAt"::text AS activity FROM token WHERE id=$1',
        [session]
      )
    )[0].activity
  ).toBe(before);
  checks.push(
    'real twelve-owner export and job polling do not extend inactivity'
  );
  // Synthetic terminal receipts exercise pruning separately from live artifact custody.
  const clean = randomUUID(),
    intent = randomUUID();
  for (const [id, summary] of [
    [clean, {}],
    [
      intent,
      {
        artifactState: 'cleanup-pending',
        privateArtifact: { unresolved: true },
      },
    ],
  ] as const)
    await db.query(
      `INSERT INTO account_export_jobs (id,"accountId","appId",kind,"idempotencyKey",state,"coverageSummary","completedAt","createdAt","updatedAt") VALUES ($1,$2,'local-hub','export',$3,'failed',$4::jsonb,clock_timestamp()-interval '91 days',clock_timestamp()-interval '91 days',clock_timestamp()-interval '91 days')`,
      [id, o.account, randomUUID(), JSON.stringify(summary)]
    );
  await worker.request('history-prune');
  expect(
    (
      await db.query(
        'SELECT count(*)::text AS n FROM account_export_jobs WHERE id=$1',
        [clean]
      )
    )[0].n
  ).toBe('0');
  expect(
    (
      await db.query(
        'SELECT count(*)::text AS n FROM account_export_jobs WHERE id=$1',
        [intent]
      )
    )[0].n
  ).toBe('1');
  expect((await worker.request('retention-status')).state).toBe('pending');
  // Remove only the deliberately malformed test receipt; never assert its fake descriptor was purged.
  await db.query('DELETE FROM account_export_jobs WHERE id=$1', [intent]);
  const notice = randomUUID();
  await db.query(
    `INSERT INTO guardian_policy_notice (id,"policyVersion","policyUrl","guardianUserId",status,"nextAttemptAt","createdAt","updatedAt") VALUES ($1,$2,'https://example.test/policy',$3,'accepted',clock_timestamp(),clock_timestamp()-interval '91 days',clock_timestamp())`,
    [notice, randomUUID(), o.account]
  );
  await worker.request('retention-sweep');
  expect(
    (
      await db.query(
        'SELECT count(*)::text AS n FROM guardian_policy_notice WHERE id=$1',
        [notice]
      )
    )[0].n
  ).toBe('0');
  const shared = await worker.request('retention-status');
  expect(shared.state).toBe('verified');
  expect(shared.owners).toHaveLength(5);
  expect(
    shared.owners.reduce((sum: number, r: any) => sum + r.sources.length, 0)
  ).toBe(10);
  expect(shared.jobHistory.remaining).toBe(0);
  checks.push(
    'eleven history sources reconciled; unresolved artifact intent retained and reported pending'
  );
  await writeFile(
    join(o.settings.root, 'r2-retention-runtime.json'),
    JSON.stringify(
      {
        scope: ['client-interface', 'local-hub'],
        checks,
        sharedStatus: shared,
        requiresFollowingD27DeletionProof: true,
      },
      null,
      2
    ),
    { mode: 0o600 }
  );
}

/** Re-run real sweepers after finalization, then independently deny late activity. */
export async function verifyR2AfterDeletion(o: {
  root: string;
  workers: Array<{
    config: { owner: string };
    request(type: string): Promise<any>;
  }>;
  rootWorker: { request(type: string): Promise<any> };
  auth: ClientProxy;
  authReplica: ClientProxy;
  account: string;
  tokens: Record<string, string>;
  database: DataSource;
}) {
  const owners = new Set([
    'authentication',
    'profile',
    'assets',
    'social',
    'forum',
  ]);
  const reports = await Promise.all(
    o.workers
      .filter((w) => owners.has(w.config.owner))
      .map((w) => w.request('retention-sweep'))
  );
  expect(reports.length).toBe(7); // five owner primaries plus live Auth/Social replicas
  for (const r of reports) expect(r.state).toBe('verified');
  expect((await o.rootWorker.request('retention-status')).state).toBe(
    'verified'
  );
  for (const client of [o.auth, o.authReplica])
    for (const [key, appId] of [
      ['ownTs', 'local-hub'],
      ['ownOt', 'client-interface'],
    ])
      await expect(
        firstValueFrom(
          client
            .send(
              { cmd: AuthCommands.Validate },
              { token: o.tokens[key], userId: o.account, appId, activity: true }
            )
            .pipe(timeout(15000))
        )
      ).rejects.toBeTruthy();
  expect(
    (
      await o.database.query(
        'SELECT count(*)::text AS n FROM token WHERE "userId"=$1::uuid',
        [o.account]
      )
    )[0].n
  ).toBe('0');
  const { readFile } = await import('node:fs/promises');
  const path = join(o.root, 'r2-retention-runtime.json');
  const report = JSON.parse(await readFile(path, 'utf8'));
  report.postDeletion = {
    liveSweeperProcesses: reports.length,
    sharedStatus: 'verified',
    lateActivityDeniedAcrossAuthReplicas: true,
    tokenRowsRemaining: 0,
  };
  await writeFile(path, JSON.stringify(report, null, 2), { mode: 0o600 });
}
