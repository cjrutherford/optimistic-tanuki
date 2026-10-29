import { randomUUID, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource } from 'typeorm';
import { AccountDeletionOperationEntity } from '../../../authentication/src/account-deletion/account-deletion-operation.entity';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';
import { AccountDeletionController } from '../../../authentication/src/account-deletion/account-deletion.controller';
import { AppService } from '../../../authentication/src/app/app.service';
import { ProfileCommands } from '@optimistic-tanuki/profile-contracts';
import { AccountDeletionGrant } from '@optimistic-tanuki/models';
import {
  AccountDeletionAuthorityClient,
  AccountDeletionWriteFenceEntity,
} from '@optimistic-tanuki/storage';
import { Profile } from '../../../profile/src/profiles/entities/profile.entity';
import { Timeline } from '../../../profile/src/timelines/entities/timeline.entity';
import { GuardianProfileActivity } from '../../../profile/src/profiles/entities/guardian-profile-activity.entity';
import { ProfileAuditErasureService } from '../../../profile/src/app/audit-erasure.service';
import { ProfileAccountDeletionOwnerService } from '../../../profile/src/app/account-deletion-owner.service';
import { ProfileAccountDeletionOwnerController } from '../../../profile/src/app/account-deletion-owner.controller';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const gated = process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture';
(gated ? describe : describe.skip)(
  'D02 Profile owner with real PostgreSQL and Auth/Profile TCP',
  () => {
    const account = randomUUID(),
      other = randomUUID();
    const first = randomUUID(),
      late = randomUUID(),
      counterpart = randomUUID();
    const ownGoal = randomUUID(),
      otherGoal = randomUUID(),
      ownProject = randomUUID(),
      otherProject = randomUUID(),
      ownTimeline = randomUUID(),
      otherTimeline = randomUUID();
    const auditA = randomUUID(),
      auditB = randomUUID();
    const tables = [
      'profile',
      'timeline',
      'goal',
      'project',
      'guardian_profile_activity',
      'account_deletion_write_fence',
    ];
    let authDb: DataSource,
      db: DataSource,
      authority: AccountDeletionAuthorityService,
      operationId: string;
    let authApp: any,
      profileApp: any,
      authClient: any,
      profileClient: any,
      baseline: Record<string, number>;
    let readGrant: AccountDeletionGrant;
    const oldKey = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    const call = (cmd: string, grant: AccountDeletionGrant) =>
      firstValueFrom(
        profileClient.send({ cmd }, grant).pipe(timeout(8000))
      ) as Promise<any>;
    const counts = async () =>
      Object.fromEntries(
        await Promise.all(
          tables.map(async (t) => [
            t,
            (
              await db.query(`SELECT count(*)::int AS count FROM "${t}"`)
            )[0].count,
          ])
        )
      );
    const port = async () => {
      const server = createServer();
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      const a = server.address();
      if (!a || typeof a === 'string') throw Error('PORT');
      const n = a.port;
      await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
      return n;
    };
    const insertProfile = (
      query: (s: string, p: unknown[]) => Promise<unknown>,
      id: string,
      owner: string,
      scope: string
    ) =>
      query(
        "INSERT INTO profile (id,\"userId\",\"appScope\",\"profileName\",\"profilePic\",\"coverPic\",bio,location,occupation,interests,skills) VALUES ($1,$2,$3,'Private name','private-photo','private-cover','Private bio','location','occupation','interests','skills')",
        [id, owner, scope]
      );
    beforeAll(async () => {
      process.env['ACCOUNT_DELETION_PROOF_KEY'] =
        randomBytes(48).toString('base64url');
      const common = {
        type: 'postgres' as const,
        host: process.env['POSTGRES_HOST'],
        port: Number(process.env['POSTGRES_PORT']),
        username: process.env['POSTGRES_USER'],
        password: process.env['POSTGRES_PASSWORD'],
        synchronize: false,
        migrationsRun: false,
        extra: { statement_timeout: 10000, lock_timeout: 5000 },
      };
      authDb = new DataSource({
        ...common,
        database: process.env['POSTGRES_DB'],
        entities: [AccountDeletionOperationEntity],
      });
      db = new DataSource({
        ...common,
        database: process.env['D02_PROFILE_DB'] ?? 'd02_profile',
        entities: [
          Profile,
          Timeline,
          GuardianProfileActivity,
          AccountDeletionWriteFenceEntity,
        ],
      });
      await authDb.initialize();
      await db.initialize();
      baseline = await counts();
      authority = new AccountDeletionAuthorityService(
        authDb.getRepository(AccountDeletionOperationEntity),
        authDb
      );
      const authPort = await port();
      const authModule = await Test.createTestingModule({
        controllers: [AccountDeletionController],
        providers: [
          { provide: AccountDeletionAuthorityService, useValue: authority },
          {
            provide: AppService,
            useValue: {
              validateToken: () => {
                throw Error('UNEXPECTED_PUBLIC_AUTH');
              },
            },
          },
        ],
      }).compile();
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
      const owner = new ProfileAccountDeletionOwnerService(
        db,
        new AccountDeletionAuthorityClient(authClient),
        new ProfileAuditErasureService(db)
      );
      const module = await Test.createTestingModule({
        controllers: [ProfileAccountDeletionOwnerController],
        providers: [
          { provide: ProfileAccountDeletionOwnerService, useValue: owner },
        ],
      }).compile();
      const profilePort = await port();
      profileApp = module.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: profilePort },
        logger: false,
      });
      await profileApp.listen();
      profileClient = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: profilePort },
      });
      const actual = (
        await db.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public'"
        )
      )
        .map((r: any) => r.tablename)
        .sort();
      expect(actual).toEqual([...tables, 'migrations'].sort());
      const profileFks = await db.query(
        "SELECT count(*)::int AS count FROM pg_constraint WHERE contype='f' AND confrelid='profile'::regclass"
      );
      expect(profileFks[0].count).toBe(3); // All retained legacy profile references point to the current Profile PK.
      await insertProfile(
        db.query.bind(db),
        first,
        account,
        'client-interface'
      );
      await insertProfile(
        db.query.bind(db),
        counterpart,
        other,
        'client-interface'
      );
      operationId = (
        await authority.accept(account, 'client-interface', randomUUID())
      ).id;
      await authority.claim(operationId);
    }, 30000);
    afterAll(async () => {
      try {
        if (db?.isInitialized && operationId)
          await db.transaction(async (m) => {
            await m.query(
              "SELECT set_config('ot.deletion_operation',$1,true)",
              [operationId]
            );
            await m.query(
              'UPDATE project SET "goalsId"=NULL,"timeLineEventsId"=NULL WHERE "userId"=ANY($1::text[])',
              [[account, other]]
            );
            await m.query(
              'UPDATE goal SET "relatedProjectId"=NULL WHERE "userId"=ANY($1::text[])',
              [[account, other]]
            );
            await m.query(
              'UPDATE timeline SET "relatedGoalId"=NULL,"relatedProjectId"=NULL WHERE "userId"=ANY($1::text[])',
              [[account, other]]
            );
            await m.query(
              'DELETE FROM guardian_profile_activity WHERE id=ANY($1::uuid[])',
              [[auditA, auditB]]
            );
            for (const table of ['timeline', 'goal', 'project', 'profile'])
              await m.query(
                `DELETE FROM "${table}" WHERE "userId"=ANY($1::text[])`,
                [[account, other]]
              );
            await m.query(
              'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
              [operationId]
            );
          });
        if (authDb?.isInitialized && operationId) {
          await authDb.query(
            'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
            [operationId]
          );
          await authDb.query(
            'DELETE FROM account_deletion_operations WHERE id=$1',
            [operationId]
          );
        }
        if (db?.isInitialized) expect(await counts()).toEqual(baseline);
        if (authDb?.isInitialized)
          expect(
            await authDb.query(
              'SELECT count(*)::int AS count FROM account_deletion_operations'
            )
          ).toEqual([{ count: 0 }]);
      } finally {
        profileClient?.close();
        authClient?.close();
        await profileApp?.close();
        await authApp?.close();
        if (db?.isInitialized) await db.destroy();
        if (authDb?.isInitialized) await authDb.destroy();
        if (oldKey === undefined)
          delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
        else process.env['ACCOUNT_DELETION_PROOF_KEY'] = oldKey;
      }
    }, 30000);
    it('drains an in-flight creator, rejects the changed scope, then freezes the exact committed identities', async () => {
      const writer = db.createQueryRunner();
      await writer.connect();
      await writer.startTransaction();
      let pending: Promise<any> | undefined;
      try {
        await insertProfile(
          writer.query.bind(writer),
          late,
          account,
          'local-hub'
        );
        const grant = await authority.issueGrant(
          operationId,
          'profile',
          'fence'
        );
        pending = call(ProfileCommands.FenceAccountDeletion, grant).then(
          (value) => ({ value }),
          (error) => ({ error })
        );
        let waiting = false;
        for (let i = 0; i < 40; i++) {
          const rows = await db.query(
            "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'"
          );
          if (rows[0].count > 0) {
            waiting = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 25));
        }
        expect(waiting).toBe(true);
        await writer.commitTransaction();
        expect((await pending).error).toBeDefined();
        expect(
          (
            await authDb
              .getRepository(AccountDeletionOperationEntity)
              .findOneByOrFail({ id: operationId })
          ).privateScope
        ).toBeNull();
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
        if (pending) await pending;
      }
      const grant = await authority.issueGrant(operationId, 'profile', 'fence');
      const result = await call(ProfileCommands.FenceAccountDeletion, grant);
      expect(result.scope).toEqual({
        currentProfileIds: [first, late].sort(),
        legacyProfileIds: [],
      });
      await authority.acknowledge(grant);
      const row = await authDb
        .getRepository(AccountDeletionOperationEntity)
        .findOneByOrFail({ id: operationId });
      expect(row.privateScope).toEqual(result.scope);
      await expect(
        insertProfile(db.query.bind(db), randomUUID(), account, 'extra')
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      await expect(
        db.query('UPDATE profile SET "userId"=$1 WHERE id=$2', [other, first])
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      await db.query('UPDATE profile SET bio=$1 WHERE id=$2', [
        'counterpart unchanged',
        counterpart,
      ]);
    }, 15000);
    it('erases own legacy cycles and personal projection while preserving counterpart content and mixed audit history', async () => {
      // Fixture-only phase preconditions; this does not assert that other real owners have acknowledged.
      const receipts = Object.fromEntries(
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
        ].map((o) => [o, { fence: true }])
      );
      await authDb.query(
        'UPDATE account_deletion_operations SET "ownerProgress"=$2::jsonb WHERE id=$1',
        [operationId, JSON.stringify(receipts)]
      );
      await db.transaction(async (m) => {
        await m.query("SELECT set_config('ot.deletion_operation',$1,true)", [
          operationId,
        ]);
        await m.query(
          "INSERT INTO timeline (id,\"userId\",title,description,\"relatedProfileId\") VALUES ($1,$2,'own','own-private',$3),($4,$5,'other','other-content',$6)",
          [ownTimeline, account, first, otherTimeline, other, counterpart]
        );
        await m.query(
          "INSERT INTO project (id,\"userId\",name,description,\"relatedProfileId\",\"timeLineEventsId\") VALUES ($1,$2,'own','own-private',$3,$4),($5,$6,'other','other-project',$3,$4)",
          [ownProject, account, first, ownTimeline, otherProject, other]
        );
        await m.query(
          'INSERT INTO goal (id,"userId",name,description,target,progress,"startDate","relatedProfileId","relatedProjectId") VALUES ($1,$2,\'own\',\'own-private\',1,0,now(),$3,$4),($5,$6,\'other\',\'other-goal\',1,0,now(),$3,$4)',
          [ownGoal, account, first, ownProject, otherGoal, other]
        );
        await m.query(
          'UPDATE project SET "goalsId"=$1 WHERE id=ANY($2::uuid[])',
          [ownGoal, [ownProject, otherProject]]
        );
        await m.query(
          'UPDATE timeline SET "relatedGoalId"=$1,"relatedProjectId"=$2 WHERE id=$3',
          [ownGoal, ownProject, otherTimeline]
        );
        await m.query(
          "INSERT INTO guardian_profile_activity (id,\"actorUserId\",\"dependentUserId\",\"profileId\",\"appId\",operation,\"changedFieldNames\") VALUES ($1,$2,$3,$4,'client-interface','profile.manage',ARRAY['bio']),($5,$3,$2,$6,'local-hub','profile.manage',ARRAY['bio'])",
          [auditA, account, other, counterpart, auditB, first]
        );
      });
      const grant = await authority.issueGrant(operationId, 'profile', 'erase');
      await call(ProfileCommands.EraseAccountDeletion, grant);
      await call(ProfileCommands.EraseAccountDeletion, grant);
      await authority.acknowledge(grant);
      readGrant = await authority.issueGrant(
        operationId,
        'profile',
        'readback'
      );
      expect(
        (await call(ProfileCommands.ReadbackAccountDeletion, readGrant)).fenced
      ).toBe(true);
      const profiles = await db.query(
        'SELECT id,"userId","profileName",bio FROM profile ORDER BY id'
      );
      expect(profiles.filter((p: any) => p.userId === account)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: first,
            profileName: 'Deleted account',
            bio: '',
          }),
          expect.objectContaining({
            id: late,
            profileName: 'Deleted account',
            bio: '',
          }),
        ])
      );
      expect(profiles.find((p: any) => p.id === counterpart).bio).toBe(
        'counterpart unchanged'
      );
      expect(
        await db.query(
          'SELECT description,"relatedProfileId","goalsId","timeLineEventsId" FROM project WHERE id=$1',
          [otherProject]
        )
      ).toEqual([
        {
          description: 'other-project',
          relatedProfileId: null,
          goalsId: null,
          timeLineEventsId: null,
        },
      ]);
      expect(
        await db.query(
          'SELECT description,"relatedProfileId","relatedProjectId" FROM goal WHERE id=$1',
          [otherGoal]
        )
      ).toEqual([
        {
          description: 'other-goal',
          relatedProfileId: null,
          relatedProjectId: null,
        },
      ]);
      const audits = await db.query(
        'SELECT id,"actorUserId","dependentUserId","profileId","changedFieldNames" FROM guardian_profile_activity'
      );
      expect(audits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: auditA,
            actorUserId: null,
            dependentUserId: other,
            profileId: counterpart,
            changedFieldNames: [],
          }),
          expect.objectContaining({
            id: auditB,
            actorUserId: other,
            dependentUserId: null,
            profileId: null,
            changedFieldNames: [],
          }),
        ])
      );
      for (const table of ['goal', 'project', 'timeline'])
        expect(
          await db.query(
            `SELECT count(*)::int AS count FROM "${table}" WHERE "userId"=$1`,
            [account]
          )
        ).toEqual([{ count: 0 }]);
    }, 15000);
    it('rejects a valid different-owner capability and a stale capability without altering rows', async () => {
      const before = await counts();
      const wrong = await authority.issueGrant(operationId, 'social', 'fence');
      await expect(
        call(ProfileCommands.FenceAccountDeletion, wrong)
      ).rejects.toBeDefined();
      await expect(
        call(ProfileCommands.ReadbackAccountDeletion, {
          ...readGrant,
          expiresAt: '2000-01-01T00:00:00.000Z',
        })
      ).rejects.toBeDefined();
      expect(await counts()).toEqual(before);
    });
  }
);
