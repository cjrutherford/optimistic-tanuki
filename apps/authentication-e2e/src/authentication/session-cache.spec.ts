import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { AuthCommands, RoleCommands } from '@optimistic-tanuki/constants';
import { Client as PgClient } from 'pg';
import { firstValueFrom, timeout } from 'rxjs';
import { ChildProcess, fork, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createClient } from 'redis';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

it('N02 proves shared OAuth redemption and cross-replica permission/session invalidation', async () => {
  if (
    process.env.N02_PRIVATE_MARKER !== 'private-n02-otts-v1' ||
    process.env.E2E_DB_PORT !== '15562' ||
    process.env.HOST !== '127.0.0.1' ||
    process.env.PORT !== '15001'
  )
    throw new Error('PRIVATE_N02_FIXTURE_REQUIRED');
  const command = promisify(execFile);
  const container = process.env.N02_DB_CONTAINER_ID || '';
  if (!/^[a-f0-9]{64}$/.test(container))
    throw new Error('PRIVATE_N02_CONTAINER_REQUIRED');
  const inspect = JSON.parse(
    (await command('docker', ['inspect', container], { timeout: 10000 })).stdout
  )[0];
  expect(inspect.Config.Labels['com.docker.compose.project']).toBe(
    'ot-df007-n02-session-cache'
  );
  const reportPath = process.env.N02_REPORT_PATH || '';
  if (!reportPath) throw new Error('PRIVATE_N02_REPORT_REQUIRED');

  const names = ['authentication', 'profile', 'permissions'];
  const dbs = names.map(
    (name) =>
      new PgClient({
        host: '127.0.0.1',
        port: 15562,
        user: 'postgres',
        password: 'postgres',
        database: `ot_${name}`,
      })
  );
  const [authDb, profileDb, permissionDb] = dbs;
  const redis = createClient({ socket: { host: '127.0.0.1', port: 16382 } });
  const scopes = [randomUUID(), randomUUID()];
  const roleIds = [randomUUID(), randomUUID()];
  const permissionIds = [randomUUID(), randomUUID()];
  const assignmentIds = [randomUUID(), randomUUID(), randomUUID()];
  const permissionName = 'n02-' + randomUUID();
  let redisBaseline: string[] = [];
  const auth = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 15001 },
  });
  const rpc = (cmd: string, payload: any) =>
    firstValueFrom(auth.send({ cmd }, payload).pipe(timeout({ first: 10000 })));
  const report: any = {
    result: 'RUNNING',
    slice: 'N02',
    applications: ['client-interface', 'local-hub'],
    controlledBoundary: [
      'provider OAuth handshake bypassed using trusted Auth session reference',
    ],
    stages: {},
    cleanup: {},
  };
  const users: Array<{ id: string; email: string; password: string }> = [];
  const profiles = [randomUUID(), randomUUID(), randomUUID()];
  const children: ChildProcess[] = [];
  const workers: Array<{
    child: ChildProcess;
    call: (op: string, data?: any) => Promise<any>;
  }> = [];
  let baseline: any;
  let failure: unknown;
  const counts = async () => {
    const value: any = {};
    for (let i = 0; i < dbs.length; i++) {
      const tables = (
        await dbs[i].query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
        )
      ).rows;
      value[names[i]] = {};
      for (const table of tables)
        value[names[i]][table.table_name] = (
          await dbs[i].query(
            `SELECT count(*)::text AS count FROM "${table.table_name}"`
          )
        ).rows[0].count;
    }
    return value;
  };
  const spawn = async (port: number) => {
    const child = fork(path.join(__dirname, 'n02-gateway.worker.ts'), [], {
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
          'apps/gateway/tsconfig.app.json'
        ),
        N02_HTTP_PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    children.push(child);
    const pending = new Map<string, (value: any) => void>();
    child.stdout?.on('data', () => undefined);
    child.stderr?.on('data', (chunk) => process.stderr.write(chunk));
    child.on('message', (message: any) => {
      if (message.ready) return;
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    });
    const call = (op: string, data?: any) =>
      new Promise<any>((resolve, reject) => {
        const id = randomUUID();
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`N02_WORKER_TIMEOUT_${op}`));
        }, 15000);
        pending.set(id, (message) => {
          clearTimeout(timer);
          if (message.error) reject(new Error(message.error));
          else resolve(message.value);
        });
        child.send!({ id, op, data });
      });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('N02_WORKER_START_TIMEOUT')),
        15000
      );
      child.on('message', (message: any) => {
        if (message.ready) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once('error', reject);
    });
    const worker = { child, call };
    workers.push(worker);
    return worker;
  };
  try {
    await Promise.all(dbs.map((db) => db.connect()));
    await auth.connect();
    await redis.connect();
    redisBaseline = (await redis.keys('gateway:oauth-*')).map(String).sort();
    expect(redisBaseline).toEqual([]);
    baseline = await counts();
    for (const label of ['owner', 'counterpart']) {
      const email = `n02-${label}-${randomUUID()}@example.test`,
        password = 'N02-private-fixture!123';
      const result: any = await rpc(AuthCommands.Register, {
        email,
        fn: 'N02',
        ln: label,
        password,
        confirm: password,
        ageEligibilityStatus: 'adult',
      });
      users.push({ id: result.data.user.id, email, password });
      await rpc(AuthCommands.Login, {
        email,
        password,
        appId: 'client-interface',
      });
    }
    await profileDb.query(
      `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'client-interface','N02 OT','','','','','','',''),($3,$4,'client-interface','N02 counterpart','','','','','','',''),($5,$2,'local-hub','N02 TS','','','','','','','')`,
      [profiles[0], users[0].id, profiles[1], users[1].id, profiles[2]]
    );
    for (let i = 0; i < 2; i++) {
      const appId = i === 0 ? 'client-interface' : 'local-hub';
      await permissionDb.query(
        'INSERT INTO app_scope (id,name,description) VALUES ($1,$2,$3)',
        [scopes[i], appId, 'N02 fixture']
      );
      await permissionDb.query(
        'INSERT INTO permission (id,name,description,resource,action,"appScopeId") VALUES ($1,$2,$3,$4,$5,$6)',
        [
          permissionIds[i],
          permissionName,
          'N02 fixture',
          'n02',
          'read',
          scopes[i],
        ]
      );
      await permissionDb.query(
        'INSERT INTO role (id,name,description,"appScopeId") VALUES ($1,$2,$3,$4)',
        [roleIds[i], 'n02-role-' + randomUUID(), 'N02 fixture', scopes[i]]
      );
      await permissionDb.query(
        'INSERT INTO role_permissions (role_id,permission_id) VALUES ($1,$2)',
        [roleIds[i], permissionIds[i]]
      );
    }
    for (let i = 0; i < 3; i++)
      await permissionDb.query(
        'INSERT INTO role_assignment (id,"profileId","roleId","appScopeId") VALUES ($1,$2,$3,$4)',
        [
          assignmentIds[i],
          profiles[i],
          roleIds[i === 2 ? 1 : 0],
          scopes[i === 2 ? 1 : 0],
        ]
      );
    const a = await spawn(15081);
    let b = await spawn(15082);
    const query = (i: number) =>
      `/permission?scope=${
        i === 2 ? 'local-hub' : 'client-interface'
      }&scopeId=${scopes[i === 2 ? 1 : 0]}&permission=${permissionName}`;
    const origin = (i: number) =>
      i === 2 ? 'http://127.0.0.1:15083' : 'http://127.0.0.1:15080';
    const tokens: string[] = [];
    for (let i = 0; i < 3; i++) {
      const issued: any = await rpc(AuthCommands.Issue, {
        userId: users[i === 1 ? 1 : 0].id,
        profileId: profiles[i],
        appId: i === 2 ? 'local-hub' : 'client-interface',
      });
      tokens.push(issued.data.newToken);
    }
    const request = (
      port: number,
      route: string,
      i: number,
      cookie = false,
      token = tokens[i]
    ) =>
      fetch(`http://127.0.0.1:${port}${route}`, {
        method: 'POST',
        headers: {
          origin: origin(i),
          ...(cookie
            ? { cookie: 'ot_session=' + token }
            : { authorization: 'Bearer ' + token }),
        },
        signal: AbortSignal.timeout(15000),
      });
    for (const worker of [a, b])
      for (let i = 0; i < 3; i++)
        await worker.call('seed-cache', {
          profileIds: [profiles[i]],
          permission: permissionName,
          appScope: scopes[i === 2 ? 1 : 0],
        });
    for (const port of [15081, 15082])
      for (let i = 0; i < 3; i++)
        for (const cookie of [true, false])
          expect((await request(port, query(i), i, cookie)).status).toBe(200);
    await a.call('role-mutate', {
      cmd: RoleCommands.Unassign,
      payload: { assignmentId: assignmentIds[0] },
    });
    for (const port of [15081, 15082])
      for (const cookie of [true, false])
        expect((await request(port, query(0), 0, cookie)).status).toBe(403);
    expect((await request(15082, query(1), 1)).status).toBe(200);
    await a.call('role-mutate', {
      cmd: RoleCommands.Assign,
      payload: {
        profileId: profiles[0],
        roleId: roleIds[0],
        appScopeId: scopes[0],
      },
    });
    expect((await request(15082, query(0), 0)).status).toBe(200);
    await a.call('role-mutate', {
      cmd: RoleCommands.RemovePermission,
      payload: { roleId: roleIds[0], permissionId: permissionIds[0] },
    });
    expect((await request(15082, query(0), 0)).status).toBe(403);
    expect((await request(15082, query(2), 2, true)).status).toBe(200);
    report.stages.authoritativeReplicaChecksAndRoleDefinitionMutation = true;
    // The preceding shared-definition mutation intentionally clears every diagnostic entry.
    for (let i = 0; i < 3; i++)
      await a.call('seed-cache', {
        profileIds: [profiles[i]],
        permission: permissionName,
        appScope: scopes[i === 2 ? 1 : 0],
      });
    await a.call('invalidate-profiles', {
      profileIds: [profiles[0], profiles[2]],
    });
    for (const i of [0, 2])
      expect(
        await a.call('get-cache', {
          profileId: profiles[i],
          permission: permissionName,
          appScope: scopes[i === 2 ? 1 : 0],
        })
      ).toBeNull();
    expect(
      await a.call('get-cache', {
        profileId: profiles[1],
        permission: permissionName,
        appScope: scopes[0],
      })
    ).toBe(true);
    report.stages.accountProfileInvalidationPreservesCounterpart = true;
    const makeGrant = async (
      i: number,
      cookieSession: boolean,
      ttl = 60000
    ) => {
      const ref: any = await rpc(AuthCommands.CreateOAuthCallbackSession, {
        userId: users[i === 1 ? 1 : 0].id,
        profileId: profiles[i],
        appId: i === 2 ? 'local-hub' : 'client-interface',
      });
      const stateId = randomBytes(32).toString('base64url'),
        nonce = randomBytes(32).toString('base64url');
      const code = stateId + '.' + randomBytes(32).toString('base64url');
      const grant = {
        ...ref,
        returnOrigin: origin(i),
        redemptionOrigin: 'http://127.0.0.1:15080',
        stateId,
        nonceHash: createHash('sha256').update(nonce).digest('base64url'),
        expiresAt: Date.now() + ttl,
        cookieSession,
      };
      await a.call('store-grant', { code, grant });
      return { ref, code, stateId, nonce };
    };
    const redeem = (g: any, i: number, wrong = false) =>
      fetch('http://127.0.0.1:15082/redeem', {
        method: 'POST',
        headers: {
          origin: wrong ? 'http://foreign.invalid' : origin(i),
          'content-type': 'application/json',
          cookie:
            'oauth_state_nonce=' +
            encodeURIComponent(
              JSON.stringify([{ id: g.stateId, nonce: g.nonce }])
            ),
        },
        body: JSON.stringify({ callbackCode: g.code }),
        signal: AbortSignal.timeout(15000),
      });
    for (const i of [0, 2]) {
      const g = await makeGrant(i, i === 0);
      const raw = await redis.get('gateway:oauth-callback-grant:' + g.code);
      expect(raw).not.toContain('token');
      expect(JSON.parse(String(raw)).sessionId).toBe(g.ref.sessionId);
      expect(
        await redis.pTTL('gateway:oauth-callback-grant:' + g.code)
      ).toBeGreaterThan(0);
      expect((await redeem(g, i, true)).status).toBe(401);
      const response = await redeem(g, i);
      expect(response.status).toBe(200);
      const value: any = await response.json();
      const token =
        i === 0
          ? decodeURIComponent(
              response.headers
                .get('set-cookie')!
                .split(';')[0]
                .slice('ot_session='.length)
            )
          : value.token;
      if (i === 0) {
        expect(value).toEqual({ session: true, returnOrigin: origin(i) });
        expect(response.headers.get('set-cookie')).toContain('HttpOnly');
      } else expect(typeof value.token).toBe('string');
      expect((await request(15081, query(i), i, i === 0, token)).status).toBe(
        i === 0 ? 403 : 200
      );
      expect((await redeem(g, i)).status).toBe(401);
      expect(
        await redis.get('gateway:oauth-callback-grant:' + g.code)
      ).toBeNull();
      expect((await request(15081, '/logout', i, i === 0, token)).status).toBe(
        200
      );
      for (const port of [15081, 15082])
        for (const cookie of [true, false])
          expect((await request(port, query(i), i, cookie, token)).status).toBe(
            401
          );
    }
    report.stages.crossReplicaOAuthCookieBearerReplayAndLogout = true;
    const revoked = await makeGrant(0, true);
    await authDb.query('UPDATE token SET revoked=true WHERE id=$1', [
      revoked.ref.sessionId,
    ]);
    expect((await redeem(revoked, 0)).status).toBe(401);
    const movedProfile = await makeGrant(0, true);
    await profileDb.query('UPDATE profile SET "userId"=$1 WHERE id=$2', [
      randomUUID(),
      profiles[0],
    ]);
    try {
      expect((await redeem(movedProfile, 0)).status).toBe(401);
    } finally {
      await profileDb.query('UPDATE profile SET "userId"=$1 WHERE id=$2', [
        users[0].id,
        profiles[0],
      ]);
    }
    report.stages.currentProfileOwnershipRecheckedAtRedemption = true;
    const expired = await makeGrant(0, true, 80);
    await new Promise((r) => setTimeout(r, 150));
    expect((await redeem(expired, 0)).status).toBe(401);
    const legacy = await makeGrant(0, true);
    await redis.set(
      'gateway:oauth-callback-grant:' + legacy.code,
      JSON.stringify({
        token: 'legacy-bearer-marker',
        stateId: legacy.stateId,
        nonceHash: createHash('sha256')
          .update(legacy.nonce)
          .digest('base64url'),
        returnOrigin: origin(0),
        redemptionOrigin: origin(0),
        expiresAt: Date.now() + 60000,
      }),
      { PX: 60000 }
    );
    expect((await redeem(legacy, 0)).status).toBe(401);
    report.stages.revokedExpiredAndLegacyGrantDenial = true;
    const owned = await makeGrant(0, true),
      foreign = await makeGrant(1, false);
    for (const i of [0, 1])
      await a.call('store-state', {
        stateId: 'n02-linked-' + i,
        state: {
          payload: {
            provider: 'google',
            returnTo: origin(i),
            appScope: 'client-interface',
            issuedAt: Date.now(),
            codeVerifier: 'fixture-pkce',
            linkUserId: users[i].id,
          },
          nonceHash: 'fixture',
          expiresAt: Date.now() + 60000,
        },
      });
    await b.call('invalidate-account', { accountId: users[0].id });
    expect(
      await redis.get('gateway:oauth-callback-grant:' + owned.code)
    ).toBeNull();
    expect(
      await redis.get('gateway:oauth-callback-grant:' + foreign.code)
    ).not.toBeNull();
    expect(
      await b.call('consume-state', { stateId: 'n02-linked-0' })
    ).toBeNull();
    expect(
      await b.call('consume-state', { stateId: 'n02-linked-1' })
    ).not.toBeNull();
    expect(
      await a.call('consume-state', { stateId: 'n02-linked-1' })
    ).toBeNull();
    report.stages.accountOAuthInvalidationAndOneTimeState = true;
    const exited = new Promise<void>((r) => b.child.once('exit', () => r()));
    b.child.kill('SIGKILL');
    await exited;
    b = await spawn(15082);
    expect((await request(15082, query(0), 0)).status).toBe(403);
    await rpc(AuthCommands.Logout, { token: tokens[2] });
    for (const cookie of [true, false])
      expect((await request(15082, query(2), 2, cookie)).status).toBe(401);
    report.stages.processRestartAndDurableSessionRevocation = true;
    report.result = 'PASS';
  } catch (error) {
    report.result = 'FAIL';
    report.error = String(error);
    failure = error;
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise<void>((r) => child.once('exit', () => r()));
        child.kill('SIGTERM');
        await exited;
      }
    }
    try {
      await permissionDb.query(
        'DELETE FROM role_assignment WHERE "profileId"=ANY($1::varchar[])',
        [profiles]
      );
      await permissionDb.query(
        'DELETE FROM role_permissions WHERE role_id=ANY($1::uuid[])',
        [roleIds]
      );
      await permissionDb.query('DELETE FROM role WHERE id=ANY($1::uuid[])', [
        roleIds,
      ]);
      await permissionDb.query(
        'DELETE FROM permission WHERE id=ANY($1::uuid[])',
        [permissionIds]
      );
      await permissionDb.query(
        'DELETE FROM app_scope WHERE id=ANY($1::uuid[])',
        [scopes]
      );
      await profileDb.query('DELETE FROM profile WHERE id=ANY($1::uuid[])', [
        profiles,
      ]);
      for (const user of users) {
        await authDb.query('DELETE FROM token WHERE "userId"=$1', [user.id]);
        const keys = (
          await authDb.query(
            'SELECT "keyDataId" FROM user_entity WHERE id=$1',
            [user.id]
          )
        ).rows
          .map((r) => r.keyDataId)
          .filter(Boolean);
        await authDb.query(
          'UPDATE user_entity SET "keyDataId"=NULL WHERE id=$1',
          [user.id]
        );
        if (keys.length)
          await authDb.query(
            'UPDATE key_datum SET "userId"=NULL WHERE id=ANY($1::uuid[])',
            [keys]
          );
        await authDb.query('DELETE FROM user_entity WHERE id=$1', [user.id]);
        if (keys.length)
          await authDb.query('DELETE FROM key_datum WHERE id=ANY($1::uuid[])', [
            keys,
          ]);
      }
      if (redis.isReady) {
        const keys = (await redis.keys('gateway:oauth-*')).map(String);
        for (const key of keys)
          if (!redisBaseline.includes(key)) await redis.del(key);
        expect(
          (await redis.keys('gateway:oauth-*')).map(String).sort()
        ).toEqual(redisBaseline);
      }
      const after = await counts();
      report.cleanup.databaseCountsRestored =
        JSON.stringify(after) === JSON.stringify(baseline);
      report.cleanup.countsBefore = baseline;
      report.cleanup.countsAfter = after;
      report.cleanup.redisKeysRestored = true;
      expect(after).toEqual(baseline);
    } catch (error) {
      report.result = 'FAIL';
      report.cleanup.error = String(error);
      failure = error;
    } finally {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      auth.close();
      if (redis.isOpen) await redis.quit();
      await Promise.all(dbs.map((db) => db.end()));
    }
  }
  if (failure) throw failure;
  expect(report.result).toBe('PASS');
});
