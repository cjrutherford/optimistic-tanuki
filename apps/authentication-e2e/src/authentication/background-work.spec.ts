import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { Client as PgClient } from 'pg';
import { firstValueFrom, timeout } from 'rxjs';
import { fork, ChildProcess, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

it('N01 proves OT/TS cancellation, real storage crash recovery and provider-acceptance boundaries', async () => {
  if (
    process.env.N01_PRIVATE_MARKER !== 'private-n01-otts-v1' ||
    process.env.E2E_DB_PORT !== '15561' ||
    process.env.HOST !== '127.0.0.1' ||
    process.env.PORT !== '14901'
  )
    throw new Error('PRIVATE_N01_FIXTURE_REQUIRED');
  const command = promisify(execFile);
  const dbContainer = process.env.N01_DB_CONTAINER_ID || '';
  if (!/^[a-f0-9]{64}$/.test(dbContainer))
    throw new Error('PRIVATE_N01_CONTAINER_REQUIRED');
  const inspect = JSON.parse(
    (await command('docker', ['inspect', dbContainer], { timeout: 10000 }))
      .stdout
  )[0];
  expect(inspect.Config.Labels['com.docker.compose.project']).toBe(
    'ot-df007-n01-background'
  );
  const reportPath = process.env.N01_REPORT_PATH || '';
  const storageRoot = process.env.N01_STORAGE_ROOT || '';
  if (
    !reportPath ||
    !storageRoot.startsWith(
      path.join(
        process.cwd(),
        '.runtime-artifacts/account-rights/finish-sequence/background-work/runtime/storage/'
      )
    )
  )
    throw new Error('PRIVATE_N01_PATHS_REQUIRED');
  const names = ['authentication', 'assets', 'social', 'profile'];
  const dbs = names.map(
    (name) =>
      new PgClient({
        host: '127.0.0.1',
        port: 15561,
        user: 'postgres',
        password: 'postgres',
        database: 'ot_' + name,
      })
  );
  const [authDb, assetsDb, socialDb, profileDb] = dbs;
  const authClient = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 14901 },
  });
  const rpc = (cmd: string, payload: any) =>
    firstValueFrom(
      authClient.send({ cmd }, payload).pipe(timeout({ first: 10000 }))
    );
  const users: Array<{ id: string; token: string }> = [];
  const profiles = [randomUUID(), randomUUID()];
  const jobs: string[] = [];
  const notices: string[] = [];
  const permissions: string[] = [];
  const workers: Array<{
    child: ChildProcess;
    call: (op: string, data?: any) => Promise<any>;
    event: (name: string) => Promise<any>;
  }> = [];
  const pendingResponses: any[] = [];
  let providerCalls = 0;
  let providerIncoming: (() => void) | undefined;
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    req.resume();
    providerCalls++;
    pendingResponses.push(res);
    providerIncoming?.();
    providerIncoming = undefined;
  });
  const report: any = {
    result: 'RUNNING',
    slice: 'N01',
    applications: ['client-interface', 'local-hub'],
    controlledBoundaries: [
      'clean-antivirus-result',
      'post-write/compensation faults',
      'local HTTP provider response timing',
    ],
    stages: {},
    cleanup: {},
  };
  let baseline: any;
  let failure: unknown;
  const counts = async () => {
    const result: any = {};
    for (let i = 0; i < dbs.length; i++) {
      const tables = (
        await dbs[i].query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
        )
      ).rows;
      result[names[i]] = {};
      for (const t of tables)
        result[names[i]][t.table_name] = (
          await dbs[i].query(
            `SELECT count(*)::text AS count FROM "${t.table_name}"`
          )
        ).rows[0].count;
    }
    return result;
  };
  const until = async (test: () => Promise<boolean>, label: string) => {
    const end = Date.now() + 10000;
    while (!(await test())) {
      if (Date.now() > end) throw new Error('N01_WAIT_' + label);
      await new Promise((done) => setTimeout(done, 25));
    }
  };
  const spawnWorker = async () => {
    const child = fork(path.join(__dirname, 'n01-runtime.worker.ts'), [], {
      execArgv: [
        '-r',
        'ts-node/register/transpile-only',
        '-r',
        'tsconfig-paths/register',
      ],
      env: {
        ...process.env,
        TS_NODE_PROJECT: path.join(
          process.cwd(),
          'apps/assets/tsconfig.app.json'
        ),
        VAULT_STORAGE_KEK: 'N01-private-fixture-storage-key',
        VAULT_STORAGE_ZFS_REQUIRED: 'false',
        N01_PROVIDER_URL: 'http://127.0.0.1:14990/',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let seq = 0;
    const requests = new Map<
      string,
      {
        resolve: (v: any) => void;
        reject: (e: unknown) => void;
        timer: NodeJS.Timeout;
      }
    >();
    const events = new Map<string, any[]>();
    const eventWaiters = new Map<string, Array<(v: any) => void>>();
    child.stdout?.resume();
    child.stderr?.resume();
    child.on('exit', () => {
      for (const value of requests.values()) {
        clearTimeout(value.timer);
        value.reject(new Error('N01_WORKER_EXIT'));
      }
      requests.clear();
    });
    child.on('message', (msg: any) => {
      if (msg.requestId) {
        const pending = requests.get(msg.requestId);
        if (!pending) return;
        clearTimeout(pending.timer);
        requests.delete(msg.requestId);
        if (msg.error) pending.reject(new Error(msg.error.code));
        else pending.resolve(msg.value);
      } else if (msg.event) {
        const wait = eventWaiters.get(msg.event)?.shift();
        if (wait) wait(msg);
        else events.set(msg.event, [...(events.get(msg.event) || []), msg]);
      }
    });
    const event = (name: string): Promise<any> => {
      const ready = events.get(name)?.shift();
      if (ready) return Promise.resolve(ready);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('N01_WORKER_EVENT_' + name)),
          20000
        );
        eventWaiters.set(name, [
          ...(eventWaiters.get(name) || []),
          (v: any) => {
            clearTimeout(timer);
            resolve(v);
          },
        ]);
      });
    };
    const call = (op: string, data: any = {}): Promise<any> =>
      new Promise((resolve, reject) => {
        const requestId = String(++seq);
        const timer = setTimeout(() => {
          requests.delete(requestId);
          reject(new Error('N01_WORKER_TIMEOUT_' + op));
        }, 35000);
        requests.set(requestId, { resolve, reject, timer });
        child.send({ requestId, op, data });
      });
    const worker = { child, call, event };
    workers.push(worker);
    await Promise.race([
      event('ready'),
      event('startup-failed').then(() => {
        throw new Error('N01_WORKER_STARTUP_FAILED');
      }),
    ]);
    return worker;
  };
  const kill = async (worker: (typeof workers)[number]) => {
    if (worker.child.exitCode !== null || worker.child.signalCode) return;
    await new Promise<void>((done) => {
      worker.child.once('exit', () => done());
      worker.child.kill('SIGKILL');
    });
  };
  try {
    await Promise.all(dbs.map((db) => db.connect()));
    await authClient.connect();
    baseline = await counts();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(14990, '127.0.0.1', resolve);
    });
    for (const label of ['owner', 'counterpart']) {
      const email = `n01-${label}-${randomUUID()}@example.test`;
      const password = 'N01-private-fixture!123';
      const registered: any = await rpc(AuthCommands.Register, {
        email,
        fn: 'N01',
        ln: label,
        password,
        confirm: password,
        ageEligibilityStatus: 'adult',
      });
      users.push({ id: registered.data.user.id, token: '' });
      const login: any = await rpc(AuthCommands.Login, {
        email,
        password,
        appId: 'client-interface',
      });
      users.at(-1)!.token = login.data.newToken;
    }
    await profileDb.query(
      `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'client-interface','N01 OT','','','','','','',''),($3,$2,'local-hub','N01 TS','','','','','','','')`,
      [profiles[0], users[0].id, profiles[1]]
    );
    let worker = await spawnWorker();
    const cleaner = await spawnWorker();
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCDsAAAAASUVORK5CYII=';
    for (const profileId of profiles) {
      const asset = await worker.call('asset-create', {
        name: 'n01-success',
        profileId,
        bytes: png,
      });
      await worker.event('asset-written');
      expect(asset).toMatchObject({
        lifecycleState: 'active',
        profileId,
        originKind: 'ordinary',
        originProfileId: null,
        originAppId: null,
      });
      expect(await worker.call('asset-read', asset)).toBe(
        `data:image/png;base64,${png}`
      );
      await worker.call('asset-remove', asset);
    }
    report.stages.bothScopedProfileUploads = true;
    await assetsDb.query(
      `CREATE FUNCTION n01_asset_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name LIKE 'n01-db-failure%' AND NEW."lifecycleState"='active' THEN RAISE EXCEPTION 'N01_INJECTED_ACTIVATION_FAILURE'; END IF; IF TG_OP='INSERT' AND NEW.name LIKE 'n01-expire%' THEN NEW."lifecycleLeaseUntil"=clock_timestamp()+interval '600 milliseconds'; END IF; RETURN NEW; END $$`
    );
    await assetsDb.query(
      'CREATE TRIGGER n01_asset_fault BEFORE INSERT OR UPDATE ON asset_entity FOR EACH ROW EXECUTE FUNCTION n01_asset_fault()'
    );
    await expect(
      worker.call('asset-create', {
        name: 'n01-db-failure',
        profileId: profiles[0],
        bytes: png,
      })
    ).rejects.toBeDefined();
    await worker.event('asset-written');
    expect(
      (await assetsDb.query('SELECT count(*)::int AS n FROM asset_entity'))
        .rows[0].n
    ).toBe(0);
    const expiryCall = worker.call('asset-create', {
      name: 'n01-expire',
      profileId: profiles[0],
      bytes: png,
      fault: 'blocked',
    });
    const late = await worker.event('asset-written');
    await until(
      async () =>
        (
          await assetsDb.query(
            'SELECT "lifecycleLeaseUntil"<clock_timestamp() AS expired FROM asset_entity WHERE id=$1',
            [late.id]
          )
        ).rows[0]?.expired === true,
      'lease-expiry'
    );
    expect(await cleaner.call('asset-cleanup')).toBe(0);
    await worker.call('asset-release');
    await expect(expiryCall).rejects.toBeDefined();
    expect(
      (await assetsDb.query('SELECT count(*)::int AS n FROM asset_entity'))
        .rows[0].n
    ).toBe(0);
    const failComp = worker.call('asset-create', {
      name: 'n01-db-failure',
      profileId: profiles[1],
      bytes: png,
      fault: 'remove-failed',
    });
    const retained = await worker.event('asset-written');
    await worker.call('asset-release');
    await expect(failComp).rejects.toBeDefined();
    expect(
      (
        await assetsDb.query(
          'SELECT "lifecycleState" FROM asset_entity WHERE id=$1',
          [retained.id]
        )
      ).rows[0].lifecycleState
    ).toBe('pending-upload');
    await assetsDb.query(
      'UPDATE asset_entity SET "lifecycleLeaseUntil"=clock_timestamp()-interval \'1 second\' WHERE id=$1',
      [retained.id]
    );
    await cleaner.call('asset-cleanup');
    const crashedCall = worker.call('asset-create', {
      name: 'n01-process-crash',
      profileId: profiles[1],
      bytes: png,
      fault: 'blocked',
    });
    void crashedCall.catch(() => undefined);
    const crashed = await worker.event('asset-written');
    await kill(worker);
    await assetsDb.query(
      'UPDATE asset_entity SET "lifecycleLeaseUntil"=clock_timestamp()-interval \'1 second\' WHERE id=$1',
      [crashed.id]
    );
    worker = await spawnWorker();
    await worker.call('asset-startup');
    await until(
      async () =>
        (
          await assetsDb.query('SELECT count(*)::int AS n FROM asset_entity')
        ).rows[0].n === 0,
      'startup-reclaim'
    );
    expect(
      await fs
        .stat(path.join(storageRoot, crashed.storagePath))
        .then(() => true)
        .catch(() => false)
    ).toBe(false);
    report.stages.assetReservationCompensationLockAndProcessRestart = true;
    const event = {
      recipientId: profiles[0],
      type: 'mention',
      title: 'PRIVATE_N01_TITLE',
      body: 'PRIVATE_N01_BODY',
    };
    await worker.call('notification-queue', event);
    expect(
      await worker.call('notification-cancel', { recipientId: profiles[0] })
    ).toEqual({ cancelledPending: 1, drainedWrites: 0 });
    await worker.call('notification-flush', event);
    expect(
      (await socialDb.query('SELECT count(*)::int AS n FROM notification'))
        .rows[0].n
    ).toBe(0);
    await socialDb.query(
      `CREATE FUNCTION n01_notification_block() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(9126301); RETURN NEW; END $$`
    );
    await socialDb.query(
      'CREATE TRIGGER n01_notification_block BEFORE INSERT ON notification FOR EACH ROW EXECUTE FUNCTION n01_notification_block()'
    );
    await socialDb.query('SELECT pg_advisory_lock(9126301)');
    await worker.call('notification-queue', event);
    const flush = worker.call('notification-flush', event);
    await until(
      async () =>
        (
          await socialDb.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname='ot_social' AND wait_event_type='Lock'"
          )
        ).rows[0].n > 0,
      'notification-insert-block'
    );
    let drained = false;
    const cancel = worker
      .call('notification-cancel', { recipientId: profiles[0] })
      .then((result) => {
        drained = true;
        return result;
      });
    await new Promise((done) => setTimeout(done, 100));
    expect(drained).toBe(false);
    await socialDb.query('SELECT pg_advisory_unlock(9126301)');
    await flush;
    expect(await cancel).toEqual({ cancelledPending: 0, drainedWrites: 1 });
    await worker.call('notification-flush', event);
    const notificationRows = (
      await socialDb.query('SELECT * FROM notification')
    ).rows;
    expect(notificationRows).toHaveLength(1);
    expect(JSON.stringify(notificationRows)).not.toContain('PRIVATE_N01');
    await worker.call('notification-queue', event);
    await kill(worker);
    worker = await spawnWorker();
    await worker.call('notification-flush', event);
    expect(
      (await socialDb.query('SELECT count(*)::int AS n FROM notification'))
        .rows[0].n
    ).toBe(1);
    report.stages.notificationCancelDrainAndVolatileRestart = true;
    const jobId = randomUUID();
    jobs.push(jobId);
    const claim = {
      id: jobId,
      accountId: users[0].id,
      appId: 'client-interface',
      kind: 'export',
      state: 'running',
      attempt: 1,
      leaseOwner: randomUUID(),
    };
    await authDb.query(
      `INSERT INTO account_export_jobs (id,"accountId","appId",kind,"idempotencyKey",state,attempt,"leaseOwner","leaseExpiresAt","coverageSummary") VALUES ($1,$2,'client-interface','export',$3,'running',1,$4,clock_timestamp()+interval '5 minutes','{"artifactAvailable":false}')`,
      [jobId, users[0].id, randomUUID(), claim.leaseOwner]
    );
    const cancelled = await rpc(AuthCommands.CancelAccountExportJob, {
      jobId,
      accountId: users[0].id,
      appId: 'client-interface',
      token: users[0].token,
    });
    expect(cancelled.state).toBe('failed');
    expect(cancelled.coverageSummary.blockers).toContain('cancelled');
    expect(
      (
        await authDb.query(
          'SELECT "lastErrorCode" FROM account_export_jobs WHERE id=$1',
          [jobId]
        )
      ).rows[0].lastErrorCode
    ).toBe('EXPORT_JOB_CANCELLED');
    await worker.call('job-finish', { claim });
    expect(
      (
        await authDb.query(
          'SELECT state,"leaseOwner" FROM account_export_jobs WHERE id=$1',
          [jobId]
        )
      ).rows[0]
    ).toMatchObject({ state: 'failed', leaseOwner: null });
    await expect(
      rpc(AuthCommands.CancelAccountExportJob, {
        jobId,
        accountId: users[1].id,
        appId: 'client-interface',
        token: users[1].token,
      })
    ).rejects.toBeDefined();
    await kill(worker);
    worker = await spawnWorker();
    await worker.call('job-finish', { claim });
    expect(
      (
        await authDb.query(
          'SELECT state FROM account_export_jobs WHERE id=$1',
          [jobId]
        )
      ).rows[0].state
    ).toBe('failed');
    const renewed = await worker.call('job-claim', { jobId });
    expect(renewed.attempt).toBe(2);
    expect(renewed.leaseOwner).not.toBe(claim.leaseOwner);
    await rpc(AuthCommands.CancelAccountExportJob, {
      jobId,
      accountId: users[0].id,
      appId: 'client-interface',
      token: users[0].token,
    });
    report.stages.exportCancelStaleFinishRestartAndExplicitReclaim = true;
    for (let i = 0; i < 2; i++) {
      const id = randomUUID();
      permissions.push(id);
      await authDb.query(
        `INSERT INTO guardian_permission (id,"applicantEmail","guardianEmail","dateOfBirth","guardianUserId",status,"createdAt","expiresAt","appId","appName","uiBaseUrl","emailFrom") VALUES ($1,'n01-dependent@example.test','n01-guardian@example.test','2010-10-23',$2,'approved',clock_timestamp(),'2102-01-01',$3,'N01 fixture','http://127.0.0.1:14990','notice@example.test')`,
        [id, users[i].id, i === 0 ? 'local-hub' : 'other-product']
      );
    }
    for (let i = 0; i < 3; i++) {
      const id = randomUUID();
      notices.push(id);
      await authDb.query(
        `INSERT INTO guardian_policy_notice (id,"policyVersion","policyUrl","guardianUserId",status,attempts,"nextAttemptAt","createdAt","updatedAt") VALUES ($1,$2,'http://127.0.0.1:14990/policy',$3,'pending',0,$4,clock_timestamp(),clock_timestamp())`,
        [
          id,
          'TEST-N01-' + randomUUID(),
          users[i === 2 ? 1 : 0].id,
          i === 2 ? '2200-01-01' : '2100-01-01',
        ]
      );
    }
    // Suppress one pending row before starting the remaining send.
    await authDb.query(
      'UPDATE guardian_policy_notice SET "nextAttemptAt"=\'2200-01-01\' WHERE id=$1',
      [notices[1]]
    );
    const entered = new Promise<void>((done) => {
      providerIncoming = done;
    });
    const delivery = worker.call('notice-deliver', { now: '2101-01-01' });
    await entered;
    let suppressed = false;
    const suppress = cleaner
      .call('notice-suppress', {
        guardianUserId: users[0].id,
        appId: 'local-hub',
      })
      .then((value) => {
        suppressed = true;
        return value;
      });
    await until(
      async () =>
        (
          await authDb.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname='ot_authentication' AND wait_event_type='Lock'"
          )
        ).rows[0].n > 0,
      'notice-cancel-lock'
    );
    await new Promise((done) => setTimeout(done, 150));
    expect(suppressed).toBe(false);
    pendingResponses
      .shift()
      .end(JSON.stringify({ id: 'N01-local-provider-accepted' }));
    await delivery;
    expect(await suppress).toBe(1);
    expect(providerCalls).toBe(1);
    expect(
      (
        await authDb.query(
          'SELECT id,status FROM guardian_policy_notice WHERE id=ANY($1::uuid[]) ORDER BY id',
          [[notices[0], notices[1]]]
        )
      ).rows
    ).toEqual(
      expect.arrayContaining([
        { id: notices[0], status: 'accepted' },
        { id: notices[1], status: 'suppressed' },
      ])
    );
    await expect(
      worker.call('notice-suppress', {
        guardianUserId: users[1].id,
        appId: 'local-hub',
      })
    ).rejects.toBeDefined();
    expect(
      (
        await authDb.query(
          'SELECT status FROM guardian_policy_notice WHERE id=$1',
          [notices[2]]
        )
      ).rows[0].status
    ).toBe('pending');
    await kill(worker);
    worker = await spawnWorker();
    expect(await worker.call('notice-deliver', { now: '2101-01-01' })).toBe(0);
    expect(providerCalls).toBe(1);
    report.stages.noticeRowLockSuppressionRestartAndProviderBoundary = true;
  } catch (error) {
    failure = error;
    report.error = error instanceof Error ? error.message : 'fixture failed';
  } finally {
    for (const response of pendingResponses)
      response.end(JSON.stringify({ id: 'N01-cleanup' }));
    await socialDb
      .query('SELECT pg_advisory_unlock_all()')
      .catch(() => undefined);
    for (const worker of workers) {
      if (worker.child.exitCode !== null || worker.child.signalCode) continue;
      await worker.call('stop').catch(() => undefined);
      await kill(worker);
    }
    const abandoned = (
      await assetsDb.query(
        'SELECT * FROM asset_entity WHERE "profileId"=ANY($1::text[])',
        [profiles]
      )
    ).rows;
    if (abandoned.length) {
      const recovery = await spawnWorker();
      for (const asset of abandoned)
        await recovery.call('asset-remove', asset).catch(() => undefined);
      await recovery.call('stop').catch(() => undefined);
      await kill(recovery);
    }
    await assetsDb
      .query('DROP TRIGGER IF EXISTS n01_asset_fault ON asset_entity')
      .catch(() => undefined);
    await assetsDb
      .query('DROP FUNCTION IF EXISTS n01_asset_fault()')
      .catch(() => undefined);
    await socialDb
      .query('DROP TRIGGER IF EXISTS n01_notification_block ON notification')
      .catch(() => undefined);
    await socialDb
      .query('DROP FUNCTION IF EXISTS n01_notification_block()')
      .catch(() => undefined);
    await socialDb
      .query('DELETE FROM notification WHERE "recipientId"=ANY($1::text[])', [
        profiles,
      ])
      .catch(() => undefined);
    await authDb
      .query('DELETE FROM guardian_policy_notice WHERE id=ANY($1::uuid[])', [
        notices,
      ])
      .catch(() => undefined);
    await authDb
      .query('DELETE FROM guardian_permission WHERE id=ANY($1::uuid[])', [
        permissions,
      ])
      .catch(() => undefined);
    await authDb
      .query('DELETE FROM account_export_jobs WHERE id=ANY($1::uuid[])', [jobs])
      .catch(() => undefined);
    for (const user of users) {
      await rpc(AuthCommands.Logout, { token: user.token }).catch(
        () => undefined
      );
      await authDb
        .query('DELETE FROM token WHERE "userId"=$1', [user.id])
        .catch(() => undefined);
      const keys = (
        await authDb
          .query('SELECT "keyDataId" FROM user_entity WHERE id=$1', [user.id])
          .catch(() => ({ rows: [] }))
      ).rows
        .map((row) => row.keyDataId)
        .filter(Boolean);
      await authDb
        .query('UPDATE user_entity SET "keyDataId"=NULL WHERE id=$1', [user.id])
        .catch(() => undefined);
      if (keys.length)
        await authDb
          .query(
            'UPDATE key_datum SET "userId"=NULL WHERE id=ANY($1::uuid[])',
            [keys]
          )
          .catch(() => undefined);
      await authDb
        .query('DELETE FROM user_entity WHERE id=$1', [user.id])
        .catch(() => undefined);
      if (keys.length)
        await authDb
          .query('DELETE FROM key_datum WHERE id=ANY($1::uuid[])', [keys])
          .catch(() => undefined);
    }
    await profileDb
      .query('DELETE FROM profile WHERE id=ANY($1::uuid[])', [profiles])
      .catch(() => undefined);
    const remainingAssets = (
      await assetsDb
        .query(
          'SELECT id,"storagePath" FROM asset_entity WHERE "profileId"=ANY($1::text[])',
          [profiles]
        )
        .catch(() => ({ rows: [] }))
    ).rows;
    report.cleanup.remainingAssetRows = remainingAssets.length;
    const after = await counts().catch(() => ({}));
    report.cleanup.databaseCountsRestored =
      JSON.stringify(after) === JSON.stringify(baseline);
    report.cleanup.countsBefore = baseline;
    report.cleanup.countsAfter = after;
    if (!report.cleanup.databaseCountsRestored || remainingAssets.length)
      failure ??= new Error('N01 fixture database restoration failed');
    await Promise.all(dbs.map((db) => db.end().catch(() => undefined)));
    authClient.close();
    await new Promise<void>((done) => server.close(() => done()));
    report.result = failure ? 'FAIL' : 'PASS';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
  if (failure) throw failure;
}, 240000);
