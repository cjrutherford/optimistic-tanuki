import { AccountDeletionProviderGrantsAdapter } from '../../../authentication/src/account-deletion/account-deletion-provider-grants.adapter';
import type { DeletionNonOrmAdapter } from '../../../authentication/src/account-deletion/account-deletion-non-orm.service';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import { ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND } from '@optimistic-tanuki/models';
import {
  AccountDeletionSnapshotController,
  ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
  AccountExportOwnerSpoolService,
} from '@optimistic-tanuki/storage';
import { ProfileAccountDeletionOwnerController } from '../../../profile/src/app/account-deletion-owner.controller';
import { ProfileAccountExportSnapshotService } from '../../../profile/src/app/account-export-snapshot.service';
/** D26 component proof with explicit other-owner receipt premises; NOT D27 global acceptance. */
import { randomBytes, randomUUID } from 'node:crypto';
import {
  mkdtemp,
  writeFile,
  readdir,
  rm,
  readFile,
  unlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DataSource } from 'typeorm';
import { ACCOUNT_DELETION_OWNERS } from '@optimistic-tanuki/models';
import { AccountDeletionAuthorityClient } from '@optimistic-tanuki/storage';
import { DeletionOwnerFixture } from './deletion-owner.fixture';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';
import { AccountDeletionOperationEntity } from '../../../authentication/src/account-deletion/account-deletion-operation.entity';
import { AccountDeletionController } from '../../../authentication/src/account-deletion/account-deletion.controller';
import { AccountDeletionFinalizerService } from '../../../authentication/src/account-deletion/account-deletion-finalizer.service';
import {
  AccountDeletionNonOrmService,
  DELETION_NON_ORM_STORES,
} from '../../../authentication/src/account-deletion/account-deletion-non-orm.service';
import { AccountDeletionOwnerService } from '../../../authentication/src/account-deletion/account-deletion-owner.service';
import { AppService } from '../../../authentication/src/app/app.service';
import { ProfileAccountDeletionOwnerService } from '../../../profile/src/app/account-deletion-owner.service';
import { ProfileAccountDeletionFinalizerService } from '../../../profile/src/app/account-deletion-finalizer.service';
import { ProfileAuditErasureService } from '../../../profile/src/app/audit-erasure.service';
import loadDatabase from '../../../profile/src/app/loadDatabase';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
(process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture'
  ? describe
  : describe.skip)(
  'D26 real guarded Auth/Profile root finalization component',
  () => {
    const f = new DeletionOwnerFixture();
    let profile: ProfileAccountDeletionOwnerService;
    let finalProfile: ProfileAccountDeletionFinalizerService;
    let finalAuth: AccountDeletionFinalizerService;
    let profileClient: any;
    let snapshots: ProfileAccountExportSnapshotService;
    let key: string, otherKey: string, dir: string;
    let files: Map<string, DeletionNonOrmAdapter>;
    const count = async (t: string, id: string) =>
      (
        await f.authDb.query(
          `SELECT count(*)::text n FROM "${t}" WHERE id=$1`,
          [id]
        )
      )[0].n;
    beforeAll(async () => {
      process.env['ACCOUNT_DELETION_PROOF_KEY'] =
        randomBytes(48).toString('base64url');
      const common = {
        type: 'postgres' as const,
        host: '127.0.0.1',
        port: Number(process.env['POSTGRES_PORT']),
        username: 'd00',
        password: process.env['POSTGRES_PASSWORD'],
        synchronize: false,
        migrationsRun: false,
        logging: false,
      };
      f.authDb = new DataSource({
        ...common,
        database: 'd00',
        entities: [AccountDeletionOperationEntity],
      });
      f.db = new DataSource({
        ...loadDatabase({ get: () => ({}) } as never),
        ...common,
        database: 'd26_profile',
      });
      await f.authDb.initialize();
      await f.db.initialize();
      for (const db of [f.authDb, f.db])
        for (const t of await db.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'migrations'"
        ))
          expect(
            (await db.query(`SELECT count(*)::text n FROM "${t.tablename}"`))[0]
              .n
          ).toBe('0');
      for (const [a, p, name] of [
        [f.account, f.profile, 'OWN_PRIVATE'],
        [f.other, f.otherProfile, 'COUNTERPART'],
      ]) {
        await f.authDb.query(
          'INSERT INTO user_entity(id,email,"firstName","lastName",password,bio) VALUES($1,$2,$3::text,$3::text,$3::text,$3::text)',
          [a, a + '@example.test', name]
        );
        const kid = randomUUID();
        await f.authDb.query(
          'INSERT INTO key_datum(id,public,salt,"userId") VALUES($1,$2,$3,$4)',
          [kid, Buffer.from(name), name, a]
        );
        await f.authDb.query(
          'UPDATE user_entity SET "keyDataId"=$2 WHERE id=$1',
          [a, kid]
        );
        await f.authDb.query(
          'INSERT INTO oauth_provider(id,provider,"providerUserId","userId") VALUES($1,$2,$3,$4)',
          [randomUUID(), 'google', randomUUID(), a]
        );
        if (a === f.account) key = kid;
        else otherKey = kid;
        await f.db.query(
          "INSERT INTO profile(id,\"userId\",\"appScope\",\"profileName\",\"profilePic\",\"coverPic\",bio,location,occupation,interests,skills) VALUES($1,$2,$3,$4,'','','','','','','')",
          [p, a, 'local-hub', name]
        );
      }
      await f.authDb.query(
        'INSERT INTO token(id,"tokenData","userId","profileId") VALUES($1,$2,$3,$4)',
        [randomUUID(), 'SYNTHETIC_SESSION', f.account, f.profile]
      );
      f.authority = new AccountDeletionAuthorityService(
        f.authDb.getRepository(AccountDeletionOperationEntity),
        f.authDb
      );
      const client = await f.serve(
        [AccountDeletionController],
        [
          { provide: AccountDeletionAuthorityService, useValue: f.authority },
          {
            provide: AppService,
            useValue: {
              validateToken: () => {
                throw Error('NO_SESSION');
              },
            },
          },
        ]
      );
      const authorityClient = new AccountDeletionAuthorityClient(client);
      profile = new ProfileAccountDeletionOwnerService(
        f.db,
        authorityClient,
        new ProfileAuditErasureService(f.db)
      );
      finalProfile = new ProfileAccountDeletionFinalizerService(
        f.db,
        authorityClient
      );
      finalAuth = new AccountDeletionFinalizerService(f.authority, f.authDb);
      const snapshotSpools = new AccountExportOwnerSpoolService();
      snapshots = new ProfileAccountExportSnapshotService(
        {
          captureAccount: () => {
            throw Error('NO_CAPTURE_EXPECTED');
          },
        } as never,
        snapshotSpools,
        client
      );
      profileClient = await f.serve(
        [
          ProfileAccountDeletionOwnerController,
          AccountDeletionSnapshotController,
        ],
        [
          { provide: ProfileAccountDeletionOwnerService, useValue: profile },
          {
            provide: ProfileAccountDeletionFinalizerService,
            useValue: finalProfile,
          },
          {
            provide: ACCOUNT_DELETION_SNAPSHOT_OPTIONS,
            useValue: {
              owner: 'profile',
              snapshot: snapshots,
              spool: snapshotSpools,
              authority: authorityClient,
            },
          },
        ]
      );

      f.operation = (
        await f.authority.accept(f.account, 'local-hub', randomUUID())
      ).id;
      await f.authority.claim(f.operation);
      const fence = await f.authority.issueGrant(
        f.operation,
        'profile',
        'fence'
      );
      await f.call(profileClient, ProfileCommands.FenceAccountDeletion, fence);
      expect(
        await f.call(
          profileClient,
          ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND,
          fence
        )
      ).toEqual({ purged: true, remaining: 0 });
      await f.authority.acknowledge(fence);
      dir = await mkdtemp(join(tmpdir(), 'ot-d26-private-'));
      files = new Map();
      for (const store of DELETION_NON_ORM_STORES) {
        if (store === 'provider-grants') continue;
        const target = join(dir, store + '.own');
        await writeFile(target, 'SYNTHETIC_CONTROLLED_ADAPTER_DATA');
        files.set(store, {
          purge: async () => {
            try {
              await unlink(target);
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
            }
          },
          readback: async () => {
            try {
              await readFile(target);
              return 1;
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 0;
              throw e;
            }
          },
        });
      }
      await writeFile(join(dir, 'counterpart'), 'COUNTERPART_KEEP');
    }, 30000);
    afterAll(async () => {
      try {
        if (f.authDb?.isInitialized) {
          await f.authDb.transaction(async (m) => {
            await m.query(
              "SELECT set_config('ot.deletion_operation',$1,true)",
              [f.operation]
            );
            await m.query(
              'UPDATE key_datum SET "userId"=NULL WHERE "userId"=ANY($1::uuid[])',
              [[f.account, f.other]]
            );
            await m.query('DELETE FROM token WHERE "userId"=ANY($1::uuid[])', [
              [f.account, f.other],
            ]);
            await m.query('DELETE FROM user_entity WHERE id=ANY($1::uuid[])', [
              [f.account, f.other],
            ]);
            await m.query('DELETE FROM key_datum WHERE id=ANY($1::uuid[])', [
              [key, otherKey].filter(Boolean),
            ]);
          });
        }
      } finally {
        if (!f.operation) f.operation = randomUUID();
        await snapshots?.onModuleDestroy();
        await f.close();
        if (dir) await rm(dir, { recursive: true, force: true });
      }
    }, 30000);
    it('retains roots when cleanup is unavailable, then gates ordered root/key removal and preserves counterparts', async () => {
      expect(
        (
          await f.authDb.query('SELECT revoked FROM token WHERE "userId"=$1', [
            f.account,
          ])
        )[0].revoked
      ).toBe(true);
      await expect(
        f.authority.issueGrant(f.operation, 'profile', 'finalize')
      ).rejects.toThrow('ACCOUNT_DELETION_FINALIZATION_PENDING');
      expect(await count('user_entity', f.account)).toBe('1');
      expect(await count('key_datum', key)).toBe('1');
      // Explicit premises only: this fixture does not execute the ten other owner services.
      await f.authDb.query(
        'UPDATE account_deletion_operations SET "ownerProgress"=$2::jsonb WHERE id=$1',
        [
          f.operation,
          JSON.stringify(
            Object.fromEntries(
              ACCOUNT_DELETION_OWNERS.map((o) => [
                o,
                { fence: true, erase: true, readback: true },
              ])
            )
          ),
        ]
      );
      const erase = await f.authority.issueGrant(
        f.operation,
        'profile',
        'erase'
      );
      await profile.execute(erase, 'erase');
      await f.authority.acknowledge(erase);
      await profile.execute(
        await f.authority.issueGrant(f.operation, 'profile', 'readback'),
        'readback'
      );
      const authOwner = new AccountDeletionOwnerService(f.authority, f.authDb, {
        purgeAccount: async () => ({ removed: 0, failed: 0 }),
      } as never);
      // This private fixture has no artifact jobs/bytes; only the D01 retention seam is stubbed.
      const authErase = await f.authority.issueGrant(
        f.operation,
        'authentication',
        'erase'
      );
      await authOwner.erase(authErase);
      await f.authority.acknowledge(authErase);
      expect(
        (
          await authOwner.readback(
            await f.authority.issueGrant(
              f.operation,
              'authentication',
              'readback'
            )
          )
        ).complete
      ).toBe(true);

      const unavailable = new AccountDeletionNonOrmService(
        f.authority,
        new Map()
      );
      expect(
        (
          await unavailable.execute(
            await f.authority.issueGrant(
              f.operation,
              'authentication',
              'readback'
            )
          )
        ).verified
      ).toBe(false);
      await expect(
        f.authority.issueGrant(f.operation, 'profile', 'finalize')
      ).rejects.toThrow('ACCOUNT_DELETION_FINALIZATION_PENDING');
      // Seven controlled files exercise only the adapter protocol. The provider
      // adapter uses real D01 readback against migrated physical tables.
      files.set(
        'provider-grants',
        new AccountDeletionProviderGrantsAdapter(authOwner)
      );
      expect(
        (
          await f.authDb.query(
            'SELECT count(*)::int n FROM oauth_provider WHERE "userId"=$1',
            [f.account]
          )
        )[0].n
      ).toBe(0);
      expect(
        (
          await f.authDb.query(
            'SELECT count(*)::int n FROM oauth_provider WHERE "userId"=$1',
            [f.other]
          )
        )[0].n
      ).toBe(1);
      const verified = new AccountDeletionNonOrmService(f.authority, files);
      expect(
        (
          await verified.execute(
            await f.authority.issueGrant(
              f.operation,
              'authentication',
              'readback'
            )
          )
        ).verified
      ).toBe(true);
      expect(await readdir(dir)).toEqual(['counterpart']);
      await expect(
        f.authority.issueGrant(f.operation, 'authentication', 'finalize')
      ).rejects.toThrow('ACCOUNT_DELETION_FINALIZATION_ORDER');
      const p = await f.authority.issueGrant(
        f.operation,
        'profile',
        'finalize'
      );
      expect(
        await f.call(profileClient, ProfileCommands.FinalizeAccountDeletion, p)
      ).toEqual({
        finalized: true,
        remaining: 0,
      });
      expect(
        await f.call(profileClient, ProfileCommands.FinalizeAccountDeletion, p)
      ).toEqual({
        finalized: true,
        remaining: 0,
      });
      await f.authority.acknowledge(p);
      const a = await f.authority.issueGrant(
        f.operation,
        'authentication',
        'finalize'
      );
      await f.authDb.query(
        "CREATE FUNCTION d26_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'D26_INJECTED';END $$"
      );
      await f.authDb.query(
        'CREATE TRIGGER d26_fault AFTER DELETE ON key_datum FOR EACH ROW EXECUTE FUNCTION d26_fault()'
      );
      await expect(finalAuth.finalize(a)).rejects.toThrow('D26_INJECTED');
      expect(await count('user_entity', f.account)).toBe('1');
      expect(await count('key_datum', key)).toBe('1');
      await f.authDb.query('DROP TRIGGER d26_fault ON key_datum');
      await f.authDb.query('DROP FUNCTION d26_fault()');
      // Reconstruct service instances and reclaim the expired lease: no live user session is used.
      await f.authDb.query(
        'UPDATE account_deletion_operations SET "leaseExpiresAt"=clock_timestamp()-interval \'1 second\' WHERE id=$1',
        [f.operation]
      );
      await expect(finalAuth.finalize(a)).rejects.toThrow();
      const lease = await f.authority.claim(f.operation);
      await f.authority.renew(f.operation, lease.attempt, lease.leaseOwner);
      await expect(
        f.authority.issueGrant(f.operation, 'authentication', 'finalize')
      ).rejects.toThrow('ACCOUNT_DELETION_FINALIZATION_PENDING');
      expect(
        (
          await verified.execute(
            await f.authority.issueGrant(
              f.operation,
              'authentication',
              'readback'
            )
          )
        ).verified
      ).toBe(true);
      const reconstructed = new AccountDeletionFinalizerService(
        f.authority,
        f.authDb
      );
      expect(
        (
          await reconstructed.finalize(
            await f.authority.issueGrant(
              f.operation,
              'authentication',
              'finalize'
            )
          )
        ).state
      ).toBe('complete');
      expect(await count('user_entity', f.account)).toBe('0');
      expect(await count('key_datum', key)).toBe('0');
      expect(await count('user_entity', f.other)).toBe('1');
      expect(await count('key_datum', otherKey)).toBe('1');
      expect(
        (
          await f.db.query('SELECT "profileName" FROM profile WHERE id=$1', [
            f.otherProfile,
          ])
        )[0].profileName
      ).toBe('COUNTERPART');
      const ledger = (
        await f.authDb.query(
          'SELECT * FROM account_deletion_operations WHERE id=$1',
          [f.operation]
        )
      )[0];
      expect(ledger.accountId).toBeNull();
      expect(ledger.privateScope).toBeNull();
      expect(ledger.leaseOwner).toBeNull();
      expect(
        Number(
          (
            await f.authDb.query(
              'SELECT count(*)::text n FROM account_deletion_write_fence WHERE "operationId"=$1',
              [f.operation]
            )
          )[0].n
        )
      ).toBeGreaterThan(0);
      await expect(
        f.authDb.query(
          'INSERT INTO user_entity(id,email,"firstName","lastName",password,bio) VALUES($1,$2::text,$2::text,$2::text,$2::text,$2::text)',
          [f.account, 'stale@example.test']
        )
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      await expect(
        f.db.query(
          'INSERT INTO profile(id,"userId","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES($1,$2,$3::text,$3::text,$3::text,$3::text,$3::text,$3::text,$3::text,$3::text)',
          [f.profile, f.account, 'stale']
        )
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');

      expect(JSON.stringify(ledger)).not.toContain(f.profile);
      expect(JSON.stringify(ledger)).not.toContain(f.account);
      expect(await readFile(join(dir, 'counterpart'), 'utf8')).toBe(
        'COUNTERPART_KEEP'
      );
    }, 30000);
  }
);
