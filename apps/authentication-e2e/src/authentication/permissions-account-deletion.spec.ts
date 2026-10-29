import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { PermissionCommands, RoleCommands } from '@optimistic-tanuki/constants';
import {
  AccountDeletionAuthorityClient,
  AccountDeletionWriteFenceEntity,
} from '@optimistic-tanuki/storage';
import { AccountDeletionOperationEntity } from '../../../authentication/src/account-deletion/account-deletion-operation.entity';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';
import { AccountDeletionController } from '../../../authentication/src/account-deletion/account-deletion.controller';
import { AppService } from '../../../authentication/src/app/app.service';
import { Permission } from '../../../permissions/src/permissions/entities/permission.entity';
import { Role } from '../../../permissions/src/roles/entities/role.entity';
import { RoleAssignment } from '../../../permissions/src/role-assignments/entities/role-assignment.entity';
import { AppScope } from '../../../permissions/src/app-scopes/entities/app-scope.entity';
import { PermissionsAccountDeletionOwnerService } from '../../../permissions/src/app/account-deletion-owner.service';
import { PermissionsAccountDeletionOwnerController } from '../../../permissions/src/app/account-deletion-owner.controller';
import { RolesController } from '../../../permissions/src/roles/roles.controller';
import { RolesService } from '../../../permissions/src/app/roles.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

const gated = process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture';
(gated ? describe : describe.skip)(
  'D05 Permissions deletion with real authority, repositories and TCP',
  () => {
    const account = randomUUID(),
      profile = randomUUID(),
      secondProfile = randomUUID(),
      otherProfile = randomUUID();
    const scope = randomUUID(),
      secondScope = randomUUID(),
      role = randomUUID(),
      permission = randomUUID();
    const own = randomUUID(),
      secondOwn = randomUUID(),
      foreign = randomUUID(),
      late = randomUUID();
    const shared = [
      'role',
      'permission',
      'app_scope',
      'role_permissions',
      'app_scope_permissions',
    ];
    const tables = [
      ...shared,
      'role_assignment',
      'account_deletion_write_fence',
    ];
    let db: DataSource,
      authDb: DataSource,
      authority: AccountDeletionAuthorityService,
      authApp: any,
      permissionsApp: any,
      authClient: any,
      client: any,
      operation = '';
    let baseline: Record<string, number>,
      authBaseline: Record<string, number>,
      sharedBefore: unknown,
      foreignBefore: unknown;
    const oldKey = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    const call = (cmd: string, payload: unknown) =>
      firstValueFrom(
        client.send({ cmd }, payload).pipe(timeout(15000))
      ) as Promise<any>;
    const counts = async (source: DataSource, names: string[]) =>
      Object.fromEntries(
        await Promise.all(
          names.map(async (name) => [
            name,
            Number(
              (
                await source.query(`SELECT count(*) FROM "${name}"`)
              )[0].count
            ),
          ])
        )
      );
    const snapshots = async () =>
      Promise.all(
        shared.map(async (name) => ({
          table: name,
          rows: await db.query(
            `SELECT to_jsonb(t) AS row FROM "${name}" t ORDER BY to_jsonb(t)::text`
          ),
        }))
      );
    async function port() {
      const server = createServer();
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
      );
      const address = server.address();
      if (!address || typeof address === 'string') throw Error('PORT');
      const result = address.port;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
      return result;
    }
    beforeAll(async () => {
      process.env['ACCOUNT_DELETION_PROOF_KEY'] =
        randomBytes(48).toString('base64url');
      const common = {
        type: 'postgres' as const,
        host: '127.0.0.1',
        port: Number(process.env['POSTGRES_PORT']),
        username: process.env['POSTGRES_USER'],
        password: process.env['POSTGRES_PASSWORD'],
        synchronize: false,
        migrationsRun: false,
        extra: { statement_timeout: 10000, lock_timeout: 5000 },
      };
      db = new DataSource({
        ...common,
        database: 'd05_permissions',
        entities: [
          Permission,
          Role,
          RoleAssignment,
          AppScope,
          AccountDeletionWriteFenceEntity,
        ],
      });
      authDb = new DataSource({
        ...common,
        database: 'd00',
        entities: [AccountDeletionOperationEntity],
      });
      await db.initialize();
      await authDb.initialize();
      baseline = await counts(db, tables);
      authBaseline = await counts(authDb, [
        'account_deletion_operations',
        'account_deletion_write_fence',
      ]);
      expect(
        (
          await db.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'"
          )
        )
          .map((r: any) => r.tablename)
          .sort()
      ).toEqual([...tables, 'migrations'].sort());
      authority = new AccountDeletionAuthorityService(
        authDb.getRepository(AccountDeletionOperationEntity),
        authDb
      );
      const authModule = await Test.createTestingModule({
        controllers: [AccountDeletionController],
        providers: [
          { provide: AccountDeletionAuthorityService, useValue: authority },
          {
            provide: AppService,
            useValue: {
              validateToken: () => {
                throw Error('UNEXPECTED_SESSION');
              },
            },
          },
        ],
      }).compile();
      const authPort = await port();
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
      const owner = new PermissionsAccountDeletionOwnerService(
        db,
        new AccountDeletionAuthorityClient(authClient)
      );
      const roles = new RolesService(
        db.getRepository(Role),
        db.getRepository(Permission),
        db.getRepository(RoleAssignment),
        db.getRepository(AppScope),
        {
          log: () => {},
          warn: () => {},
          debug: () => {},
          error: () => {},
        } as never
      );
      const mod = await Test.createTestingModule({
        controllers: [
          PermissionsAccountDeletionOwnerController,
          RolesController,
        ],
        providers: [
          { provide: PermissionsAccountDeletionOwnerService, useValue: owner },
          { provide: RolesService, useValue: roles },
        ],
      }).compile();
      const permissionsPort = await port();
      permissionsApp = mod.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: permissionsPort },
        logger: false,
      });
      await permissionsApp.listen();
      client = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: permissionsPort },
      });
      const accepted = await authority.accept(
        account,
        'local-hub',
        randomUUID()
      );
      operation = accepted.id;
      await authority.claim(operation);
      await authority.recordProfileScope(
        await authority.issueGrant(operation, 'profile', 'fence'),
        {
          currentProfileIds: [profile, secondProfile].sort(),
          legacyProfileIds: [],
        }
      );
      await db.query(
        "INSERT INTO app_scope(id,name,description) VALUES($1,'client-interface','shared'),($2,'local-hub','shared')",
        [scope, secondScope]
      );
      await db.query(
        'INSERT INTO role(id,name,description,"appScopeId") VALUES($1,$2,\'shared role\',$3)',
        [role, `d05-role-${role}`, scope]
      );
      await db.query(
        "INSERT INTO permission(id,name,description,resource,action,\"appScopeId\") VALUES($1,'d05.read','shared definition','post','read',$2)",
        [permission, scope]
      );
      await db.query(
        'INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2)',
        [role, permission]
      );
      await db.query(
        'INSERT INTO app_scope_permissions(app_scope_id,permission_id) VALUES($1,$2)',
        [scope, permission]
      );
      await db.query(
        'INSERT INTO role_assignment(id,"profileId","roleId","appScopeId","targetId") VALUES($1,$2,$3,$4,NULL),($5,$6,$3,$7,NULL),($8,$9,$3,$4,$2)',
        [
          own,
          profile,
          role,
          scope,
          secondOwn,
          secondProfile,
          secondScope,
          foreign,
          otherProfile,
        ]
      );
      sharedBefore = await snapshots();
      foreignBefore = await db.query(
        'SELECT to_jsonb(a) AS row FROM role_assignment a WHERE id=$1',
        [foreign]
      );
    }, 30000);
    afterAll(async () => {
      try {
        if (db?.isInitialized) {
          await db.query(
            'DROP TRIGGER IF EXISTS d05_test_delete_fault ON role_assignment'
          );
          await db.query('DROP FUNCTION IF EXISTS d05_test_delete_fail()');
          await db.transaction(async (m) => {
            await m.query(
              "SELECT set_config('ot.deletion_operation',$1,true)",
              [operation]
            );
            await m.query(
              'DELETE FROM role_assignment WHERE id=ANY($1::uuid[])',
              [[own, secondOwn, foreign, late]]
            );
            await m.query('DELETE FROM role_permissions WHERE role_id=$1', [
              role,
            ]);
            await m.query(
              'DELETE FROM app_scope_permissions WHERE app_scope_id=ANY($1::uuid[])',
              [[scope, secondScope]]
            );
            await m.query('DELETE FROM role WHERE id=$1', [role]);
            await m.query('DELETE FROM permission WHERE id=$1', [permission]);
            await m.query('DELETE FROM app_scope WHERE id=ANY($1::uuid[])', [
              [scope, secondScope],
            ]);
            await m.query(
              'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
              [operation]
            );
          });
          expect(await counts(db, tables)).toEqual(baseline);
        }
        if (authDb?.isInitialized && operation) {
          await authDb.query(
            'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
            [operation]
          );
          await authDb.query(
            'DELETE FROM account_deletion_operations WHERE id=$1',
            [operation]
          );
          expect(
            await counts(authDb, [
              'account_deletion_operations',
              'account_deletion_write_fence',
            ])
          ).toEqual(authBaseline);
        }
      } finally {
        client?.close();
        authClient?.close();
        await permissionsApp?.close();
        await authApp?.close();
        if (db?.isInitialized) await db.destroy();
        if (authDb?.isInitialized) await authDb.destroy();
        if (oldKey === undefined)
          delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
        else process.env['ACCOUNT_DELETION_PROOF_KEY'] = oldKey;
      }
    }, 30000);
    it('drains assignment writers, removes both owned profile subjects, and retains shared and counterpart authorization', async () => {
      const check = (subject: string) =>
        call(RoleCommands.CheckPermission, {
          profileId: subject,
          permission: 'd05.read',
          appScopeId: scope,
          profileAppScope: 'client-interface',
        });
      expect(await check(profile)).toBe(true);
      expect(await check(otherProfile)).toBe(true);
      await expect(
        call(
          PermissionCommands.FENCE_ACCOUNT_DELETION,
          await authority.issueGrant(operation, 'social', 'fence')
        )
      ).rejects.toBeTruthy();
      const writer = db.createQueryRunner();
      await writer.connect();
      await writer.startTransaction();
      await writer.query(
        'INSERT INTO role_assignment(id,"profileId","roleId","appScopeId") VALUES($1,$2,$3,$4)',
        [late, profile, role, secondScope]
      );
      const fenceGrant = await authority.issueGrant(
        operation,
        'permissions',
        'fence'
      );
      const fencing = call(
        PermissionCommands.FENCE_ACCOUNT_DELETION,
        fenceGrant
      ).then(
        (value) => ({ value }),
        (error) => ({ error })
      );
      try {
        let waiting = false;
        for (let i = 0; i < 60; i++) {
          if (
            Number(
              (
                await db.query(
                  "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'"
                )
              )[0].count
            ) > 0
          ) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        expect(waiting).toBe(true);
        await writer.commitTransaction();
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
      }
      expect(await fencing).toMatchObject({
        value: { verified: true, remaining: 3 },
      });
      await authority.acknowledge(fenceGrant);
      await expect(
        db.query('UPDATE role_assignment SET "profileId"=$2 WHERE id=$1', [
          own,
          otherProfile,
        ])
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      await expect(
        db.query('UPDATE role_assignment SET "profileId"=$2 WHERE id=$1', [
          foreign,
          profile,
        ])
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      // The other owner fences are explicit fixture premises, not claims that they ran.
      await authDb.query(
        'UPDATE account_deletion_operations SET "ownerProgress"=$2::jsonb WHERE id=$1',
        [
          operation,
          JSON.stringify(
            Object.fromEntries(
              [
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
              ].map((owner) => [owner, { fence: true }])
            )
          ),
        ]
      );
      const erase = await authority.issueGrant(
        operation,
        'permissions',
        'erase'
      );
      await db.query(
        "CREATE FUNCTION d05_test_delete_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'D05_INJECTED_DELETE_FAILURE'; END $$"
      );
      await db.query(
        'CREATE TRIGGER d05_test_delete_fault AFTER DELETE ON role_assignment FOR EACH ROW EXECUTE FUNCTION d05_test_delete_fail()'
      );
      try {
        await expect(
          call(PermissionCommands.ERASE_ACCOUNT_DELETION, erase)
        ).rejects.toBeTruthy();
        expect(
          Number(
            (await db.query('SELECT count(*) FROM role_assignment'))[0].count
          )
        ).toBe(4);
      } finally {
        await db.query('DROP TRIGGER d05_test_delete_fault ON role_assignment');
        await db.query('DROP FUNCTION d05_test_delete_fail()');
      }
      expect(
        await call(PermissionCommands.ERASE_ACCOUNT_DELETION, erase)
      ).toEqual({ verified: true, remaining: 0 });
      await authority.acknowledge(erase);
      expect(
        await call(PermissionCommands.ERASE_ACCOUNT_DELETION, erase)
      ).toEqual({ verified: true, remaining: 0 });
      expect(await snapshots()).toEqual(sharedBefore);
      expect(
        await db.query(
          'SELECT to_jsonb(a) AS row FROM role_assignment a WHERE id=$1',
          [foreign]
        )
      ).toEqual(foreignBefore);
      expect(await check(profile)).toBe(false);
      expect(await check(secondProfile)).toBe(false);
      expect(await check(otherProfile)).toBe(true);
      expect(
        await call(
          PermissionCommands.READBACK_ACCOUNT_DELETION,
          await authority.issueGrant(operation, 'permissions', 'readback')
        )
      ).toEqual({ verified: true, remaining: 0 });
    }, 30000);
  }
);
