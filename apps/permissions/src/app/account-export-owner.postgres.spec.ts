import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { from, of } from 'rxjs';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import {
  ACCOUNT_EXPORT_SNAPSHOT_LIMITS,
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileSnapshotClient,
} from '@optimistic-tanuki/storage';
import loadDatabase from './loadDatabase';
import {
  PermissionsAccountExportOwnerService,
  PERMISSIONS_ACCOUNT_EXPORT_SOURCES,
} from './account-export-owner.service';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const DB = 'permissions_owner_j13_fixture';
const HOST = '127.0.0.1';
const PORT = '15553';
const USER = 'permissions_fixture';
const optedIn =
  process.env.PERMISSIONS_OWNER_PG_OPT_IN === DB &&
  process.env.PERMISSIONS_OWNER_PG_NAME === DB &&
  process.env.PERMISSIONS_OWNER_PG_HOST === HOST &&
  process.env.PERMISSIONS_OWNER_PG_PORT === PORT &&
  process.env.PERMISSIONS_OWNER_PG_USER === USER &&
  !!process.env.PERMISSIONS_OWNER_PG_PASSWORD;
const pgDescribe = optedIn ? describe : describe.skip;
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const FOREIGN_ACCOUNT = '22222222-2222-4222-8222-222222222222';
const ZERO = '00000000-0000-0000-0000-000000000000';
const S_ASSIGNMENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const S_ROLE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const S_PERMISSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const S_PERMISSION_DELETED = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
const S_UNRELATED = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
const ROLE_MAIN = ZERO;
const ROLE_ZERO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const ROLE_UNRELATED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
const PERMISSION_MAIN = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const PERMISSION_NULL_SCOPE = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
const PERMISSION_UNRELATED = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
const bulkPermissionIds = [
  ZERO,
  ...Array.from({ length: 200 }, () => randomUUID()),
];
const TABLES = [
  'role_assignment',
  'role',
  'permission',
  'app_scope',
  'role_permissions',
  'app_scope_permissions',
];

pgDescribe(
  'Permissions account-export owner private PostgreSQL component',
  () => {
    jest.setTimeout(60_000);
    let db: DataSource;
    let spoolRoot: string;
    let owner: PermissionsAccountExportOwnerService;
    let fixtureSeeded = false;
    let allowLease = true;
    let lateInsert: (() => Promise<void>) | undefined;
    const profiles = [
      ZERO,
      ...Array.from({ length: 1005 }, () => randomUUID()),
    ].sort();
    const assignmentIds = [
      ZERO,
      ...Array.from({ length: 204 }, () => randomUUID()),
    ];
    const assignmentProfiles = assignmentIds.map(
      (_, index) =>
        profiles[
          Math.round(
            (index * (profiles.length - 1)) / (assignmentIds.length - 1)
          )
        ]
    );
    const uppercaseProfile = assignmentProfiles.find((id) => /[a-f]/.test(id))!;
    assignmentProfiles[assignmentProfiles.indexOf(uppercaseProfile)] =
      uppercaseProfile.toUpperCase();
    const assignmentRoles = assignmentIds.map((_, i) =>
      i % 3 === 0 ? ROLE_ZERO : ROLE_MAIN
    );
    const assignmentScopes = assignmentIds.map((_, i) =>
      i % 3 === 0 ? null : S_ASSIGNMENT
    );
    const assignmentTargets = assignmentIds.map((_, i) =>
      i === 0 ? 'opaque-target-that-does-not-exist' : null
    );
    const foreignProfile = randomUUID();
    const foreignAssignmentId = randomUUID();
    const grant: AccountExportCaptureGrant = {
      accountId: ACCOUNT,
      appId: 'client-interface',
      token: 'private-permissions-session',
      jobId: randomUUID(),
      attempt: 1,
      leaseOwner: randomUUID(),
    };
    const descriptor: AccountExportSnapshotDescriptor = {
      handleId: randomUUID(),
      participantId: 'profile',
      accountId: ACCOUNT,
      captureId: randomUUID(),
      snapshotAt: '2026-10-20T12:00:00.000Z',
      sizeBytes: 1,
      sha256: 'a'.repeat(64),
      rowCount: profiles.length,
      sources: ['profileIdentity'],
      sourceRowCounts: { profileIdentity: profiles.length },
      sourceDispositions: { profileIdentity: 'retained' },
      identityCount: profiles.length,
      expiresAt: '2099-01-01T00:00:00.000Z',
    };
    const profileSend = jest.fn((pattern: { cmd: string }, request: any) => {
      if (pattern.cmd !== ProfileCommands.ReadAccountExportCaptureIdentities)
        throw Error('Unexpected profile fixture command');
      const page = {
        handleId: descriptor.handleId,
        captureId: descriptor.captureId,
        accountId: request.accountId,
        snapshotAt: descriptor.snapshotAt,
        total: profiles.length,
        profileIds: profiles.slice(
          request.offset,
          request.offset + request.limit
        ),
        nextOffset:
          request.offset + request.limit < profiles.length
            ? request.offset + request.limit
            : null,
      };
      if (lateInsert && request.offset === 0) {
        const insert = lateInsert;
        lateInsert = undefined;
        return from(insert().then(() => page));
      }
      return of(page);
    });
    const authSend = jest.fn((pattern: { cmd: string }) => {
      if (pattern.cmd !== AuthCommands.ValidateAccountExportLease)
        throw Error('Unexpected authentication fixture command');
      return of({ valid: allowLease });
    });

    function makeOwner(dataSource = db) {
      const profile = { send: profileSend } as unknown as ClientProxy;
      return new PermissionsAccountExportOwnerService(
        dataSource,
        new AccountExportProfileSnapshotClient(profile),
        { send: authSend } as unknown as ClientProxy
      );
    }

    async function fingerprint() {
      const state: Record<string, unknown> = {};
      for (const table of TABLES)
        state[table] = await db.query(
          `SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text AS data FROM "${table}" t`
        );
      return state;
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
        ).map(async (fd) => {
          try {
            return await readlink(join('/proc/self/fd', fd));
          } catch {
            return '';
          }
        })
      );
      expect(
        fds.filter((path) =>
          path.startsWith(join(spoolRoot, 'ot-owner-spool-'))
        )
      ).toEqual([]);
      expect(await readdir(spoolRoot)).toEqual([]);
    }

    async function capture(
      onChunk?: (chunk: any) => Promise<void>,
      signal?: AbortSignal,
      inputGrant = grant,
      inputDescriptor = descriptor
    ) {
      let producer:
        | ReturnType<PermissionsAccountExportOwnerService['captureAccount']>
        | undefined;
      try {
        return await new AccountExportOwnerSpoolService().capture(
          {
            participantId: 'permissions',
            accountId: inputGrant.accountId,
            sources: PERMISSIONS_ACCOUNT_EXPORT_SOURCES,
            spoolRoot,
            signal,
          },
          (sink, combined) =>
            (producer = owner.captureAccount({
              grant: inputGrant,
              profileSnapshot: inputDescriptor,
              signal: combined,
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
      const parts: Buffer[] = [];
      for await (const part of handle.createReadStream())
        parts.push(Buffer.from(part));
      return Buffer.concat(parts)
        .toString('utf8')
        .trim()
        .split('\n')
        .flatMap((line) => JSON.parse(line).records) as {
        source: string;
        data: any;
      }[];
    }

    beforeAll(async () => {
      if (
        (process.env.POSTGRES_HOST && process.env.POSTGRES_HOST !== HOST) ||
        (process.env.POSTGRES_DB && process.env.POSTGRES_DB !== DB)
      )
        throw Error(
          'Permissions fixture rejected unrelated POSTGRES_HOST/POSTGRES_DB overrides'
        );
      spoolRoot = await mkdtemp(join(tmpdir(), 'permissions-j13-owner-'));
      const password = process.env.PERMISSIONS_OWNER_PG_PASSWORD;
      if (!password) throw Error('Private fixture password missing');
      const options = loadDatabase(
        new ConfigService({
          database: {
            host: HOST,
            port: Number(PORT),
            username: USER,
            password,
            database: DB,
          },
        })
      );
      if (options.type !== 'postgres')
        throw Error('Expected PostgreSQL datasource options');
      if (
        options.host !== HOST ||
        options.database !== DB ||
        options.username !== USER
      )
        throw Error(
          'Permissions fixture datasource escaped its isolated host/database'
        );
      db = new DataSource({
        ...options,
        password,
        synchronize: false,
        migrationsRun: false,
        logging: false,
        extra: { ...(options.extra ?? {}), max: 4 },
      });
      await db.initialize();
      await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      expect(await db.runMigrations()).toHaveLength(2);
      for (const table of TABLES)
        expect(
          (await db.query(`SELECT count(*)::int AS n FROM "${table}"`))[0].n
        ).toBe(0);
      fixtureSeeded = true;
      await db.query(
        `INSERT INTO app_scope(id,name,description,active) VALUES
       ($1,'assignment scope','independent assignment scope',true),($2,'role scope','role scope',true),
       ($3,'permission scope','permission scope',false),($4,'deleted permission scope','deleted scope',true),($5,'unrelated scope','unrelated',true)`,
        [S_ASSIGNMENT, S_ROLE, S_PERMISSION, S_PERMISSION_DELETED, S_UNRELATED]
      );
      await db.query(
        `INSERT INTO role(id,name,description,"appScopeId") VALUES
       ($1,'reachable-main',$2,$3),($4,'reachable-zero','zero permission role',NULL),($5,'unrelated-role','unrelated role',$6)`,
        [
          ROLE_MAIN,
          'role description '.repeat(1000),
          S_ROLE,
          ROLE_ZERO,
          ROLE_UNRELATED,
          S_UNRELATED,
        ]
      );
      await db.query(
        `INSERT INTO permission(id,name,description,resource,action,"targetId","appScopeId") VALUES
       ($1,'reachable-permission',repeat('permission description ',100),'account','read',$2,$3),
       ($4,'null-scope-permission','permission with detached scope','content','export','opaque-target-missing',$5),
       ($6,'unrelated-permission','unrelated permission','secrets','read',NULL,$7)`,
        [
          PERMISSION_MAIN,
          'no-such-resource',
          S_PERMISSION,
          PERMISSION_NULL_SCOPE,
          S_PERMISSION_DELETED,
          PERMISSION_UNRELATED,
          S_UNRELATED,
        ]
      );
      await db.query('DELETE FROM app_scope WHERE id=$1', [
        S_PERMISSION_DELETED,
      ]);
      await db.query(
        `INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2),($1,$3),($4,$5)`,
        [
          ROLE_MAIN,
          PERMISSION_MAIN,
          PERMISSION_NULL_SCOPE,
          ROLE_UNRELATED,
          PERMISSION_UNRELATED,
        ]
      );
      await db.query(
        `INSERT INTO permission(id,name,description,resource,action,"appScopeId")
       SELECT u.id,'bulk-permission-' || u.ordinality,'small reachable definition','asset','read',$2
       FROM unnest($1::uuid[]) WITH ORDINALITY AS u(id,ordinality)`,
        [bulkPermissionIds, S_PERMISSION]
      );
      await db.query(
        `INSERT INTO role_permissions(role_id,permission_id)
       SELECT $2,u.id FROM unnest($1::uuid[]) AS u(id)`,
        [bulkPermissionIds, ROLE_MAIN]
      );
      await db.query(
        `INSERT INTO app_scope_permissions(app_scope_id,permission_id) VALUES($1,$2),($1,$3),($4,$5)`,
        [
          S_PERMISSION,
          PERMISSION_MAIN,
          PERMISSION_NULL_SCOPE,
          S_UNRELATED,
          PERMISSION_UNRELATED,
        ]
      );
      await db.query(
        `INSERT INTO app_scope_permissions(app_scope_id,permission_id) VALUES($1,$2)`,
        [S_PERMISSION, ZERO]
      );
      await db.query(
        `INSERT INTO role_assignment(id,"profileId","targetId","roleId","appScopeId",created_at)
       SELECT u.id,u.profile_id,u.target_id,u.role_id,u.scope_id,
       CASE WHEN u.ordinality=1 THEN '2020-01-02 03:04:05.123456'::timestamp ELSE now()::timestamp END
       FROM unnest($1::uuid[],$2::text[],$3::text[],$4::uuid[],$5::uuid[])
       WITH ORDINALITY AS u(id,profile_id,target_id,role_id,scope_id,ordinality)`,
        [
          assignmentIds,
          assignmentProfiles,
          assignmentTargets,
          assignmentRoles,
          assignmentScopes,
        ]
      );
      await db.query(
        `INSERT INTO role_assignment(id,"profileId","targetId","roleId","appScopeId") VALUES($1,$2,'foreign-account-target',$3,$4)`,
        [foreignAssignmentId, foreignProfile, ROLE_MAIN, S_ASSIGNMENT]
      );
      owner = makeOwner();
    });

    afterAll(async () => {
      try {
        if (db?.isInitialized && fixtureSeeded) {
          for (const table of [
            'role_assignment',
            'role_permissions',
            'app_scope_permissions',
            'permission',
            'role',
            'app_scope',
          ])
            await db.query(`DELETE FROM "${table}"`);
          for (const table of TABLES)
            expect(
              (await db.query(`SELECT count(*)::int AS n FROM "${table}"`))[0].n
            ).toBe(0);
          await resources();
        }
      } finally {
        if (db?.isInitialized) await db.destroy();
        if (spoolRoot) await rm(spoolRoot, { recursive: true, force: true });
      }
    });

    it('captures over 200 owned assignments and reachable shared definitions without exporting the scope matrix', async () => {
      const before = await fingerprint();
      const handle = await capture();
      try {
        const all = await records(handle);
        const assignments = all
          .filter((record) => record.source === 'roleAssignment')
          .map((record) => record.data);
        const rolePermissions = all
          .filter((record) => record.source === 'rolePermission')
          .map((record) => record.data);
        expect(assignments).toHaveLength(assignmentIds.length);
        expect(assignments[0].id).toBe(ZERO);
        for (const profileId of [
          profiles[0],
          profiles[Math.floor(profiles.length / 2)],
          profiles[profiles.length - 1],
        ])
          expect(assignments.some((row) => row.profileId === profileId)).toBe(
            true
          );
        expect(assignments[0].targetId).toBe(
          'opaque-target-that-does-not-exist'
        );
        expect(assignments[0].createdAt).toBe('2020-01-02 03:04:05.123456');
        expect(
          assignments.some((row) => row.profileId === uppercaseProfile)
        ).toBe(true);
        expect(
          assignments.every((row) => row.profileId !== foreignProfile)
        ).toBe(true);
        expect(
          all.some((record) =>
            JSON.stringify(record).includes(foreignAssignmentId)
          )
        ).toBe(false);
        const cross = assignments.find((row) => row.roleId === ROLE_MAIN)!;
        expect(cross.appScopeId).toBe(S_ASSIGNMENT);
        expect(cross.role.appScopeId).toBe(S_ROLE);
        expect(cross.appScope.id).toBe(S_ASSIGNMENT);
        expect(cross.role.appScope.id).toBe(S_ROLE);
        expect(
          assignments.some(
            (row) => row.roleId === ROLE_ZERO && row.role.appScopeId === null
          )
        ).toBe(true);
        expect(rolePermissions).toHaveLength(203);
        expect(rolePermissions[0].roleId).toBe(ROLE_MAIN);
        expect(rolePermissions[0].permissionId).toBe(ZERO);
        expect(rolePermissions.map((row) => row.permissionId)).toEqual(
          rolePermissions
            .map((row) => row.permissionId)
            .slice()
            .sort()
        );
        expect(
          rolePermissions.some((row) => row.permissionId === PERMISSION_MAIN)
        ).toBe(true);
        expect(
          rolePermissions.some(
            (row) => row.permissionId === PERMISSION_NULL_SCOPE
          )
        ).toBe(true);
        const scopedPermission = rolePermissions.find(
          (row) => row.permissionId === PERMISSION_MAIN
        )!;
        expect(scopedPermission.permission.appScopeId).toBe(S_PERMISSION);
        expect(scopedPermission.permission.appScope.id).toBe(S_PERMISSION);
        expect(scopedPermission.permission.appScopeId).not.toBe(
          cross.role.appScopeId
        );
        expect(
          rolePermissions.find(
            (row) => row.permissionId === PERMISSION_NULL_SCOPE
          )?.permission.targetId
        ).toBe('opaque-target-missing');
        expect(
          rolePermissions.some(
            (row) =>
              row.permission.appScopeId === null &&
              row.permission.appScope === null
          )
        ).toBe(true);
        expect(rolePermissions.every((row) => row.roleId === ROLE_MAIN)).toBe(
          true
        );
        expect(
          all.some((record) => JSON.stringify(record).includes(ROLE_UNRELATED))
        ).toBe(false);
        expect(
          all.some((record) =>
            JSON.stringify(record).includes(PERMISSION_UNRELATED)
          )
        ).toBe(false);
        expect(Object.keys(handle.metadata.sourceDispositions)).toEqual([
          ...PERMISSIONS_ACCOUNT_EXPORT_SOURCES,
        ]);
        expect(handle.metadata.sourceRowCounts).toMatchObject({
          roleAssignment: assignmentIds.length,
          rolePermission: 203,
        });
        expect(
          profileSend.mock.calls.filter(
            ([pattern]) =>
              pattern.cmd === ProfileCommands.ReadAccountExportCaptureIdentities
          ).length
        ).toBe(
          Math.ceil(
            profiles.length / ACCOUNT_EXPORT_SNAPSHOT_LIMITS.identityPageSize
          )
        );
        expect(await fingerprint()).toEqual(before);
      } finally {
        await handle.cleanup();
      }
      await resources();
    });

    it('uses the established repeatable-read snapshot when an assignment arrives during identity paging', async () => {
      const lateId = randomUUID();
      const before = await fingerprint();
      lateInsert = async () => {
        await db.query(
          `INSERT INTO role_assignment(id,"profileId","targetId","roleId","appScopeId") VALUES($1,$2,NULL,$3,NULL)`,
          [lateId, profiles[profiles.length - 1], ROLE_MAIN]
        );
      };
      const handle = await capture();
      try {
        expect(
          (await records(handle)).some((row) => row.data.id === lateId)
        ).toBe(false);
      } finally {
        await handle.cleanup();
        lateInsert = undefined;
      }
      const later = await capture();
      try {
        expect(
          (await records(later)).some((row) => row.data.id === lateId)
        ).toBe(true);
      } finally {
        await later.cleanup();
        await db.query('DELETE FROM role_assignment WHERE id=$1', [lateId]);
      }
      expect(await fingerprint()).toEqual(before);
      await resources();
    });

    it('rejects overlong role and target fields without silently truncating records', async () => {
      const before = await fingerprint();
      await db.query(
        "UPDATE role SET description=repeat('x',65537) WHERE id=$1",
        [ROLE_MAIN]
      );
      try {
        await expect(capture()).rejects.toBeDefined();
      } finally {
        await db.query('UPDATE role SET description=$2 WHERE id=$1', [
          ROLE_MAIN,
          'role description '.repeat(1000),
        ]);
      }
      await db.query(
        'UPDATE role_assignment SET "targetId"=repeat(\'t\',4097) WHERE id=$1',
        [ZERO]
      );
      try {
        await expect(capture()).rejects.toBeDefined();
      } finally {
        await db.query('UPDATE role_assignment SET "targetId"=$2 WHERE id=$1', [
          ZERO,
          assignmentTargets[0],
        ]);
      }
      expect(await fingerprint()).toEqual(before);
      await resources();
    });

    it('fails closed on missing required Role, Permission and scope relationships', async () => {
      const before = await fingerprint();
      const missing = randomUUID();
      const checks: Array<{
        drop: string;
        corrupt: string;
        corruptArgs: unknown[];
        restore: string;
        restoreArgs: unknown[];
        add: string;
      }> = [
        {
          drop: 'ALTER TABLE role_assignment DROP CONSTRAINT "FK_f0de67fd09cd3cd0aabca79994d"',
          corrupt: 'UPDATE role_assignment SET "roleId"=$2 WHERE id=$1',
          corruptArgs: [ZERO, missing],
          restore: 'UPDATE role_assignment SET "roleId"=$2 WHERE id=$1',
          restoreArgs: [ZERO, assignmentRoles[0]],
          add: 'ALTER TABLE role_assignment ADD CONSTRAINT "FK_f0de67fd09cd3cd0aabca79994d" FOREIGN KEY ("roleId") REFERENCES role("id") ON DELETE NO ACTION ON UPDATE NO ACTION',
        },
        {
          drop: 'ALTER TABLE role_permissions DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"',
          corrupt:
            'UPDATE role_permissions SET permission_id=$3 WHERE role_id=$1 AND permission_id=$2',
          corruptArgs: [ROLE_MAIN, PERMISSION_NULL_SCOPE, missing],
          restore:
            'UPDATE role_permissions SET permission_id=$3 WHERE role_id=$1 AND permission_id=$2',
          restoreArgs: [ROLE_MAIN, missing, PERMISSION_NULL_SCOPE],
          add: 'ALTER TABLE role_permissions ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY (permission_id) REFERENCES permission(id) ON DELETE NO ACTION ON UPDATE NO ACTION',
        },
        {
          drop: 'ALTER TABLE role DROP CONSTRAINT "FK_7a87fe631904c7cd24137fd3495"',
          corrupt: 'UPDATE role SET "appScopeId"=$2 WHERE id=$1',
          corruptArgs: [ROLE_MAIN, missing],
          restore: 'UPDATE role SET "appScopeId"=$2 WHERE id=$1',
          restoreArgs: [ROLE_MAIN, S_ROLE],
          add: 'ALTER TABLE role ADD CONSTRAINT "FK_7a87fe631904c7cd24137fd3495" FOREIGN KEY ("appScopeId") REFERENCES app_scope(id) ON DELETE NO ACTION ON UPDATE NO ACTION',
        },
      ];
      for (const check of checks) {
        await db.query(check.drop);
        try {
          await db.query(check.corrupt, check.corruptArgs);
          await expect(capture()).rejects.toBeDefined();
        } finally {
          await db.query(check.restore, check.restoreArgs);
          await db.query(check.add);
        }
        await resources();
      }
      expect(await fingerprint()).toEqual(before);
    });

    it('drains abort, lease denial after a chunk, and callback failure with no retained partial state', async () => {
      const before = await fingerprint();
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
        expect(changed).toBe(true);
      } finally {
        allowLease = true;
      }
      await expect(
        capture(async () => {
          throw Error('fixture callback failure');
        })
      ).rejects.toBeDefined();
      expect(await fingerprint()).toEqual(before);
      await resources();
      const handle = await capture();
      await handle.cleanup();
      await resources();
    });

    it('bounds an occupied single-connection pool with production datasource options', async () => {
      const options = loadDatabase(
        new ConfigService({
          database: {
            host: HOST,
            port: Number(PORT),
            username: USER,
            password: process.env.PERMISSIONS_OWNER_PG_PASSWORD,
            database: DB,
          },
        })
      );
      if (options.type !== 'postgres')
        throw Error('Expected PostgreSQL datasource options');
      expect(options.connectTimeoutMS).toBe(3000);
      const occupied = new DataSource({
        ...options,
        synchronize: false,
        migrationsRun: false,
        logging: false,
        extra: { max: 1 },
      });
      await occupied.initialize();
      const held = occupied.createQueryRunner();
      await held.connect();
      const previous = owner;
      owner = makeOwner(occupied);
      const started = Date.now();
      try {
        await expect(capture()).rejects.toBeDefined();
        expect(Date.now() - started).toBeGreaterThanOrEqual(2500);
        expect(Date.now() - started).toBeLessThan(10_000);
      } finally {
        owner = previous;
        await held.release();
        await occupied.destroy();
      }
      await resources();
    });

    it('evicts and quarantines a connection whose temporary-table cleanup fails', async () => {
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
        const removalDeadline = Date.now() + 2000;
        let remaining = 1;
        do {
          remaining = (
            await db.query(
              'SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=$1',
              [pid]
            )
          )[0].n;
          if (remaining === 0) break;
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
        } while (Date.now() < removalDeadline);
        expect(remaining).toBe(0);
        await expect(capture()).rejects.toBeDefined();
      } finally {
        query.mockRestore();
        create.mockRestore();
        owner = makeOwner();
      }
      await resources();
      const handle = await capture();
      await handle.cleanup();
      await resources();
    });
  }
);
