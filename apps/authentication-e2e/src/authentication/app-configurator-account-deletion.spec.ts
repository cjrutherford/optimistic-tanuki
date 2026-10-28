import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import {
  ACCOUNT_DELETION_OWNERS,
  DELETED_ACCOUNT_ID as nil,
} from '@optimistic-tanuki/models';
import { AppConfigCommands } from '@optimistic-tanuki/constants';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
import { AccountDeletionOperationEntity } from '../../../authentication/src/account-deletion/account-deletion-operation.entity';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';
import { AccountDeletionController } from '../../../authentication/src/account-deletion/account-deletion.controller';
import { AppService } from '../../../authentication/src/app/app.service';
import loadDatabase from '../../../app-configurator/src/app/loadDatabase';
import { AppConfiguratorAccountDeletionOwnerService } from '../../../app-configurator/src/app/account-deletion-owner.service';
import { AppConfiguratorAccountDeletionOwnerController } from '../../../app-configurator/src/app/account-deletion-owner.controller';
import { AppConfigurationEntity } from '../../../app-configurator/src/configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../../../app-configurator/src/configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../../../app-configurator/src/configurations/entities/app-membership.entity';
import { ConfigurationsController } from '../../../app-configurator/src/configurations/configurations.controller';
import { ConfigurationsService } from '../../../app-configurator/src/app/configurations.service';
import {
  validateAppConfiguratorDispositions,
  APP_CONFIGURATOR_ACCOUNT_EXPORT_INVENTORY,
} from '../../../app-configurator/src/app/app-configurator-account-export-dispositions';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const gated = process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture';
(gated ? describe : describe.skip)(
  'D09 real Auth/App Configurator TCP and two migrated PostgreSQL databases',
  () => {
    const account = randomUUID(),
      profile = randomUUID(),
      profile2 = randomUUID(),
      other = randomUUID(),
      otherProfile = randomUUID(),
      otherProfile2 = randomUUID();
    const context = (a: string, p: string, scope: string) => ({
      ownerUserId: a,
      ownerProfileId: p,
      workspaceId: randomUUID(),
      appInstanceId: randomUUID(),
      appScope: scope,
      membershipId: randomUUID(),
      membershipRole: 'owner' as const,
      membershipStatus: 'active' as const,
    });
    const own = context(account, profile, 'client-interface'),
      second = context(account, profile2, 'local-hub'),
      foreign = context(other, otherProfile, 'local-hub');
    const ids: Record<string, string> = {};
    const created: { table: string; id: string }[] = [];
    let db: DataSource,
      authDb: DataSource,
      authority: AccountDeletionAuthorityService,
      authApp: any,
      app: any,
      authClient: any,
      client: any,
      operation = '';
    let baseline: Record<string, number>,
      authBaseline: Record<string, number>,
      foreignConfig: any,
      foreignInstance: any,
      foreignMembership: any,
      otherMembership: any,
      foreignPublication: any;
    const oldKey = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    const tables = [
      'app_configuration_entity',
      'app_instances',
      'app_memberships',
      'account_deletion_write_fence',
    ];
    const call = (cmd: string, value: unknown) =>
      firstValueFrom(
        client.send({ cmd }, value).pipe(timeout(20000))
      ) as Promise<any>;
    const row = async (table: string, id: string) =>
      (
        await db.query(
          `SELECT to_jsonb(t) AS row FROM "${table}" t WHERE id=$1`,
          [id]
        )
      )[0]?.row;
    const counts = async (source: DataSource, names: string[]) =>
      Object.fromEntries(
        await Promise.all(
          names.map(async (table) => [
            table,
            Number(
              (
                await source.query(`SELECT count(*) AS n FROM "${table}"`)
              )[0].n
            ),
          ])
        )
      );
    async function port() {
      const s = createServer();
      await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
      const p = (s.address() as any).port;
      await new Promise<void>((r, j) => s.close((e) => (e ? j(e) : r())));
      return p;
    }
    async function serve(controllers: any[], providers: any[]) {
      const m = await Test.createTestingModule({
        controllers,
        providers,
      }).compile();
      const p = await port();
      const app = m.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: p },
        logger: false,
      });
      await app.listen();
      return {
        app,
        client: ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host: '127.0.0.1', port: p },
        }),
      };
    }
    async function seed(table: string, data: Record<string, unknown>) {
      const names = Object.keys(data);
      const r = (
        await db.query(
          `INSERT INTO "${table}" (${names
            .map((n) => `"${n}"`)
            .join(',')}) VALUES (${names
            .map((_, i) => `$${i + 1}`)
            .join(',')}) RETURNING id`,
          Object.values(data)
        )
      )[0];
      created.push({ table, id: r.id });
      return r.id as string;
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
        logging: false,
        extra: { statement_timeout: 15000, lock_timeout: 5000 },
      };
      db = new DataSource({
        ...loadDatabase({ get: () => common } as never),
        ...common,
        database: 'd09_app_configurator',
      });
      authDb = new DataSource({
        ...common,
        database: 'd00',
        entities: [AccountDeletionOperationEntity],
      });
      await Promise.all([db.initialize(), authDb.initialize()]);
      baseline = await counts(db, tables);
      authBaseline = await counts(authDb, [
        'account_deletion_operations',
        'account_deletion_write_fence',
      ]);
      expect(Object.values(baseline).every((n) => n === 0)).toBe(true);
      const physical = await db.query(
        `SELECT table_name AS "table",array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name`
      );
      expect(
        validateAppConfiguratorDispositions(
          db.entityMetadatas,
          APP_CONFIGURATOR_ACCOUNT_EXPORT_INVENTORY,
          physical
        )
      ).toEqual([]);
      const parents = await db.query(
        `SELECT count(*)::text AS n FROM pg_constraint WHERE contype='f' AND confrelid='app_instances'::regclass AND cardinality(conkey)=3`
      );
      expect(parents[0].n).toBe('2');
      authority = new AccountDeletionAuthorityService(
        authDb.getRepository(AccountDeletionOperationEntity),
        authDb
      );
      const a = await serve(
        [AccountDeletionController],
        [
          { provide: AccountDeletionAuthorityService, useValue: authority },
          {
            provide: AppService,
            useValue: {
              validateToken: () => {
                throw Error('NO_SESSION_ALLOWED');
              },
            },
          },
        ]
      );
      authApp = a.app;
      authClient = a.client;
      const logger = {
        log: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      };
      const service = new ConfigurationsService(
        db.getRepository(AppConfigurationEntity),
        db.getRepository(AppInstanceEntity),
        db.getRepository(AppMembershipEntity),
        logger as never
      );
      const owner = new AppConfiguratorAccountDeletionOwnerService(
        db,
        new AccountDeletionAuthorityClient(authClient)
      );
      const execute = owner.execute.bind(owner);
      owner.execute = async (value, action) => {
        try {
          return await execute(value, action);
        } catch (error) {
          console.error(
            'D09 private owner diagnostic',
            action,
            error instanceof Error ? error.message : 'unknown'
          );
          throw error;
        }
      };
      const b = await serve(
        [
          AppConfiguratorAccountDeletionOwnerController,
          ConfigurationsController,
        ],
        [
          {
            provide: AppConfiguratorAccountDeletionOwnerService,
            useValue: owner,
          },
          { provide: ConfigurationsService, useValue: service },
          { provide: Logger, useValue: logger },
        ]
      );
      app = b.app;
      client = b.client;
      operation = (await authority.accept(account, 'local-hub', randomUUID()))
        .id;
      await authority.claim(operation);
      await authority.recordProfileScope(
        await authority.issueGrant(operation, 'profile', 'fence'),
        { currentProfileIds: [profile, profile2].sort(), legacyProfileIds: [] }
      );
      for (const ctx of [own, second, foreign]) {
        await seed('app_instances', {
          id: ctx.appInstanceId,
          workspaceId: ctx.workspaceId,
          appScope: ctx.appScope,
          ownerUserId: ctx.ownerUserId,
          ownerProfileId: ctx.ownerProfileId,
          status: 'active',
        });
        await seed('app_memberships', {
          id: ctx.membershipId,
          workspaceId: ctx.workspaceId,
          appInstanceId: ctx.appInstanceId,
          appScope: ctx.appScope,
          userId: ctx.ownerUserId,
          profileId: ctx.ownerProfileId,
          role: 'owner',
          status: 'active',
        });
        const data = await call(AppConfigCommands.Create, {
          context: ctx,
          dto: {
            name: `config-${ctx.appInstanceId}`,
            description:
              ctx === foreign
                ? 'Counterpart description'
                : 'D09_PRIVATE_DESCRIPTION',
            domain:
              ctx === foreign
                ? 'counterpart-d09.example.test'
                : ctx === own
                ? 'own-d09.example.test'
                : 'second-d09.example.test',
            landingPage: { layout: 'single-column', sections: [] },
            routes: [],
            features:
              ctx === foreign
                ? { counterpartQuote: profile }
                : { marker: 'D09_PRIVATE_FEATURE' },
            theme: {
              marker:
                ctx === foreign ? 'COUNTERPART_THEME' : 'D09_PRIVATE_THEME',
            },
            manifest: {
              schemaVersion: 1,
              surfaceType: 'community',
              capabilities: { 'forum.discussions': { enabled: true } },
            },
            active: true,
            accessPolicy: 'public',
          },
        });
        ids[
          ctx === own
            ? 'ownConfig'
            : ctx === second
            ? 'secondConfig'
            : 'foreignConfig'
        ] = data.id;
        created.push({ table: 'app_configuration_entity', id: data.id });
        await call(AppConfigCommands.Publish, {
          id: data.id,
          dto: {
            expectedRevision: data.revision,
            releaseNotes: 'D09 release proof',
          },
          context: ctx,
        });
      }
      // Published-domain lookup deliberately reads immutable release snapshots, even after the draft moves.
      await db.query(
        "UPDATE app_configuration_entity SET domain='draft-d09.example.test',active=false WHERE id=$1",
        [ids['ownConfig']]
      );
      expect(
        await call(AppConfigCommands.GetPublishedByDomain, {
          domain: 'own-d09.example.test',
        })
      ).toMatchObject({ domain: 'own-d09.example.test' });
      await db.query(
        "UPDATE app_instances SET status='suspended' WHERE id=$1",
        [second.appInstanceId]
      );
      await db.query(
        "UPDATE app_memberships SET status='revoked' WHERE id=$1",
        [second.membershipId]
      );
      ids['ownForeignMembership'] = await seed('app_memberships', {
        workspaceId: foreign.workspaceId,
        appInstanceId: foreign.appInstanceId,
        appScope: foreign.appScope,
        userId: account,
        profileId: profile2,
        role: 'member',
        status: 'denied',
      });
      ids['foreignMembership'] = await seed('app_memberships', {
        workspaceId: own.workspaceId,
        appInstanceId: own.appInstanceId,
        appScope: own.appScope,
        userId: other,
        profileId: otherProfile,
        role: 'member',
        status: 'active',
      });
      ids['otherMembership'] = await seed('app_memberships', {
        workspaceId: own.workspaceId,
        appInstanceId: own.appInstanceId,
        appScope: own.appScope,
        userId: other,
        profileId: otherProfile2,
        role: 'member',
        status: 'revoked',
      });
      foreignConfig = await row(
        'app_configuration_entity',
        ids['foreignConfig']
      );
      foreignInstance = await row('app_instances', foreign.appInstanceId);
      foreignMembership = await row(
        'app_memberships',
        ids['foreignMembership']
      );
      otherMembership = await row('app_memberships', ids['otherMembership']);
      foreignPublication = await call(AppConfigCommands.GetPublishedByDomain, {
        domain: 'counterpart-d09.example.test',
      });
    }, 30000);
    afterAll(async () => {
      try {
        if (db?.isInitialized) {
          await db.query(
            'DROP TRIGGER IF EXISTS d09_fault ON app_configuration_entity'
          );
          await db.query('DROP FUNCTION IF EXISTS d09_fault()');
          await db.transaction(async (m) => {
            if (operation)
              await m.query(
                "SELECT set_config('ot.deletion_operation',$1,true)",
                [operation]
              );
            for (const table of [
              'app_configuration_entity',
              'app_memberships',
              'app_instances',
            ])
              await m.query(`DELETE FROM "${table}" WHERE id=ANY($1::uuid[])`, [
                created.filter((r) => r.table === table).map((r) => r.id),
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
          expect(await counts(authDb, Object.keys(authBaseline))).toEqual(
            authBaseline
          );
        }
      } finally {
        client?.close();
        authClient?.close();
        await app?.close();
        await authApp?.close();
        if (db?.isInitialized) await db.destroy();
        if (authDb?.isInitialized) await authDb.destroy();
        if (oldKey === undefined)
          delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
        else process.env['ACCOUNT_DELETION_PROOF_KEY'] = oldKey;
      }
    }, 30000);
    it('fails closed on attribution conflicts, drains writers, removes saved payloads and preserves counterpart participation', async () => {
      await expect(
        call(
          AppConfigCommands.FENCE_ACCOUNT_DELETION,
          await authority.issueGrant(operation, 'workspace', 'fence')
        )
      ).rejects.toBeTruthy();
      const fence = await authority.issueGrant(
        operation,
        'app-configurator',
        'fence'
      );
      // A mixed account/profile row and a valid composite FK with a conflicting owner pair both block acceptance.
      await db.query(
        'UPDATE app_configuration_entity SET "ownerProfileId"=$2 WHERE id=$1',
        [ids['ownConfig'], otherProfile]
      );
      await expect(
        call(AppConfigCommands.FENCE_ACCOUNT_DELETION, fence)
      ).rejects.toBeTruthy();
      await db.query(
        'UPDATE app_configuration_entity SET "ownerProfileId"=$2 WHERE id=$1',
        [ids['ownConfig'], profile]
      );
      await db.query(
        'UPDATE app_configuration_entity SET "appInstanceId"=$2,"workspaceId"=$3,"appScope"=$4 WHERE id=$1',
        [
          ids['ownConfig'],
          foreign.appInstanceId,
          foreign.workspaceId,
          foreign.appScope,
        ]
      );
      await expect(
        call(AppConfigCommands.FENCE_ACCOUNT_DELETION, fence)
      ).rejects.toBeTruthy();
      await db.query(
        'UPDATE app_configuration_entity SET "appInstanceId"=$2,"workspaceId"=$3,"appScope"=$4 WHERE id=$1',
        [ids['ownConfig'], own.appInstanceId, own.workspaceId, own.appScope]
      );
      expect(
        (
          await db.query(
            'SELECT count(*)::text AS n FROM account_deletion_write_fence WHERE "operationId"=$1',
            [operation]
          )
        )[0].n
      ).toBe('0');
      const writer = db.createQueryRunner();
      await writer.connect();
      await writer.startTransaction();
      await writer.query(
        'UPDATE app_configuration_entity SET revision=revision WHERE id=$1',
        [ids['ownConfig']]
      );
      let finished = false;
      const pending = call(
        AppConfigCommands.FENCE_ACCOUNT_DELETION,
        fence
      ).finally(() => {
        finished = true;
      });
      try {
        let waiting = false;
        for (let i = 0; i < 80; i++) {
          if (
            Number(
              (
                await db.query(
                  "SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'"
                )
              )[0].n
            )
          ) {
            waiting = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 20));
        }
        expect(waiting).toBe(true);
        expect(finished).toBe(false);
        await writer.commitTransaction();
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
      }
      expect(await pending).toMatchObject({ verified: true });
      await authority.acknowledge(fence);
      for (const [sql, args] of [
        [
          'UPDATE app_configuration_entity SET "ownerUserId"=$2,"ownerProfileId"=$3 WHERE id=$1',
          [ids['ownConfig'], other, otherProfile],
        ],
        [
          'UPDATE app_configuration_entity SET "ownerUserId"=$2,"ownerProfileId"=$3 WHERE id=$1',
          [ids['foreignConfig'], account, profile],
        ],
        [
          'UPDATE app_memberships SET "userId"=$2,"profileId"=$3 WHERE id=$1',
          [ids['foreignMembership'], account, profile],
        ],
      ] as [string, unknown[]][])
        await expect(db.query(sql, args)).rejects.toThrow(
          'ACCOUNT_DELETION_FENCED'
        );
      // Other owner fences are fixture premises rather than claims that the full coordinator ran.
      await authDb.query(
        'UPDATE account_deletion_operations SET "ownerProgress"=$2::jsonb WHERE id=$1',
        [
          operation,
          JSON.stringify(
            Object.fromEntries(
              ACCOUNT_DELETION_OWNERS.map((o) => [o, { fence: true }])
            )
          ),
        ]
      );
      const erase = await authority.issueGrant(
        operation,
        'app-configurator',
        'erase'
      );
      await db.query(
        "CREATE FUNCTION d09_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'D09_INJECTED';END $$"
      );
      await db.query(
        'CREATE TRIGGER d09_fault AFTER DELETE ON app_configuration_entity FOR EACH ROW EXECUTE FUNCTION d09_fault()'
      );
      await expect(
        call(AppConfigCommands.ERASE_ACCOUNT_DELETION, erase)
      ).rejects.toBeTruthy();
      expect(
        (await row('app_configuration_entity', ids['ownConfig'])).description
      ).toBe('D09_PRIVATE_DESCRIPTION');
      await db.query('DROP TRIGGER d09_fault ON app_configuration_entity');
      await db.query('DROP FUNCTION d09_fault()');
      expect(
        await call(AppConfigCommands.ERASE_ACCOUNT_DELETION, erase)
      ).toEqual({ verified: true, remaining: 0 });
      expect(
        await call(AppConfigCommands.ERASE_ACCOUNT_DELETION, erase)
      ).toEqual({ verified: true, remaining: 0 });
      await authority.acknowledge(erase);
      expect(
        await call(
          AppConfigCommands.READBACK_ACCOUNT_DELETION,
          await authority.issueGrant(operation, 'app-configurator', 'readback')
        )
      ).toEqual({ verified: true, remaining: 0 });
      expect(
        await row('app_configuration_entity', ids['ownConfig'])
      ).toBeUndefined();
      expect(
        await row('app_configuration_entity', ids['secondConfig'])
      ).toBeUndefined();
      expect(await row('app_instances', second.appInstanceId)).toBeUndefined();
      expect(await row('app_memberships', own.membershipId)).toBeUndefined();
      expect(
        await row('app_memberships', ids['ownForeignMembership'])
      ).toBeUndefined();
      expect(await row('app_instances', own.appInstanceId)).toMatchObject({
        id: own.appInstanceId,
        workspaceId: own.workspaceId,
        ownerUserId: nil,
        ownerProfileId: nil,
        status: 'active',
      });
      expect(await row('app_memberships', ids['foreignMembership'])).toEqual(
        foreignMembership
      );
      expect(await row('app_memberships', ids['otherMembership'])).toEqual(
        otherMembership
      );
      expect(await row('app_instances', foreign.appInstanceId)).toEqual(
        foreignInstance
      );
      expect(
        await row('app_configuration_entity', ids['foreignConfig'])
      ).toEqual(foreignConfig);
      await expect(
        call(AppConfigCommands.GetPublishedByDomain, {
          domain: 'own-d09.example.test',
        })
      ).rejects.toBeTruthy();
      await expect(
        call(AppConfigCommands.GetPublishedByDomain, {
          domain: 'second-d09.example.test',
        })
      ).rejects.toBeTruthy();
      expect(
        await call(AppConfigCommands.GetPublishedByDomain, {
          domain: 'counterpart-d09.example.test',
        })
      ).toEqual(foreignPublication);
      await expect(
        db.query(
          'UPDATE app_instances SET "ownerUserId"=$2,"ownerProfileId"=$3 WHERE id=$1',
          [own.appInstanceId, other, otherProfile]
        )
      ).rejects.toThrow('APP_CONFIGURATOR_DELETED_STEWARDSHIP');
      const staleId = randomUUID();
      created.push({ table: 'app_configuration_entity', id: staleId });
      await expect(
        db.query(
          'INSERT INTO app_configuration_entity(id,name,"workspaceId","appInstanceId","ownerUserId","ownerProfileId","appScope","landingPage") VALUES($1,\'STALE_PRIVATE_CONFIG\',$2,$3,$4,$5,$6,\'{"private":"stale"}\'::jsonb)',
          [
            staleId,
            own.workspaceId,
            own.appInstanceId,
            other,
            otherProfile,
            own.appScope,
          ]
        )
      ).rejects.toThrow('APP_CONFIGURATOR_DELETED_CONFIGURATION');
      const staleMembership = randomUUID();
      created.push({ table: 'app_memberships', id: staleMembership });
      await expect(
        db.query(
          'INSERT INTO app_memberships(id,"workspaceId","appInstanceId","appScope","userId","profileId",role,status) VALUES($1,$2,$3,$4,$5,$6,\'owner\',\'active\')',
          [
            staleMembership,
            own.workspaceId,
            own.appInstanceId,
            own.appScope,
            account,
            profile,
          ]
        )
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      // The foreign quote containing an equal-looking profile UUID remains counterpart content; never substring-scrub it.
      expect(
        (await row('app_configuration_entity', ids['foreignConfig'])).features
          .counterpartQuote
      ).toBe(profile);
      await db.query(
        "UPDATE app_memberships SET status='suspended' WHERE id=$1",
        [ids['foreignMembership']]
      );
      await db.query('DELETE FROM app_memberships WHERE id=$1', [
        ids['otherMembership'],
      ]);
      expect(
        await call(AppConfigCommands.Update, {
          id: ids['foreignConfig'],
          dto: {
            expectedRevision: foreignConfig.revision,
            description: 'Counterpart edited',
          },
          context: foreign,
        })
      ).toMatchObject({ description: 'Counterpart edited' });
    }, 60000);
  }
);
