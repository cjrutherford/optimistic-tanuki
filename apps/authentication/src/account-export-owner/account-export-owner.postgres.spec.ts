import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { DataSource, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { resolve } from 'path';
import { EmailService } from '@optimistic-tanuki/email';
import { SaltedHashService } from '@optimistic-tanuki/encryption';
import {
  MfaService,
  PasswordPolicyService,
  TokenIssuerService,
} from '@optimistic-tanuki/auth-domain';
import { UserEntity } from '../user/entities/user.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { OAuthProviderEntity } from '../oauth-providers/entities/oauth-provider.entity';
import { AuthActionTokenEntity } from '../email-auth/entities/auth-action-token.entity';
import { GuardianPermissionEntity } from '../guardian-permissions/entities/guardian-permission.entity';
import { GuardianPolicyNoticeEntity } from '../guardian-permissions/entities/guardian-policy-notice.entity';
import { AccountExportJobEntity } from '../account-export-jobs/entities/account-export-job.entity';
import { GuardianPermissionService } from '../guardian-permissions/guardian-permission.service';
import { AppService } from '../app/app.service';
import { ProfileOwnershipVerifier } from '../app/profile-ownership-verifier.service';
import {
  AuthenticationAccountExportChunk,
  AuthenticationAccountExportOwnerService,
} from './account-export-owner.service';

const REQUIRED_OPT_IN = 'account_owner_j2_fixture';
const APP_ID = 'client-interface';
const JWT_SECRET = 'isolated-account-owner-fixture-secret';
const OWNER_PAGE_BOUNDARY = 1005;

function isolatedFixtureEnabled(): boolean {
  return (
    process.env.AUTH_OWNER_PG_OPT_IN === REQUIRED_OPT_IN &&
    process.env.POSTGRES_DB === 'account_owner_j2_fixture' &&
    process.env.POSTGRES_USER === 'owner_fixture' &&
    process.env.POSTGRES_HOST === '127.0.0.1' &&
    process.env.POSTGRES_PORT === '15549'
  );
}

const postgresDescribe = isolatedFixtureEnabled() ? describe : describe.skip;

postgresDescribe(
  'Authentication owner capture against isolated PostgreSQL',
  () => {
    let dataSource: DataSource;
    let appService: AppService;
    let service: AuthenticationAccountExportOwnerService;
    let users: Repository<UserEntity>;
    let tokens: Repository<TokenEntity>;
    let keyData: Repository<KeyDatum>;
    let guardianRows: string[] = [];
    let keyIds: string[] = [];
    let tokenIds: string[] = [];
    let oauthIds: string[] = [];
    let actionIds: string[] = [];
    let noticeIds: string[] = [];
    let jobIds: string[] = [];
    let userIds: string[] = [];
    let sessionTokens: string[] = [];

    beforeAll(async () => {
      if (!isolatedFixtureEnabled()) return;
      dataSource = new DataSource({
        type: 'postgres',
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT),
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        entities: [
          UserEntity,
          TokenEntity,
          KeyDatum,
          OAuthProviderEntity,
          AuthActionTokenEntity,
          GuardianPermissionEntity,
          GuardianPolicyNoticeEntity,
          AccountExportJobEntity,
        ],
        migrations: [
          resolve(process.cwd(), 'apps/authentication/migrations/*.ts'),
        ],
        migrationsTableName: 'account_owner_test_migrations',
        extra: {
          max: 8,
          application_name: 'authentication-owner-focused-test',
        },
      });
      await dataSource.initialize();
      await dataSource.runMigrations({ transaction: 'all' });
      await cleanupStaleFixtureRows();
      expect(await allSourceTableCounts()).toEqual({
        user: 0,
        keyDatum: 0,
        session: 0,
        oauthProvider: 0,
        authAction: 0,
        guardianPolicyNotice: 0,
        exportJob: 0,
        guardianPermission: 0,
      });
      users = dataSource.getRepository(UserEntity);
      tokens = dataSource.getRepository(TokenEntity);
      keyData = dataSource.getRepository(KeyDatum);

      const guardians = new GuardianPermissionService(
        dataSource.getRepository(GuardianPermissionEntity),
        users,
        tokens,
        {} as EmailService
      );
      const jwtService = new JwtService({ secret: JWT_SECRET });
      appService = new AppService(
        new Logger('AuthenticationOwnerPostgresSpec'),
        {} as ConfigService,
        users,
        tokens,
        keyData,
        {} as SaltedHashService,
        {} as PasswordPolicyService,
        {} as MfaService,
        {} as TokenIssuerService,
        {} as never,
        JWT_SECRET,
        authenticator,
        jwtService,
        {} as EmailService,
        guardians,
        new ProfileOwnershipVerifier({
          send: () => {
            throw new Error('This account-only fixture has no Profile service');
          },
        } as never)
      );
      service = new AuthenticationAccountExportOwnerService(
        dataSource,
        appService
      );
    }, 120_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) await dataSource.destroy();
    }, 30_000);

    afterEach(async () => {
      if (!dataSource?.isInitialized) return;
      if (guardianRows.length) {
        await dataSource.query(
          'DELETE FROM "guardian_permission" WHERE "id" = ANY($1::uuid[])',
          [guardianRows]
        );
        guardianRows = [];
      }
      if (oauthIds.length) {
        await dataSource.query(
          'DELETE FROM "oauth_provider" WHERE "id" = ANY($1::uuid[])',
          [oauthIds]
        );
        oauthIds = [];
      }
      if (actionIds.length) {
        await dataSource.query(
          'DELETE FROM "auth_action_token" WHERE "id" = ANY($1::uuid[])',
          [actionIds]
        );
        actionIds = [];
      }
      if (noticeIds.length) {
        await dataSource.query(
          'DELETE FROM "guardian_policy_notice" WHERE "id" = ANY($1::uuid[])',
          [noticeIds]
        );
        noticeIds = [];
      }
      if (jobIds.length) {
        await dataSource.query(
          'DELETE FROM "account_export_jobs" WHERE "id" = ANY($1::uuid[])',
          [jobIds]
        );
        jobIds = [];
      }
      if (keyIds.length) {
        await dataSource.query(
          'UPDATE "user_entity" SET "keyDataId" = NULL WHERE "keyDataId" = ANY($1::uuid[])',
          [keyIds]
        );
        await dataSource.query(
          'DELETE FROM "key_datum" WHERE "id" = ANY($1::uuid[])',
          [keyIds]
        );
        keyIds = [];
      }
      if (tokenIds.length) {
        await dataSource.query(
          'DELETE FROM "token" WHERE "id" = ANY($1::uuid[])',
          [tokenIds]
        );
        tokenIds = [];
      }
      if (userIds.length) {
        await dataSource.query(
          'DELETE FROM "user_entity" WHERE "id" = ANY($1::uuid[])',
          [userIds]
        );
        userIds = [];
      }
      sessionTokens = [];
      expect(await allSourceTableCounts()).toEqual({
        user: 0,
        keyDatum: 0,
        session: 0,
        oauthProvider: 0,
        authAction: 0,
        guardianPolicyNotice: 0,
        exportJob: 0,
        guardianPermission: 0,
      });
    });

    async function cleanupStaleFixtureRows(): Promise<void> {
      const staleUsers = (await dataSource.query(
        `SELECT "id" FROM "user_entity"
       WHERE "email" LIKE 'owner-a-%@example.test' OR "email" LIKE 'owner-b-%@example.test' OR "email" LIKE 'owner-c-%@example.test'`
      )) as Array<{ id: string }>;
      const ids = staleUsers.map(({ id }) => id);
      const staleKeys = (await dataSource.query(
        `SELECT "keyDataId" AS id FROM "user_entity"
       WHERE "id" = ANY($1::uuid[]) AND "keyDataId" IS NOT NULL
       UNION SELECT "id" FROM "key_datum" WHERE "userId" = ANY($1::uuid[])`,
        [ids]
      )) as Array<{ id: string }>;
      const keyIdValues = staleKeys.map(({ id }) => id);
      await dataSource.query(
        `DELETE FROM "guardian_permission"
       WHERE "applicantEmail" = 'unrelated-unlinked@example.test'
          OR "applicantEmail" LIKE 'owner-a-%@example.test'
          OR "applicantEmail" LIKE 'owner-b-%@example.test'
          OR "applicantEmail" LIKE 'owner-c-%@example.test'`
      );
      if (ids.length) {
        await dataSource.query(
          'DELETE FROM "oauth_provider" WHERE "userId" = ANY($1::uuid[])',
          [ids]
        );
        await dataSource.query(
          'DELETE FROM "auth_action_token" WHERE "userId" = ANY($1::uuid[])',
          [ids]
        );
        await dataSource.query(
          'DELETE FROM "guardian_policy_notice" WHERE "guardianUserId" = ANY($1::uuid[])',
          [ids]
        );
        await dataSource.query(
          'DELETE FROM "account_export_jobs" WHERE "accountId" = ANY($1::uuid[])',
          [ids]
        );
        await dataSource.query(
          'DELETE FROM "token" WHERE "userId" = ANY($1::uuid[])',
          [ids]
        );
        await dataSource.query(
          'UPDATE "user_entity" SET "keyDataId" = NULL WHERE "id" = ANY($1::uuid[])',
          [ids]
        );
      }
      if (keyIdValues.length) {
        await dataSource.query(
          'DELETE FROM "key_datum" WHERE "id" = ANY($1::uuid[])',
          [keyIdValues]
        );
      }
      if (ids.length) {
        await dataSource.query(
          'DELETE FROM "user_entity" WHERE "id" = ANY($1::uuid[])',
          [ids]
        );
      }
      await dataSource.query(
        `DELETE FROM "oauth_provider" WHERE "providerUserId" IN ('provider-subject-a', 'writer-subject')`
      );
      expect(await allSourceTableCounts()).toEqual({
        user: 0,
        keyDatum: 0,
        session: 0,
        oauthProvider: 0,
        authAction: 0,
        guardianPolicyNotice: 0,
        exportJob: 0,
        guardianPermission: 0,
      });
    }

    async function allSourceTableCounts(): Promise<Record<string, number>> {
      const tables: Record<string, string> = {
        user: 'user_entity',
        keyDatum: 'key_datum',
        session: 'token',
        oauthProvider: 'oauth_provider',
        authAction: 'auth_action_token',
        guardianPolicyNotice: 'guardian_policy_notice',
        exportJob: 'account_export_jobs',
        guardianPermission: 'guardian_permission',
      };
      const result: Record<string, number> = {};
      for (const [source, table] of Object.entries(tables)) {
        const [row] = (await dataSource.query(
          `SELECT count(*)::int AS count FROM "${table}"`
        )) as Array<{ count: number }>;
        result[source] = row.count;
      }
      return result;
    }

    async function ownedSourceReadback(
      accountId: string
    ): Promise<Record<string, { count: number; digest: string }>> {
      const sources: Record<string, { table: string; ownerColumn: string }> = {
        user: { table: 'user_entity', ownerColumn: 'id' },
        keyDatum: { table: 'key_datum', ownerColumn: 'userId' },
        session: { table: 'token', ownerColumn: 'userId' },
        oauthProvider: { table: 'oauth_provider', ownerColumn: 'userId' },
        authAction: { table: 'auth_action_token', ownerColumn: 'userId' },
        guardianPolicyNotice: {
          table: 'guardian_policy_notice',
          ownerColumn: 'guardianUserId',
        },
        exportJob: { table: 'account_export_jobs', ownerColumn: 'accountId' },
        guardianPermission: {
          table: 'guardian_permission',
          ownerColumn: 'owner',
        },
      };
      const result: Record<string, { count: number; digest: string }> = {};
      for (const [source, { table, ownerColumn }] of Object.entries(sources)) {
        const rows = (await dataSource.query(
          ownerColumn === 'owner'
            ? `SELECT to_jsonb(t) AS row FROM "${table}" t WHERE "userId" = $1 OR "guardianUserId" = $1 ORDER BY "id"`
            : `SELECT to_jsonb(t) AS row FROM "${table}" t WHERE "${ownerColumn}" = $1 ORDER BY "id"`,
          [accountId]
        )) as Array<{ row: unknown }>;
        const digest = createHash('sha256')
          .update(JSON.stringify(rows.map(({ row }) => row)))
          .digest('hex');
        result[source] = { count: rows.length, digest };
      }
      return result;
    }

    it('streams a stable complete capture, authorizes the current account, and redacts counterpart data', async () => {
      const accountA = randomUUID();
      const accountB = randomUUID();
      const accountC = randomUUID();
      userIds.push(accountA, accountB, accountC);
      await users.save([
        Object.assign(new UserEntity(), {
          id: accountA,
          email: `owner-a-${accountA}@example.test`,
          firstName: 'Fixture',
          lastName: 'Account A',
          password: 'POSTGRES-PASSWORD-CANARY',
          bio: 'Fixture-owned bio',
          ageEligibilityStatus: 'adult',
          totpSecret: 'POSTGRES-TOTP-CANARY',
          failedLoginCount: 2,
        }),
        Object.assign(new UserEntity(), {
          id: accountB,
          email: `owner-b-${accountB}@example.test`,
          firstName: 'Fixture',
          lastName: 'Account B',
          password: 'OTHER-ACCOUNT-PASSWORD-CANARY',
          bio: 'Counterpart account bio',
          ageEligibilityStatus: 'adult',
        }),
        Object.assign(new UserEntity(), {
          id: accountC,
          email: `owner-c-${accountC}@example.test`,
          firstName: 'Fixture',
          lastName: 'Account C',
          password: 'THIRD-ACCOUNT-PASSWORD-CANARY',
          bio: 'Third counterpart account bio',
          ageEligibilityStatus: 'adult',
        }),
      ]);

      const keyId = randomUUID();
      keyIds.push(keyId);
      await dataSource.query(
        `INSERT INTO "key_datum" ("id", "public", "salt", "userId") VALUES ($1, $2, $3, $4)`,
        [
          keyId,
          Buffer.from('public-fixture-key'),
          'POSTGRES-KEY-SALT-CANARY',
          accountA,
        ]
      );
      await dataSource.query(
        'UPDATE "user_entity" SET "keyDataId" = $1 WHERE "id" = $2',
        [keyId, accountA]
      );

      const sessionToken = await persistSession(accountA);
      await persistSession(accountB);
      const ownerSessionIds = Array.from({ length: OWNER_PAGE_BOUNDARY }, () =>
        randomUUID()
      );
      ownerSessionIds[0] = '00000000-0000-0000-0000-000000000000';
      tokenIds.push(...ownerSessionIds);
      await dataSource.query(
        `INSERT INTO "token" ("id", "tokenData", "userId", "revoked")
       SELECT ids.id, 'SESSION-TOKEN-DATA-CANARY', $1, false
         FROM unnest($2::uuid[]) AS ids(id)`,
        [accountA, ownerSessionIds]
      );
      const foreignSessionId = randomUUID();
      tokenIds.push(foreignSessionId);
      await dataSource.query(
        `INSERT INTO "token" ("id", "tokenData", "userId", "revoked") VALUES ($1, 'FOREIGN-SESSION-CANARY', $2, false)`,
        [foreignSessionId, accountB]
      );

      const oauthId = randomUUID();
      oauthIds.push(oauthId);
      await dataSource.query(
        `INSERT INTO "oauth_provider" ("id", "provider", "providerUserId", "providerEmail", "providerDisplayName", "userId")
       VALUES ($1, 'fixture-provider', 'provider-subject-a', 'provider-a@example.test', 'Fixture A', $2)`,
        [oauthId, accountA]
      );

      const linkedPermissionId = randomUUID();
      const unrelatedUnlinkedId = randomUUID();
      guardianRows.push(linkedPermissionId, unrelatedUnlinkedId);
      await insertGuardianPermission(
        linkedPermissionId,
        accountA,
        accountB,
        `owner-a-${accountA}@example.test`,
        'COUNTERPART-EMAIL-CANARY',
        'COUNTERPART-STATEMENT-CANARY'
      );
      const reversePermissionId = randomUUID();
      const legacyNullEmailPermissionId = randomUUID();
      guardianRows.push(reversePermissionId, legacyNullEmailPermissionId);
      await insertGuardianPermission(
        reversePermissionId,
        accountB,
        accountA,
        'COUNTERPART-APPLICANT-EMAIL-CANARY',
        `owner-a-${accountA}@example.test`,
        'COUNTERPART-APPLICANT-STATEMENT-CANARY'
      );
      await insertGuardianPermission(
        legacyNullEmailPermissionId,
        accountC,
        accountA,
        'LEGACY-COUNTERPART-APPLICANT-EMAIL-CANARY',
        null,
        'LEGACY-COUNTERPART-STATEMENT-CANARY'
      );
      await insertGuardianPermission(
        unrelatedUnlinkedId,
        null,
        null,
        'unrelated-unlinked@example.test',
        'other-unlinked@example.test',
        'UNLINKED-UNRELATED-STATEMENT'
      );

      const actionId = randomUUID();
      actionIds.push(actionId);
      await dataSource.query(
        `INSERT INTO "auth_action_token" ("id", "tokenHash", "purpose", "appId", "returnPath", "expiresAt", "userId")
       VALUES ($1, $2, 'verification', $3, '/confirm', now() + interval '1 day', $4)`,
        [actionId, 'a'.repeat(64), APP_ID, accountA]
      );
      const noticeId = randomUUID();
      noticeIds.push(noticeId);
      await dataSource.query(
        `INSERT INTO "guardian_policy_notice" ("id", "policyVersion", "policyUrl", "guardianUserId", "status", "attempts", "nextAttemptAt", "createdAt", "updatedAt")
       VALUES ($1, 'fixture-policy-v1', 'https://example.test/policy', $2, 'failed', 2, now(), now(), now())`,
        [noticeId, accountA]
      );
      const jobId = randomUUID();
      jobIds.push(jobId);
      await dataSource.query(
        `INSERT INTO "account_export_jobs" ("id", "accountId", "appId", "kind", "idempotencyKey", "state", "coverageSummary", "lastErrorCode")
       VALUES ($1, $2, 'another-client', 'export', $3, 'failed', '{"blockers":["fixture"],"artifactAvailable":false}', 'FIXTURE_ERROR')`,
        [jobId, accountA, randomUUID()]
      );

      const beforeRows = await ownedSourceReadback(accountA);
      expect(beforeRows.authAction.count).toBe(1);
      expect(beforeRows.guardianPolicyNotice.count).toBe(1);
      expect(beforeRows.exportJob.count).toBe(1);

      const emitted: AuthenticationAccountExportChunk[] = [];
      let concurrentWriteId: string | undefined;
      const end = await service.captureAccount({
        accountId: accountA,
        sessionToken,
        appId: APP_ID,
        onChunk: async (chunk) => {
          emitted.push(chunk);
          if (chunk.source === 'user' && !concurrentWriteId) {
            concurrentWriteId = randomUUID();
            oauthIds.push(concurrentWriteId);
            await dataSource.query(
              `INSERT INTO "oauth_provider" ("id", "provider", "providerUserId", "providerEmail", "providerDisplayName", "userId")
             VALUES ($1, 'concurrent-writer', 'writer-subject', 'writer@example.test', 'Concurrent Writer', $2)`,
              [concurrentWriteId, accountA]
            );
          }
        },
      });

      // Remove the intentional concurrent row before independent post-capture readback.
      if (concurrentWriteId) {
        await dataSource.query('DELETE FROM "oauth_provider" WHERE "id" = $1', [
          concurrentWriteId,
        ]);
        oauthIds = oauthIds.filter((id) => id !== concurrentWriteId);
      }
      const afterRows = await ownedSourceReadback(accountA);
      expect(afterRows).toEqual(beforeRows);
      console.info(
        'ACCOUNT_OWNER_PG_READBACK_COUNTS_SHA256',
        JSON.stringify(afterRows)
      );

      expect(end.complete).toBe(true);
      expect(end.endOfStream).toBe(true);
      expect(end.sourceRowCounts?.session).toBe(OWNER_PAGE_BOUNDARY + 1);
      expect(end.sourceRowCounts?.oauthProvider).toBe(1);
      const records = emitted.flatMap((chunk) => chunk.records);
      expect(
        records.filter((record) => record.source === 'session')
      ).toHaveLength(OWNER_PAGE_BOUNDARY + 1);
      expect(
        records.some(
          (record) =>
            record.source === 'session' && record.data.id === ownerSessionIds[0]
        )
      ).toBe(true);
      expect(
        records.filter((record) => record.source === 'oauthProvider')
      ).toHaveLength(1);
      expect(
        records.some((record) => record.data.id === foreignSessionId)
      ).toBe(false);
      expect(
        records.some((record) => record.data.id === concurrentWriteId)
      ).toBe(false);
      expect(
        records.find((record) => record.source === 'keyDatum')?.data
          .publicKeyBase64
      ).toBe(Buffer.from('public-fixture-key').toString('base64'));
      const permission = records.find(
        (record) =>
          record.source === 'guardianPermission' &&
          record.data.id === linkedPermissionId
      )?.data;
      expect(permission).toMatchObject({
        role: 'dependent',
        dateOfBirth: '2010-02-03',
      });
      const guardianPermission = records.find(
        (record) =>
          record.source === 'guardianPermission' &&
          record.data.id === reversePermissionId
      )?.data;
      expect(guardianPermission).toMatchObject({
        role: 'guardian',
        ownEmail: `owner-a-${accountA}@example.test`,
        dateOfBirth: null,
      });
      expect(
        records.some(
          (record) =>
            record.source === 'guardianPermission' &&
            record.data.id === legacyNullEmailPermissionId &&
            record.data.role === 'guardian' &&
            record.data.ownEmail === null &&
            record.data.dateOfBirth === null
        )
      ).toBe(true);
      expect(
        records.some(
          (record) =>
            record.source === 'authAction' && record.data.id === actionId
        )
      ).toBe(true);
      expect(
        records.some(
          (record) =>
            record.source === 'guardianPolicyNotice' &&
            record.data.id === noticeId
        )
      ).toBe(true);
      expect(
        records.some(
          (record) =>
            record.source === 'exportJob' &&
            record.data.id === jobId &&
            record.data.appId === 'another-client' &&
            record.data.kind === 'export'
        )
      ).toBe(true);
      const serialized = JSON.stringify(emitted);
      for (const canary of [
        'POSTGRES-PASSWORD-CANARY',
        'POSTGRES-TOTP-CANARY',
        'OTHER-ACCOUNT-PASSWORD-CANARY',
        'POSTGRES-KEY-SALT-CANARY',
        'SESSION-TOKEN-DATA-CANARY',
        'FOREIGN-SESSION-CANARY',
        'COUNTERPART-EMAIL-CANARY',
        'COUNTERPART-STATEMENT-CANARY',
        'COUNTERPART-APPLICANT-EMAIL-CANARY',
        'COUNTERPART-APPLICANT-STATEMENT-CANARY',
        'LEGACY-COUNTERPART-APPLICANT-EMAIL-CANARY',
        'LEGACY-COUNTERPART-STATEMENT-CANARY',
        'UNLINKED-UNRELATED-STATEMENT',
      ])
        expect(serialized).not.toContain(canary);
      expect(
        await dataSource
          .getRepository(GuardianPermissionEntity)
          .exist({ where: { id: linkedPermissionId } })
      ).toBe(true);

      const unlinkedOwnEmailId = randomUUID();
      guardianRows.push(unlinkedOwnEmailId);
      await insertGuardianPermission(
        unlinkedOwnEmailId,
        null,
        null,
        `owner-a-${accountA}@example.test`,
        'unlinked-guardian@example.test',
        'AMBIGUOUS-UNLINKED-CANARY'
      );
      await expect(
        service.captureAccount({
          accountId: accountA,
          sessionToken,
          appId: APP_ID,
          onChunk: async () => undefined,
        })
      ).rejects.toMatchObject({ code: 'OWNER_RELATIONSHIP_AMBIGUOUS' });

      const sessionForB = sessionTokens[1];
      await expect(
        service.captureAccount({
          accountId: accountA,
          sessionToken: sessionForB,
          appId: APP_ID,
          onChunk: async () => undefined,
        })
      ).rejects.toMatchObject({ code: 'OWNER_ACCOUNT_MISMATCH' });
      await expect(
        service.captureAccount({
          accountId: accountA,
          sessionToken,
          appId: 'wrong-app',
          onChunk: async () => undefined,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });

      const sessionRow = await tokens.findOneByOrFail({
        tokenData: sessionToken,
      });
      sessionRow.revoked = true;
      await tokens.save(sessionRow);
      await expect(
        service.captureAccount({
          accountId: accountA,
          sessionToken,
          appId: APP_ID,
          onChunk: async () => undefined,
        })
      ).rejects.toMatchObject({ code: 'OWNER_AUTHORIZATION_FAILED' });
    }, 120_000);

    async function persistSession(accountId: string): Promise<string> {
      const jwt = new JwtService({ secret: JWT_SECRET });
      const rawToken = await jwt.signAsync({
        userId: accountId,
        appId: APP_ID,
      });
      const token = await tokens.save(
        Object.assign(new TokenEntity(), {
          tokenData: rawToken,
          userId: accountId,
          revoked: false,
        })
      );
      tokenIds.push(token.id);
      sessionTokens.push(rawToken);
      return rawToken;
    }

    async function insertGuardianPermission(
      id: string,
      userId: string | null,
      guardianUserId: string | null,
      applicantEmail: string | null,
      guardianEmail: string | null,
      attestationText: string
    ): Promise<void> {
      await dataSource.query(
        `INSERT INTO "guardian_permission" (
        "id", "applicantEmail", "guardianEmail", "dateOfBirth", "userId", "guardianUserId", "status",
        "guardianTokenHash", "resumeTokenHash", "withdrawalTokenHash", "attestationVersion", "attestationText",
        "createdAt", "expiresAt", "attestedAt", "deleteAfter", "resumeExpiresAt",
        "appId", "appName", "uiBaseUrl", "emailFrom", "replyTo"
      ) VALUES ($1, $2, $3, '2010-02-03', $4, $5, 'approved', NULL, NULL, NULL, 'fixture-v1', $6,
        now(), now() + interval '1 day', now(), NULL, NULL, $7, 'Fixture App', 'https://example.test', 'noreply@example.test', NULL)`,
        [
          id,
          applicantEmail,
          guardianEmail,
          userId,
          guardianUserId,
          attestationText,
          APP_ID,
        ]
      );
    }
  }
);
