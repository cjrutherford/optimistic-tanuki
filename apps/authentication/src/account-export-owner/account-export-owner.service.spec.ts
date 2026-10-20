import { createHash } from 'crypto';
import {
  AccountExportOwnerCaptureVerifier,
  AccountExportOwnerChunk,
} from '@optimistic-tanuki/models';
import { AppService } from '../app/app.service';
import {
  AUTHENTICATION_ACCOUNT_EXPORT_SOURCES,
  AuthenticationAccountExportSource,
  AuthenticationAccountExportChunk,
  AuthenticationAccountExportOwnerError,
  AuthenticationAccountExportOwnerService,
} from './account-export-owner.service';

const ACCOUNT_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_ACCOUNT_ID = '10000000-0000-4000-8000-000000000002';
const APP_ID = 'client-interface';
const SNAPSHOT = '2026-10-19T14:00:00.000Z';
const KEY_DATA_ID = '30000000-0000-4000-8000-000000000001';

function id(value: number): string {
  return `20000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
}

function createHarness(
  overrides: {
    user?: Record<string, unknown>;
    coverageSummary?: Record<string, unknown>;
  } = {}
) {
  const baseRow = { createdAt: SNAPSHOT, updatedAt: SNAPSHOT };
  const oauthRows = Array.from({ length: 1007 }, (_, index) => ({
    id: id(index + 1),
    provider: 'test-provider',
    providerUserId: `provider-user-${index + 1}`,
    providerEmail: `member-${index + 1}@example.test`,
    providerDisplayName: `Member ${index + 1}`,
    createdAt: SNAPSHOT,
    updatedAt: SNAPSHOT,
    userId: ACCOUNT_ID,
  }));
  const emitted: AuthenticationAccountExportChunk[] = [];
  const statements: string[] = [];
  const rowsBySource: Record<string, Record<string, unknown>[]> = {
    token: [
      {
        id: id(2001),
        userId: ACCOUNT_ID,
        revoked: false,
        tokenData: 'TOKEN-DATA-CANARY',
      },
    ],
    auth_action_token: [
      {
        id: id(2002),
        userId: ACCOUNT_ID,
        purpose: 'verification',
        appId: APP_ID,
        returnPath: '/settings',
        expiresAt: SNAPSHOT,
        consumedAt: null,
        createdAt: SNAPSHOT,
        tokenHash: 'ACTION-TOKEN-HASH-CANARY',
      },
    ],
    guardian_policy_notice: [
      {
        id: id(2003),
        guardianUserId: ACCOUNT_ID,
        policyVersion: 'policy-v1',
        policyUrl: 'https://example.test/policy',
        status: 'accepted',
        attempts: 1,
        nextAttemptAt: SNAPSHOT,
        acceptedAt: SNAPSHOT,
        ...baseRow,
      },
    ],
    account_export_jobs: [
      {
        id: id(2004),
        accountId: ACCOUNT_ID,
        appId: APP_ID,
        kind: 'export',
        state: 'incomplete',
        coverageVersion: '2026-10-17.v1',
        attempt: 1,
        coverageSummary: overrides.coverageSummary ?? {
          blockers: ['coverage-inventory-unaccepted'],
          participantCount: 1,
          artifactAvailable: false,
          capturedDatabaseOwners: ['authentication'],
        },
        lastErrorCode: null,
        completedAt: null,
        ...baseRow,
        idempotencyKey: 'JOB-IDEMPOTENCY-CANARY',
        leaseOwner: 'JOB-LEASE-CANARY',
      },
    ],
    guardian_permission: [
      {
        id: id(2005),
        userId: ACCOUNT_ID,
        guardianUserId: OTHER_ACCOUNT_ID,
        status: 'approved',
        appId: APP_ID,
        appName: 'Client Interface',
        applicantEmail: 'member@example.test',
        guardianEmail: 'COUNTERPART-EMAIL-CANARY',
        dateOfBirth: '2010-02-03',
        attestationVersion: 'guardian-v1',
        createdAt: SNAPSHOT,
        expiresAt: SNAPSHOT,
        attestedAt: SNAPSHOT,
        deleteAfter: null,
        resumeExpiresAt: null,
        attestationText: 'COUNTERPART-STATEMENT-CANARY',
        guardianTokenHash: 'GUARDIAN-TOKEN-CANARY',
      },
    ],
  };
  const queryRunner = {
    isTransactionActive: false,
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async (level: string) => {
      expect(level).toBe('REPEATABLE READ');
      queryRunner.isTransactionActive = true;
    }),
    commitTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = false;
    }),
    rollbackTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = false;
    }),
    release: jest.fn(async () => undefined),
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      statements.push(sql);
      if (sql.includes('transaction_timestamp'))
        return [{ snapshotAt: SNAPSHOT }];
      if (sql.includes('FROM "user_entity"')) {
        return [
          {
            id: ACCOUNT_ID,
            email: 'member@example.test',
            firstName: 'Member',
            lastName: 'Example',
            bio: 'Own bio',
            emailVerifiedAt: SNAPSHOT,
            ageEligibilityStatus: 'adult',
            ageEligibilityEndsAt: null,
            failedLoginCount: 3,
            lockedUntil: null,
            totpConfigured: true,
            totpSecret: 'NEVER-EXPORT-TOTP-CANARY',
            password: 'NEVER-EXPORT-PASSWORD-CANARY',
            keyDataId: KEY_DATA_ID,
            ...overrides.user,
          },
        ];
      }
      if (sql.includes('FROM "key_datum"') && sql.includes('"userId" = $1'))
        return [{ id: KEY_DATA_ID }];
      if (sql.includes('FROM "key_datum"'))
        return [
          {
            id: KEY_DATA_ID,
            public: Buffer.from('PUBLIC-KEY-CANARY'),
            userId: ACCOUNT_ID,
            salt: 'KEY-SALT-CANARY',
          },
        ];
      if (sql.includes('FROM "guardian_permission"') && sql.includes('lower('))
        return [];
      if (sql.includes('FROM "guardian_permission"')) {
        const cursor = String(params[1] ?? '');
        return rowsBySource.guardian_permission
          .filter((row) => String(row.id) > cursor)
          .slice(0, Number(params[2] ?? 251));
      }
      let rows: Record<string, unknown>[] = [];
      if (sql.includes('FROM "oauth_provider"')) rows = oauthRows;
      else if (sql.includes('FROM "token"')) rows = rowsBySource.token;
      else if (sql.includes('FROM "auth_action_token"'))
        rows = rowsBySource.auth_action_token;
      else if (sql.includes('FROM "guardian_policy_notice"'))
        rows = rowsBySource.guardian_policy_notice;
      else if (sql.includes('FROM "account_export_jobs"'))
        rows = rowsBySource.account_export_jobs;
      const cursor = String(params[1] ?? '');
      const limit = Number(params[2] ?? 251);
      return rows.filter((row) => String(row.id) > cursor).slice(0, limit);
    }),
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };
  const appService = {
    validateToken: jest.fn(async () => ({
      isValid: true,
      data: { userId: ACCOUNT_ID, appId: APP_ID },
    })),
  } as unknown as AppService;
  const service = new AuthenticationAccountExportOwnerService(
    dataSource as never,
    appService
  );
  return { service, appService, queryRunner, emitted, statements };
}

describe('AuthenticationAccountExportOwnerService', () => {
  it('rejects an oversized field instead of returning a truncated complete snapshot', async () => {
    const { service, emitted, queryRunner } = createHarness({
      user: { bio: 'x'.repeat(4097) },
    });
    await expect(
      service.captureAccount({
        accountId: ACCOUNT_ID,
        sessionToken: 'validated-session',
        appId: APP_ID,
        onChunk: async (chunk) => {
          emitted.push(chunk);
        },
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
    expect(emitted.some((chunk) => chunk.complete)).toBe(false);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unknown owner', ['not-a-known-owner']],
    ['duplicate owners', ['authentication', 'authentication']],
    [
      'oversized owner list',
      Array.from({ length: 25 }, () => 'authentication'),
    ],
  ])(
    'rejects malformed captured owner metadata: %s',
    async (_name, capturedDatabaseOwners) => {
      const { service, emitted } = createHarness({
        coverageSummary: {
          blockers: ['coverage-inventory-unaccepted'],
          participantCount: 1,
          artifactAvailable: false,
          capturedDatabaseOwners,
        },
      });
      await expect(
        service.captureAccount({
          accountId: ACCOUNT_ID,
          sessionToken: 'validated-session',
          appId: APP_ID,
          onChunk: async (chunk) => {
            emitted.push(chunk);
          },
        })
      ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
      expect(emitted.some((chunk) => chunk.complete)).toBe(false);
    }
  );

  it('rejects malformed guardian pages and foreign hidden owner fields', async () => {
    for (const malformedGuardian of [true, false]) {
      const { service, queryRunner, emitted } = createHarness();
      const read = queryRunner.query.getMockImplementation()!;
      queryRunner.query.mockImplementation(async (sql, params = []) => {
        if (
          malformedGuardian &&
          sql.includes('FROM "guardian_permission"') &&
          !sql.includes('lower(')
        ) {
          return { malformed: true } as never;
        }
        const rows = await read(sql, params);
        if (!malformedGuardian && sql.includes('FROM "oauth_provider"')) {
          return rows.map((row) => ({ ...row, userId: OTHER_ACCOUNT_ID }));
        }
        return rows;
      });
      await expect(
        service.captureAccount({
          accountId: ACCOUNT_ID,
          sessionToken: 'validated-session',
          appId: APP_ID,
          onChunk: async (chunk) => {
            emitted.push(chunk);
          },
        })
      ).rejects.toBeInstanceOf(AuthenticationAccountExportOwnerError);
      expect(emitted.some((chunk) => chunk.complete)).toBe(false);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    }
  });

  it('bounds a hung sink, aborts its signal and releases the rolled-back capture', async () => {
    const { service, queryRunner } = createHarness();
    let sinkSignal: AbortSignal | undefined;
    await expect(
      service.captureAccount({
        accountId: ACCOUNT_ID,
        sessionToken: 'validated-session',
        appId: APP_ID,
        captureTimeoutMs: 25,
        onChunk: async (_chunk, signal) => {
          sinkSignal = signal;
          await new Promise<void>(() => undefined);
        },
      })
    ).rejects.toMatchObject({ code: 'OWNER_CAPTURE_TIMEOUT' });
    expect(sinkSignal?.aborted).toBe(true);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('rejects cancellation during terminal delivery even when the sink resolves', async () => {
    const { service, queryRunner } = createHarness();
    const caller = new AbortController();
    await expect(
      service.captureAccount({
        accountId: ACCOUNT_ID,
        sessionToken: 'validated-session',
        appId: APP_ID,
        signal: caller.signal,
        onChunk: async (chunk) => {
          if (chunk.endOfStream) caller.abort();
        },
      })
    ).rejects.toMatchObject({ code: 'OWNER_CAPTURE_ABORTED' });
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('streams every row across bounded pages and only emits completion after commit', async () => {
    const { service, queryRunner, emitted, statements } = createHarness();
    const result = await service.captureAccount({
      accountId: ACCOUNT_ID,
      sessionToken: 'validated-session',
      appId: APP_ID,
      onChunk: async (chunk) => {
        emitted.push(chunk);
        if (chunk.complete)
          expect(queryRunner.commitTransaction).toHaveBeenCalled();
      },
    });

    const chunks =
      emitted as AccountExportOwnerChunk<AuthenticationAccountExportSource>[];
    const verifier = new AccountExportOwnerCaptureVerifier(
      'authentication',
      ACCOUNT_ID,
      AUTHENTICATION_ACCOUNT_EXPORT_SOURCES,
      createHash('sha256'),
      250,
      512 * 1024
    );
    for (const chunk of chunks) verifier.accept(chunk);
    expect(result.complete).toBe(true);
    expect(result.rowCount).toBe(1014);
    expect(
      chunks.filter((chunk) => chunk.source === 'oauthProvider')
    ).toHaveLength(5);
    expect(
      chunks
        .flatMap((chunk) => chunk.records)
        .filter((record) => record.source === 'oauthProvider')
    ).toHaveLength(1007);
    expect(
      chunks
        .filter((chunk) => chunk.source === 'oauthProvider')
        .every((chunk) => chunk.records.length <= 250)
    ).toBe(true);
    expect(queryRunner.startTransaction).toHaveBeenCalledWith(
      'REPEATABLE READ'
    );
    expect(statements).toContain('SET TRANSACTION READ ONLY');
    expect(statements).toContain(`SET LOCAL statement_timeout = '15s'`);
    expect(statements).toContain(`SET LOCAL lock_timeout = '2s'`);
    expect(JSON.stringify(chunks)).not.toContain(
      'NEVER-EXPORT-PASSWORD-CANARY'
    );
    expect(JSON.stringify(chunks)).not.toContain('NEVER-EXPORT-TOTP-CANARY');
    for (const canary of [
      'TOKEN-DATA-CANARY',
      'ACTION-TOKEN-HASH-CANARY',
      'KEY-SALT-CANARY',
      'GUARDIAN-TOKEN-CANARY',
      'JOB-IDEMPOTENCY-CANARY',
      'JOB-LEASE-CANARY',
      'COUNTERPART-EMAIL-CANARY',
      'COUNTERPART-STATEMENT-CANARY',
    ])
      expect(JSON.stringify(chunks)).not.toContain(canary);
    expect(
      chunks
        .flatMap((chunk) => chunk.records)
        .find((record) => record.source === 'guardianPermission')?.data
    ).toMatchObject({
      role: 'dependent',
      ownEmail: 'member@example.test',
      dateOfBirth: '2010-02-03',
    });
    expect(
      chunks
        .flatMap((chunk) => chunk.records)
        .find((record) => record.source === 'exportJob')?.data.coverageSummary
    ).toMatchObject({ capturedDatabaseOwners: ['authentication'] });
  });

  it('rejects an invalid or foreign validated session before opening a database capture', async () => {
    const { service, appService, queryRunner } = createHarness();
    (appService.validateToken as jest.Mock).mockResolvedValue({
      isValid: true,
      data: { userId: OTHER_ACCOUNT_ID, appId: APP_ID },
    });

    await expect(
      service.captureAccount({
        accountId: ACCOUNT_ID,
        sessionToken: 'another-users-session',
        appId: APP_ID,
        onChunk: async () => undefined,
      })
    ).rejects.toMatchObject({ code: 'OWNER_ACCOUNT_MISMATCH' });
    expect(queryRunner.connect).not.toHaveBeenCalled();
  });

  it('rolls back and emits no complete envelope after a page reader fails', async () => {
    const { service, queryRunner, emitted } = createHarness();
    queryRunner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('user_entity'))
        throw new Error('synthetic read failure');
      if (sql.includes('set_config')) return [];
      if (sql.includes('transaction_timestamp'))
        return [{ snapshotAt: SNAPSHOT }];
      return [];
    });
    await expect(
      service.captureAccount({
        accountId: ACCOUNT_ID,
        sessionToken: 'validated-session',
        appId: APP_ID,
        onChunk: async (chunk) => {
          emitted.push(chunk);
        },
      })
    ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(emitted.some((chunk) => chunk.complete)).toBe(false);
  });

  it('fails closed when a consumer rejects a streamed page', async () => {
    const { service, queryRunner } = createHarness();
    await expect(
      service.captureAccount({
        accountId: ACCOUNT_ID,
        sessionToken: 'validated-session',
        appId: APP_ID,
        onChunk: async () => {
          throw new Error('do not surface consumer detail');
        },
      })
    ).rejects.toBeInstanceOf(AuthenticationAccountExportOwnerError);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});
