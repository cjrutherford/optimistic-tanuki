import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { createServer } from 'node:net';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { AccountDeletionOwnerController } from './account-deletion-owner.controller';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { DataSource, Repository } from 'typeorm';
import { AccountDeletionGrant } from '@optimistic-tanuki/models';
import {
  AccountExportArtifactStoreService,
  EnvelopeEncryptionService,
  deletionIdentityKey,
} from '@optimistic-tanuki/storage';
import { AccountDeletionAuthorityService } from './account-deletion-authority.service';
import { AccountDeletionOperationEntity } from './account-deletion-operation.entity';
import { AccountDeletionOwnerService } from './account-deletion-owner.service';
import { AccountExportArtifactRetentionService } from '../account-export-jobs/account-export-artifact-retention.service';
import { AccountExportDownloadService } from '../account-export-jobs/account-export-download.service';
import { AccountExportJobEntity } from '../account-export-jobs/entities/account-export-job.entity';

const enabled = process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture';
(enabled ? describe : describe.skip)(
  'D01 authentication owner on fresh migrated PostgreSQL',
  () => {
    let db: DataSource;
    let jobs: Repository<AccountExportJobEntity>;
    let operationId: string | undefined;
    let fixtureOperationIds: string[] = [];
    let fixtureAccounts: string[] = [];
    let artifactRoot: string | undefined;
    let artifactStore: AccountExportArtifactStoreService;
    let retention: AccountExportArtifactRetentionService;
    let owner: AccountDeletionOwnerService;
    let authority: AccountDeletionAuthorityService;
    let artifactId: string;
    let targetJobId: string;
    let otherJobId: string;
    let readbackGrant: AccountDeletionGrant;
    let account: string;
    let counterpart: string;
    let profileId: string;
    let counterpartProfileId: string;
    let targetToken: string;
    let orphanProfileToken: string;
    let foreignProfileToken: string;
    let oauthId: string;
    let authActionId: string;
    let guardianApplicantId: string;
    let guardianIdentityId: string;
    let targetNoticeId: string;
    let counterpartNoticeId: string;
    const proofKeyBefore = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    let baseline: Record<string, number>;
    const tables = [
      'user_entity',
      'token',
      'oauth_provider',
      'auth_action_token',
      'guardian_permission',
      'guardian_policy_notice',
      'account_export_jobs',
      'account_deletion_operations',
      'account_deletion_write_fence',
    ];

    beforeAll(async () => {
      process.env['ACCOUNT_DELETION_PROOF_KEY'] =
        randomBytes(48).toString('base64url');
      db = new DataSource({
        type: 'postgres',
        host: process.env['POSTGRES_HOST'],
        port: Number(process.env['POSTGRES_PORT']),
        username: process.env['POSTGRES_USER'],
        password: process.env['POSTGRES_PASSWORD'],
        database: process.env['POSTGRES_DB'],
        entities: [AccountDeletionOperationEntity, AccountExportJobEntity],
        synchronize: false,
        migrationsRun: false,
        extra: { statement_timeout: 5000, lock_timeout: 3000 },
      });
      await db.initialize();
      jobs = db.getRepository(AccountExportJobEntity);
      authority = new AccountDeletionAuthorityService(
        db.getRepository(AccountDeletionOperationEntity),
        db
      );
      artifactRoot = await mkdtemp(join(tmpdir(), 'd01-owner-'));
      const encryption = new EnvelopeEncryptionService({
        VAULT_STORAGE_KEK: randomBytes(32).toString('base64'),
        VAULT_STORAGE_KEK_ID: `d01-${randomUUID()}`,
      });
      artifactStore = new AccountExportArtifactStoreService(encryption, {
        root: join(artifactRoot, 'encrypted'),
      });
      // The owner path only invalidates in-memory download capabilities. No HTTP download
      // authentication is exercised; fail if a future change unexpectedly invokes auth.
      const unusedAuth = new Proxy(
        {},
        {
          get: (_target, method) => () => {
            throw new Error(`UNEXPECTED_DOWNLOAD_AUTH_CALL:${String(method)}`);
          },
        }
      ) as never;
      const downloads = new AccountExportDownloadService(
        jobs,
        artifactStore,
        unusedAuth
      );
      retention = new AccountExportArtifactRetentionService(
        jobs,
        artifactStore,
        downloads
      );
      owner = new AccountDeletionOwnerService(authority, db, retention);
      baseline = await counts();
    }, 30000);

    afterAll(async () => {
      if (db?.isInitialized) {
        try {
          await db.transaction(async (manager) => {
            await manager.query(
              "SELECT set_config('ot.deletion_operation', $1, true)",
              [fixtureOperationIds.at(-1) ?? '']
            );
            await manager.query(
              'DELETE FROM "account_export_jobs" WHERE "id"=ANY($1::uuid[])',
              [[targetJobId, otherJobId].filter(Boolean)]
            );
            await manager.query(
              'DELETE FROM "guardian_policy_notice" WHERE "id"=ANY($1::uuid[])',
              [[targetNoticeId, counterpartNoticeId]]
            );
            await manager.query(
              'DELETE FROM "guardian_permission" WHERE "id"=ANY($1::uuid[])',
              [[guardianApplicantId, guardianIdentityId]]
            );
            await manager.query(
              'DELETE FROM "auth_action_token" WHERE "id"=$1',
              [authActionId]
            );
            await manager.query('DELETE FROM "oauth_provider" WHERE "id"=$1', [
              oauthId,
            ]);
            await manager.query(
              'DELETE FROM "token" WHERE "id"=ANY($1::uuid[])',
              [[targetToken, orphanProfileToken, foreignProfileToken]]
            );
            await manager.query(
              'DELETE FROM "user_entity" WHERE "id"=ANY($1::uuid[])',
              [fixtureAccounts]
            );
          });
          if (fixtureOperationIds.length) {
            await db.query(
              'DELETE FROM "account_deletion_write_fence" WHERE "operationId"=ANY($1::uuid[])',
              [fixtureOperationIds]
            );
            await db.query(
              'DELETE FROM "account_deletion_operations" WHERE "id"=ANY($1::uuid[])',
              [fixtureOperationIds]
            );
          }
          expect(await counts()).toEqual(baseline);
        } finally {
          await db.destroy();
        }
      }
      if (artifactRoot)
        await rm(artifactRoot, { recursive: true, force: true });
      if (proofKeyBefore === undefined)
        delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
      else process.env['ACCOUNT_DELETION_PROOF_KEY'] = proofKeyBefore;
    }, 30000);

    async function counts(): Promise<Record<string, number>> {
      const values = await Promise.all(
        tables.map(async (table) => {
          const rows = await db.query(
            `SELECT count(*)::int AS count FROM "${table}"`
          );
          return [table, Number(rows[0].count)] as const;
        })
      );
      return Object.fromEntries(values);
    }

    async function seed(): Promise<void> {
      account = randomUUID();
      counterpart = randomUUID();
      fixtureAccounts.push(account, counterpart);
      profileId = randomUUID();
      counterpartProfileId = randomUUID();
      targetToken = randomUUID();
      orphanProfileToken = randomUUID();
      foreignProfileToken = randomUUID();
      oauthId = randomUUID();
      authActionId = randomUUID();
      guardianApplicantId = randomUUID();
      guardianIdentityId = randomUUID();
      targetNoticeId = randomUUID();
      counterpartNoticeId = randomUUID();
      await db.query(
        `INSERT INTO "user_entity" ("id","email","firstName","lastName","password","bio")
         VALUES ($1,$2,'D01','Target','fixture-password','target bio'),
                ($3,$4,'D01','Counterpart','fixture-password','counterpart bio')`,
        [
          account,
          `${account}@example.invalid`,
          counterpart,
          `${counterpart}@example.invalid`,
        ]
      );
      await db.query(
        'INSERT INTO "token" ("id","tokenData","userId","profileId","revoked") VALUES ($1,$2,$3,NULL,false),($4,$5,NULL,$6,false),($7,$8,$9,$10,false)',
        [
          targetToken,
          `sentinel-${randomUUID()}`,
          account,
          orphanProfileToken,
          `sentinel-${randomUUID()}`,
          profileId,
          foreignProfileToken,
          `sentinel-${randomUUID()}`,
          counterpart,
          counterpartProfileId,
        ]
      );
      await db.query(
        'INSERT INTO "oauth_provider" ("id","provider","providerUserId","userId") VALUES ($1,$2,$3,$4)',
        [oauthId, 'fixture-provider', randomUUID(), account]
      );
      await db.query(
        'INSERT INTO "auth_action_token" ("id","tokenHash","purpose","appId","returnPath","expiresAt","userId") VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          authActionId,
          randomBytes(32).toString('hex'),
          'password-reset',
          'client-interface',
          '/',
          new Date(Date.now() + 3600000),
          account,
        ]
      );
      const guardianBase = [
        'approved',
        new Date(),
        new Date(Date.now() + 3600000),
        'client-interface',
        'D01 Fixture',
        'https://example.invalid',
        'fixture@example.invalid',
      ];
      await db.query(
        `INSERT INTO "guardian_permission" ("id","applicantEmail","guardianEmail","dateOfBirth","userId","guardianUserId","status","createdAt","expiresAt","appId","appName","uiBaseUrl","emailFrom")
         VALUES ($1,$2,$3,'2000-01-01',$4,$5,$6,$7,$8,$9,$10,$11,$12),($13,$14,$15,'2010-01-01',$16,$17,$6,$7,$8,$9,$10,$11,$12)`,
        [
          guardianApplicantId,
          `${account}@example.invalid`,
          `${counterpart}@example.invalid`,
          account,
          counterpart,
          ...guardianBase,
          guardianIdentityId,
          `${counterpart}@example.invalid`,
          `${account}@example.invalid`,
          counterpart,
          account,
        ]
      );
      const noticeTime = new Date();
      await db.query(
        `INSERT INTO "guardian_policy_notice" ("id","policyVersion","policyUrl","guardianUserId","status","nextAttemptAt","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'pending',$5,$5,$5),($6,$2,$3,$7,'pending',$5,$5,$5)`,
        [
          targetNoticeId,
          'd01-fixture',
          'https://example.invalid/policy',
          account,
          noticeTime,
          counterpartNoticeId,
          counterpart,
        ]
      );
      const targetJob = await jobs.save(
        jobs.create({
          accountId: account,
          appId: 'client-interface',
          kind: 'export',
          idempotencyKey: randomUUID(),
          state: 'running',
          attempt: 1,
          leaseOwner: randomUUID(),
          leaseExpiresAt: new Date(Date.now() + 60000),
          coverageSummary: {},
          lastErrorCode: null,
          completedAt: new Date(),
        })
      );
      targetJobId = targetJob.id;
      const otherJob = await jobs.save(
        jobs.create({
          accountId: counterpart,
          appId: 'client-interface',
          kind: 'export',
          idempotencyKey: randomUUID(),
          state: 'complete',
          attempt: 1,
          leaseOwner: null,
          leaseExpiresAt: null,
          coverageSummary: {},
          lastErrorCode: null,
          completedAt: new Date(),
        })
      );
      otherJobId = otherJob.id;
      const payload = Buffer.from(`private export ${randomUUID()}`);
      artifactId = randomUUID();
      const descriptor = await artifactStore.put({
        artifactId,
        jobId: targetJob.id,
        accountId: account,
        appId: 'client-interface',
        attempt: 1,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        sizeBytes: payload.length,
        sha256: createHash('sha256').update(payload).digest('hex'),
        stream: Readable.from(payload),
      });
      await jobs.update(targetJob.id, {
        coverageSummary: {
          privateArtifact: descriptor,
          artifactState: 'verified',
          artifactAvailable: false,
        },
      });
      await jobs.update(targetJob.id, {
        state: 'failed',
        leaseOwner: null,
        leaseExpiresAt: null,
      });
    }

    async function authorizeOwner(): Promise<void> {
      const accepted = await authority.accept(
        account,
        'client-interface',
        randomUUID()
      );
      operationId = accepted.id;
      fixtureOperationIds.push(operationId);
      await authority.claim(operationId);
      const profileGrant = await authority.issueGrant(
        operationId,
        'profile',
        'fence'
      );
      const scope = { currentProfileIds: [profileId], legacyProfileIds: [] };
      await authority.recordProfileScope(profileGrant, scope);
      await authority.acknowledge(profileGrant);
      // Fixture-only acknowledgements unlock the Authentication action phase. This is not
      // evidence that any of the twelve global owners actually fenced or acknowledged.
      const owners = [
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
      const fixtureReceipts = Object.fromEntries(
        owners.map((name) => [name, { fence: true }])
      );
      await db.query(
        'INSERT INTO "account_deletion_write_fence" ("operationId","key","kind") VALUES ($1,$2,\'account\'),($1,$3,\'profile\') ON CONFLICT DO NOTHING',
        [
          operationId,
          deletionIdentityKey('account', account),
          deletionIdentityKey('profile', profileId),
        ]
      );
      await db.query(
        'UPDATE "account_deletion_operations" SET "ownerProgress"=$2::jsonb,"state"=\'deleting\' WHERE "id"=$1',
        [
          operationId,
          JSON.stringify({
            ...fixtureReceipts,
            authentication: { fence: true, erase: true },
          }),
        ]
      );
    }

    it('fences the owner realm, retries encrypted purge, erases only target rows, and reports seven independent families', async () => {
      await seed();
      await authorizeOwner();
      const fenceGrant = await authority.issueGrant(
        operationId!,
        'authentication',
        'fence'
      );
      const purgeSpy = jest
        .spyOn(artifactStore, 'purgeOwnedArtifact')
        .mockImplementationOnce(async () => {
          throw new Error('fixture purge interruption');
        });
      await expect(owner.fence(fenceGrant)).rejects.toThrow(
        'ACCOUNT_DELETION_ARTIFACT_PURGE_FAILED'
      );
      const retained = await jobs.findOneByOrFail({ id: targetJobId });
      expect(retained.coverageSummary).toHaveProperty('privateArtifact');
      expect(retained.coverageSummary).toHaveProperty(
        'artifactState',
        'cleanup-pending'
      );
      expect(
        await stat(join(artifactRoot!, 'encrypted', artifactId))
      ).toBeDefined();
      purgeSpy.mockRestore();
      // Retrying uses the real store and retention path after the one-shot injected failure.
      await expect(owner.fence(fenceGrant)).resolves.toMatchObject({
        fenced: true,
      });
      expect(await artifactStore.inspectAbsent(artifactId)).toBe(true);
      const eraseGrant = await authority.issueGrant(
        operationId!,
        'authentication',
        'erase'
      );
      expect(await owner.erase(eraseGrant)).toEqual({ erased: true });
      expect(await owner.erase(eraseGrant)).toEqual({ erased: true });
      await authority.acknowledge(eraseGrant);
      readbackGrant = await authority.issueGrant(
        operationId!,
        'authentication',
        'readback'
      );
      const result = await owner.readback(readbackGrant);
      expect(result.complete).toBe(true);
      expect(result.unresolvedAttribution).toEqual([]);
      expect(result.counts).toEqual({
        token_account: 0,
        token_profile: 0,
        oauth_provider: 0,
        auth_action_token: 0,
        guardian_permission: 0,
        guardian_policy_notice: 0,
        account_export_jobs: 0,
      });
      const users = await db.query(
        'SELECT "id","email","password","bio" FROM "user_entity" WHERE "id"=ANY($1::uuid[])',
        [[account, counterpart]]
      );
      expect(users).toHaveLength(2);
      expect(users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: account,
            email: `${account}@example.invalid`,
            password: 'fixture-password',
            bio: 'target bio',
          }),
          expect.objectContaining({
            id: counterpart,
            email: `${counterpart}@example.invalid`,
            password: 'fixture-password',
            bio: 'counterpart bio',
          }),
        ])
      );
      expect(
        await db.query(
          'SELECT "userId","profileId","revoked" FROM "token" WHERE "id"=ANY($1::uuid[])',
          [[targetToken, orphanProfileToken, foreignProfileToken]]
        )
      ).toEqual([
        {
          userId: counterpart,
          profileId: counterpartProfileId,
          revoked: false,
        },
      ]);
      const guardianRows = await db.query(
        'SELECT "id","userId","guardianUserId","applicantEmail","guardianEmail","status" FROM "guardian_permission" WHERE "id"=ANY($1::uuid[])',
        [[guardianApplicantId, guardianIdentityId]]
      );
      expect(guardianRows).toHaveLength(2);
      expect(guardianRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: guardianApplicantId,
            userId: null,
            guardianUserId: counterpart,
            applicantEmail: '[deleted-account]',
            guardianEmail: `${counterpart}@example.invalid`,
            status: 'revoked',
          }),
          expect.objectContaining({
            id: guardianIdentityId,
            userId: counterpart,
            guardianUserId: null,
            applicantEmail: `${counterpart}@example.invalid`,
            guardianEmail: null,
            status: 'revoked',
          }),
        ])
      );
      expect(await jobs.findOneByOrFail({ id: otherJobId })).toBeDefined();
      const ownUser = await db.query(
        'SELECT count(*)::int AS count FROM "user_entity" WHERE "id"=$1 AND "email"=$2',
        [account, `${account}@example.invalid`]
      );
      expect(ownUser).toEqual([{ count: 1 }]);
    }, 30000);

    it('blocks completeness for a conflicting legacy profile binding without deleting the counterpart token', async () => {
      const setBinding = (id: string) =>
        db.transaction(async (manager) => {
          await manager.query(
            "SELECT set_config('ot.deletion_operation', $1, true)",
            [operationId]
          );
          await manager.query('UPDATE token SET "profileId"=$1 WHERE id=$2', [
            id,
            foreignProfileToken,
          ]);
        });
      // Fixture-only injection represents a pre-existing inconsistent binding.
      await setBinding(profileId);
      const result = await owner.readback(readbackGrant);
      expect(result.complete).toBe(false);
      expect(result.counts.token_profile).toBe(1);
      expect(
        await db.query('SELECT "userId",revoked FROM token WHERE id=$1', [
          foreignProfileToken,
        ])
      ).toEqual([{ userId: counterpart, revoked: false }]);
      await setBinding(counterpartProfileId);
      expect((await owner.readback(readbackGrant)).complete).toBe(true);
    });

    it('rejects wrong owner, action, and stale grants without changing any table family', async () => {
      const before = await counts();
      const valid = await authority.issueGrant(
        operationId!,
        'authentication',
        'fence'
      );
      const wrongOwner = { ...valid, owner: 'social' } as AccountDeletionGrant;
      await expect(owner.fence(wrongOwner)).rejects.toThrow();
      const wrongAction = { ...valid, action: 'erase' } as AccountDeletionGrant;
      await expect(owner.fence(wrongAction)).rejects.toThrow();
      const stale = {
        ...valid,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      } as AccountDeletionGrant;
      await expect(owner.fence(stale)).rejects.toThrow();
      expect(await counts()).toEqual(before);
    }, 30000);

    it('serves signed owner readback over real loopback TCP and rejects another owner capability', async () => {
      const probe = createServer();
      await new Promise<void>((resolve) =>
        probe.listen(0, '127.0.0.1', resolve)
      );
      const address = probe.address();
      if (!address || typeof address === 'string')
        throw new Error('FIXTURE_PORT_UNAVAILABLE');
      const port = address.port;
      await new Promise<void>((resolve, reject) =>
        probe.close((error) => (error ? reject(error) : resolve()))
      );
      const module = await Test.createTestingModule({
        controllers: [AccountDeletionOwnerController],
        providers: [{ provide: AccountDeletionOwnerService, useValue: owner }],
      }).compile();
      const app = module.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port },
        logger: false,
      });
      const client = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port },
      });
      try {
        await app.listen();
        const reply = await firstValueFrom(
          client
            .send(
              { cmd: AuthCommands.ReadbackAuthenticationDeletion },
              readbackGrant
            )
            .pipe(timeout(3000))
        );
        expect(reply.complete).toBe(true);
        const foreign = await authority.issueGrant(
          operationId!,
          'social',
          'fence'
        );
        const before = await counts();
        await expect(
          firstValueFrom(
            client
              .send({ cmd: AuthCommands.FenceAuthenticationDeletion }, foreign)
              .pipe(timeout(3000))
          )
        ).rejects.toBeDefined();
        expect(await counts()).toEqual(before);
      } finally {
        client.close();
        await app.close();
      }
    });

    it('keeps the account operation and fence as retained D26 control state until fixture teardown', async () => {
      const saved = await db
        .getRepository(AccountDeletionOperationEntity)
        .findOneByOrFail({ id: operationId! });
      expect(saved.accountId).toBe(account);
      expect(
        await db.query(
          'SELECT count(*)::int AS count FROM "account_deletion_write_fence" WHERE "operationId"=$1',
          [operationId]
        )
      ).toEqual([{ count: 2 }]);
    }, 30000);
  }
);
