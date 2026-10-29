import { Injectable } from '@nestjs/common';
import { randomUUID, createHash } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import {
  AccountExportOwnerChunk,
  AccountExportOwnerFailureCode,
  AccountExportOwnerRecord,
  ACCOUNT_EXPORT_COVERAGE_INVENTORY,
  ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
  ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
} from '@optimistic-tanuki/models';
import { AppService } from '../app/app.service';

const PAGE_SIZE = 250;
const PAGE_LIMIT = PAGE_SIZE + 1;
const DEFAULT_CAPTURE_TIMEOUT_MS = 45_000;
const MAX_CAPTURE_TIMEOUT_MS = 45_000;
const ACCOUNT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const AUTHENTICATION_ACCOUNT_EXPORT_SOURCES = [
  'user',
  'keyDatum',
  'session',
  'oauthProvider',
  'authAction',
  'guardianPolicyNotice',
  'exportJob',
  'guardianPermission',
] as const;
export type AuthenticationAccountExportSource =
  (typeof AUTHENTICATION_ACCOUNT_EXPORT_SOURCES)[number];

export type AuthenticationAccountExportRecord =
  AccountExportOwnerRecord<AuthenticationAccountExportSource>;

export type AuthenticationAccountExportChunk =
  AccountExportOwnerChunk<AuthenticationAccountExportSource>;

export interface AuthenticationAccountExportOptions {
  accountId: string;
  sessionToken: string;
  appId: string;
  /** Optional per-capture bound; production default stays below the job lease. */
  captureTimeoutMs?: number;
  signal?: AbortSignal;
  /** Must await durable bounded staging before the next DB page is fetched. */
  onChunk: (
    chunk: AuthenticationAccountExportChunk,
    signal?: AbortSignal
  ) => Promise<void>;
}

export class AuthenticationAccountExportOwnerError extends Error {
  constructor(
    readonly code: AccountExportOwnerFailureCode,
    readonly accountId: string
  ) {
    super(code);
    this.name = 'AuthenticationAccountExportOwnerError';
  }
}

type SafeRow = Record<string, unknown>;

/**
 * Reads every retained Authentication-owned row in one read-only PostgreSQL
 * snapshot. Chunks are emitted only after their bounded page is validated; the
 * only completion signal is emitted after the owner transaction commits.
 */
@Injectable()
export class AuthenticationAccountExportOwnerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly appService: AppService
  ) {}

  async captureAccount(
    options: AuthenticationAccountExportOptions
  ): Promise<AuthenticationAccountExportChunk> {
    const {
      accountId,
      sessionToken,
      appId,
      onChunk,
      signal: externalSignal,
    } = options;
    if (
      typeof accountId !== 'string' ||
      typeof sessionToken !== 'string' ||
      typeof appId !== 'string' ||
      !ACCOUNT_ID_PATTERN.test(accountId)
    ) {
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED',
        accountId
      );
    }
    if (typeof onChunk !== 'function' || !sessionToken || !appId) {
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED',
        accountId
      );
    }
    const timeoutMs = options.captureTimeoutMs ?? DEFAULT_CAPTURE_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > MAX_CAPTURE_TIMEOUT_MS
    ) {
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED',
        accountId
      );
    }

    let principal: {
      data?: { userId?: unknown; appId?: unknown };
      isValid?: boolean;
    };
    try {
      principal = await this.appService.validateToken(sessionToken, appId);
    } catch {
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED',
        accountId
      );
    }
    if (!principal?.isValid) {
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED',
        accountId
      );
    }
    if (
      principal.data?.userId !== accountId ||
      principal.data?.appId !== appId
    ) {
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_ACCOUNT_MISMATCH',
        accountId
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    let committed = false;
    let pageOrdinal = 0;
    let rowCount = 0;
    const checksum = createHash('sha256');
    const sourceRows: Partial<
      Record<AuthenticationAccountExportSource, number>
    > = {};
    for (const source of AUTHENTICATION_ACCOUNT_EXPORT_SOURCES)
      sourceRows[source] = 0;
    const captureId = randomUUID();
    let snapshotAt = '';
    const controller = new AbortController();
    const deadlineAt = Date.now() + timeoutMs;
    const abortFromCaller = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (externalSignal?.aborted) controller.abort();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    timeout.unref?.();
    const boundedSink = (chunk: AuthenticationAccountExportChunk) =>
      this.deliver(
        onChunk,
        chunk,
        accountId,
        controller.signal,
        deadlineAt,
        externalSignal
      );

    try {
      this.assertCaptureActive(controller.signal, accountId);
      await queryRunner.connect();
      await queryRunner.startTransaction('REPEATABLE READ');
      await queryRunner.query('SET TRANSACTION READ ONLY');
      await queryRunner.query(`SET LOCAL statement_timeout = '15s'`);
      await queryRunner.query(`SET LOCAL lock_timeout = '2s'`);
      const [{ snapshotAt: dbSnapshotAt } = {}] = await this.readQuery(
        queryRunner,
        'SELECT transaction_timestamp()::text AS "snapshotAt"',
        [],
        deadlineAt,
        controller.signal,
        accountId
      );
      if (typeof dbSnapshotAt !== 'string' || !dbSnapshotAt) {
        throw new Error('OWNER_READ_FAILED');
      }
      snapshotAt = this.isoValue(dbSnapshotAt, 'snapshotAt');

      const [users] = await this.readQuery(
        queryRunner,
        `SELECT "id", left("email", 4097) AS "email", left("firstName", 4097) AS "firstName",
                left("lastName", 4097) AS "lastName", left("bio", 4097) AS "bio",
                "emailVerifiedAt", "ageEligibilityStatus", "ageEligibilityEndsAt"::text AS "ageEligibilityEndsAt",
                "failedLoginCount", "lockedUntil",
                ("totpSecret" IS NOT NULL AND length("totpSecret") > 0) AS "totpConfigured",
                "keyDataId"
           FROM "user_entity" WHERE "id" = $1`,
        [accountId],
        deadlineAt,
        controller.signal,
        accountId
      );
      if (!users) {
        throw new AuthenticationAccountExportOwnerError(
          'OWNER_ACCOUNT_NOT_FOUND',
          accountId
        );
      }
      const user = users as SafeRow;
      if (user.id !== accountId) this.relationshipFailure(accountId);
      const accountEmail = this.stringValue(user.email, 'email');
      const keyDataId = user.keyDataId == null ? null : String(user.keyDataId);
      const userRecord: SafeRow = {
        id: accountId,
        email: accountEmail,
        firstName: this.stringValue(user.firstName, 'firstName'),
        lastName: this.stringValue(user.lastName, 'lastName'),
        bio: this.stringValue(user.bio, 'bio'),
        emailVerifiedAt: this.dateValue(user.emailVerifiedAt),
        ageEligibilityStatus: this.stringValue(
          user.ageEligibilityStatus,
          'ageEligibilityStatus'
        ),
        ageEligibilityEndsAt: this.dateValue(user.ageEligibilityEndsAt),
        securityState: {
          failedLoginCount: this.nonNegativeInteger(
            user.failedLoginCount,
            'failedLoginCount'
          ),
          lockedUntil: this.dateValue(user.lockedUntil),
          locked: Boolean(
            user.lockedUntil &&
              new Date(String(user.lockedUntil)).getTime() >
                new Date(snapshotAt).getTime()
          ),
          totpConfigured: this.booleanValue(
            user.totpConfigured,
            'totpConfigured'
          ),
        },
      };
      delete user.password;
      delete user.keyDataId;
      await this.emitPage(
        queryRunner,
        boundedSink,
        accountId,
        captureId,
        snapshotAt,
        {
          source: 'user',
          cursor: accountId,
          records: [{ source: 'user', data: userRecord }],
          pageOrdinal: ++pageOrdinal,
          sourceComplete: true,
          checksum,
        }
      );
      rowCount++;
      sourceRows.user = 1;

      const keyResult = await this.emitKeyDatum(
        queryRunner,
        boundedSink,
        accountId,
        captureId,
        snapshotAt,
        keyDataId,
        pageOrdinal,
        checksum,
        deadlineAt,
        controller.signal
      );
      pageOrdinal = keyResult.pageOrdinal;
      rowCount += keyResult.rowCount;
      sourceRows.keyDatum = keyResult.rowCount;

      const pagedSources: Array<{
        source: AuthenticationAccountExportSource;
        sql: string;
        ownerField: 'userId' | 'guardianUserId' | 'accountId';
        map: (row: SafeRow) => SafeRow;
      }> = [
        {
          source: 'session',
          sql: `SELECT "id", "userId", "revoked", "lastActivityAt" FROM "token" WHERE "userId" = $1 AND ($2::uuid IS NULL OR "id" > $2::uuid) ORDER BY "id" LIMIT $3`,
          ownerField: 'userId',
          map: (row) => ({
            id: row.id,
            revoked: this.booleanValue(row.revoked, 'revoked'),
            lastActivityAt: this.dateValue(row.lastActivityAt),
          }),
        },
        {
          source: 'oauthProvider',
          sql: `SELECT "id", "userId", left("provider", 4097) AS "provider",
                       left("providerUserId", 4097) AS "providerUserId",
                       left("providerEmail", 4097) AS "providerEmail",
                       left("providerDisplayName", 4097) AS "providerDisplayName", "createdAt", "updatedAt"
                  FROM "oauth_provider" WHERE "userId" = $1 AND ($2::uuid IS NULL OR "id" > $2::uuid) ORDER BY "id" LIMIT $3`,
          ownerField: 'userId',
          map: (row) => ({
            id: row.id,
            provider: row.provider,
            providerUserId: row.providerUserId,
            providerEmail: row.providerEmail ?? null,
            providerDisplayName: row.providerDisplayName ?? null,
            createdAt: this.isoValue(row.createdAt, 'createdAt'),
            updatedAt: this.isoValue(row.updatedAt, 'updatedAt'),
          }),
        },
        {
          source: 'authAction',
          sql: `SELECT "id", "userId", "purpose", left("appId", 4097) AS "appId",
                       left("returnPath", 2049) AS "returnPath", "expiresAt", "consumedAt", "createdAt"
                  FROM "auth_action_token" WHERE "userId" = $1 AND ($2::uuid IS NULL OR "id" > $2::uuid) ORDER BY "id" LIMIT $3`,
          ownerField: 'userId',
          map: (row) => ({
            id: row.id,
            purpose: row.purpose,
            appId: row.appId,
            returnPath: this.safeReturnPath(row.returnPath),
            expiresAt: this.isoValue(row.expiresAt, 'expiresAt'),
            consumedAt: this.dateValue(row.consumedAt),
            createdAt: this.isoValue(row.createdAt, 'createdAt'),
          }),
        },
        {
          source: 'guardianPolicyNotice',
          sql: `SELECT "id", "guardianUserId", "policyVersion", "policyUrl", "status", "attempts", "nextAttemptAt", "acceptedAt", "createdAt", "updatedAt"
                  FROM "guardian_policy_notice" WHERE "guardianUserId" = $1 AND ($2::uuid IS NULL OR "id" > $2::uuid) ORDER BY "id" LIMIT $3`,
          ownerField: 'guardianUserId',
          map: (row) => ({
            id: row.id,
            policyVersion: row.policyVersion,
            policyUrl: row.policyUrl,
            status: row.status,
            attempts: this.nonNegativeInteger(row.attempts, 'attempts'),
            nextAttemptAt: this.isoValue(row.nextAttemptAt, 'nextAttemptAt'),
            acceptedAt: this.dateValue(row.acceptedAt),
            createdAt: this.isoValue(row.createdAt, 'createdAt'),
            updatedAt: this.isoValue(row.updatedAt, 'updatedAt'),
          }),
        },
        {
          source: 'exportJob',
          sql: `SELECT "id", "accountId", "appId", "kind", "state", "coverageVersion", "attempt",
                       CASE WHEN octet_length("coverageSummary"::text) <= 65536 THEN "coverageSummary"
                            ELSE jsonb_build_object('oversized', true) END AS "coverageSummary",
                       "lastErrorCode", "createdAt", "updatedAt", "completedAt"
                  FROM "account_export_jobs" WHERE "accountId" = $1 AND ($2::uuid IS NULL OR "id" > $2::uuid) ORDER BY "id" LIMIT $3`,
          ownerField: 'accountId',
          map: (row) => ({
            id: row.id,
            appId: row.appId,
            kind: row.kind,
            state: row.state,
            coverageVersion: row.coverageVersion,
            attempt: this.nonNegativeInteger(row.attempt, 'attempt'),
            coverageSummary: this.safeCoverageSummary(row.coverageSummary),
            lastErrorCode: this.safeErrorCode(row.lastErrorCode),
            createdAt: this.isoValue(row.createdAt, 'createdAt'),
            updatedAt: this.isoValue(row.updatedAt, 'updatedAt'),
            completedAt: this.dateValue(row.completedAt),
          }),
        },
      ];

      for (const source of pagedSources) {
        const result = await this.emitPagedSource(
          queryRunner,
          boundedSink,
          accountId,
          captureId,
          snapshotAt,
          source.source,
          source.sql,
          source.ownerField,
          source.map,
          pageOrdinal,
          checksum,
          deadlineAt,
          controller.signal
        );
        pageOrdinal = result.pageOrdinal;
        rowCount += result.rowCount;
        sourceRows[source.source] = result.rowCount;
      }

      const guardian = await this.emitGuardianPermissions(
        queryRunner,
        boundedSink,
        accountId,
        accountEmail,
        captureId,
        snapshotAt,
        pageOrdinal,
        checksum,
        deadlineAt,
        controller.signal
      );
      pageOrdinal = guardian.pageOrdinal;
      rowCount += guardian.rowCount;
      sourceRows.guardianPermission = guardian.rowCount;

      this.assertCaptureActive(controller.signal, accountId, externalSignal);
      await queryRunner.commitTransaction();
      committed = true;
    } catch (error) {
      if (!committed && queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction().catch(() => undefined);
      }
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abortFromCaller);
      if (externalSignal?.aborted)
        throw new AuthenticationAccountExportOwnerError(
          'OWNER_CAPTURE_ABORTED',
          accountId
        );
      if (controller.signal.aborted)
        throw new AuthenticationAccountExportOwnerError(
          'OWNER_CAPTURE_TIMEOUT',
          accountId
        );
      if (error instanceof AuthenticationAccountExportOwnerError) throw error;
      if (
        error instanceof Error &&
        error.message === 'OWNER_STREAM_CONSUMER_FAILED'
      )
        throw new AuthenticationAccountExportOwnerError(
          'OWNER_STREAM_CONSUMER_FAILED',
          accountId
        );
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_READ_FAILED',
        accountId
      );
    } finally {
      await queryRunner.release().catch(() => undefined);
    }

    const finalChunk: AuthenticationAccountExportChunk = {
      contractVersion: ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
      schemaVersion: ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
      participantId: 'authentication',
      accountId,
      captureId,
      snapshotAt,
      pageOrdinal: ++pageOrdinal,
      source: 'end',
      cursor: null,
      records: [],
      endOfStream: true,
      complete: true,
      rowCount,
      checksum: checksum.digest('hex'),
      sourceRowCounts: sourceRows,
      sourceDispositions: {
        user: 'Current account fields and security state; credentials excluded.',
        keyDatum:
          'Public key linked only by User.keyDataId; private material and salt excluded.',
        session:
          'Retained current session rows; token material and profile references excluded.',
        oauthProvider: 'Retained provider links owned by this account.',
        authAction:
          'Retained action rows; token hashes excluded; deleted history is unavailable.',
        guardianPolicyNotice:
          'Notice rows for this guardian; recipient identifiers and lease data excluded.',
        exportJob:
          'Account-wide retained job state, app, coverage and timestamps; idempotency and lease data excluded.',
        guardianPermission:
          'Role-specific own fields; counterpart identifiers, DOB and text excluded.',
      },
      uncovered: [],
      sourceComplete: true,
    };
    try {
      await boundedSink(finalChunk);
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abortFromCaller);
    }
    return finalChunk;
  }

  private async emitKeyDatum(
    runner: QueryRunner,
    onChunk: AuthenticationAccountExportOptions['onChunk'],
    accountId: string,
    captureId: string,
    snapshotAt: string,
    keyDataId: string | null,
    pageOrdinal: number,
    checksum: ReturnType<typeof createHash>,
    deadlineAt: number,
    signal: AbortSignal
  ): Promise<{ pageOrdinal: number; rowCount: number }> {
    const reverseRows = await this.readQuery(
      runner,
      `SELECT "id" FROM "key_datum" WHERE "userId" = $1 ORDER BY "id" LIMIT 2`,
      [accountId],
      deadlineAt,
      signal,
      accountId
    );
    if (reverseRows.length > 1) this.relationshipFailure(accountId);
    const [reverse] = reverseRows;
    if (!keyDataId) {
      if (reverse) this.relationshipFailure(accountId);
      await this.emitPage(runner, onChunk, accountId, captureId, snapshotAt, {
        source: 'keyDatum',
        cursor: null,
        records: [],
        pageOrdinal: ++pageOrdinal,
        sourceComplete: true,
        checksum,
      });
      return { pageOrdinal, rowCount: 0 };
    }
    const [datum] = await this.readQuery(
      runner,
      `SELECT "id", CASE WHEN octet_length("public") <= 49152 THEN "public" ELSE NULL END AS "public", "userId"
         FROM "key_datum" WHERE "id" = $1`,
      [keyDataId],
      deadlineAt,
      signal,
      accountId
    );
    if (
      !datum ||
      (datum.userId != null && datum.userId !== accountId) ||
      (reverse && reverse.id !== keyDataId)
    ) {
      this.relationshipFailure(accountId);
    }
    if (
      !Buffer.isBuffer(datum.public) &&
      !(datum.public instanceof Uint8Array)
    ) {
      this.relationshipFailure(accountId);
    }
    const record = {
      source: 'keyDatum' as const,
      data: {
        id: datum.id,
        publicKeyBase64: Buffer.from(datum.public).toString('base64'),
      },
    };
    await this.emitPage(runner, onChunk, accountId, captureId, snapshotAt, {
      source: 'keyDatum',
      cursor: String(datum.id),
      records: [record],
      pageOrdinal: ++pageOrdinal,
      sourceComplete: true,
      checksum,
    });
    return { pageOrdinal, rowCount: 1 };
  }

  private async emitPagedSource(
    runner: QueryRunner,
    onChunk: AuthenticationAccountExportOptions['onChunk'],
    accountId: string,
    captureId: string,
    snapshotAt: string,
    source: AuthenticationAccountExportSource,
    sql: string,
    ownerField: 'userId' | 'guardianUserId' | 'accountId',
    map: (row: SafeRow) => SafeRow,
    firstPageOrdinal: number,
    checksum: ReturnType<typeof createHash>,
    deadlineAt: number,
    signal: AbortSignal
  ): Promise<{ pageOrdinal: number; rowCount: number }> {
    let cursor: string | null = null;
    let pageOrdinal = firstPageOrdinal;
    let rowCount = 0;
    while (true) {
      const rows = (await this.readQuery(
        runner,
        sql,
        [accountId, cursor, PAGE_LIMIT],
        deadlineAt,
        signal,
        accountId
      )) as SafeRow[];
      if (!Array.isArray(rows) || rows.length > PAGE_LIMIT) {
        throw new Error('malformed page');
      }
      const pageRows = rows.slice(0, PAGE_SIZE);
      if (pageRows.length === 0) {
        if (rowCount === 0) {
          await this.emitPage(
            runner,
            onChunk,
            accountId,
            captureId,
            snapshotAt,
            {
              source,
              cursor: null,
              records: [],
              pageOrdinal: ++pageOrdinal,
              sourceComplete: true,
              checksum,
            }
          );
        }
        break;
      }
      const records: AccountExportOwnerRecord<AuthenticationAccountExportSource>[] =
        [];
      let previous = cursor ?? '';
      for (const row of pageRows) {
        const id = this.stringValue(row.id, 'id');
        if (id <= previous) throw new Error('invalid cursor');
        if (row[ownerField] !== accountId) this.relationshipFailure(accountId);
        previous = id;
        records.push({ source, data: map(row) });
      }
      cursor = previous;
      rowCount += records.length;
      await this.emitPage(runner, onChunk, accountId, captureId, snapshotAt, {
        source,
        cursor,
        records,
        pageOrdinal: ++pageOrdinal,
        sourceComplete: rows.length <= PAGE_SIZE,
        checksum,
      });
      if (rows.length <= PAGE_SIZE) break;
    }
    return { pageOrdinal, rowCount };
  }

  private async emitGuardianPermissions(
    runner: QueryRunner,
    onChunk: AuthenticationAccountExportOptions['onChunk'],
    accountId: string,
    email: string,
    captureId: string,
    snapshotAt: string,
    firstPageOrdinal: number,
    checksum: ReturnType<typeof createHash>,
    deadlineAt: number,
    signal: AbortSignal
  ): Promise<{ pageOrdinal: number; rowCount: number }> {
    const [ambiguous] = await this.readQuery(
      runner,
      `SELECT "id" FROM "guardian_permission"
        WHERE (lower("applicantEmail") = lower($2) AND "userId" IS DISTINCT FROM $1)
           OR (lower("guardianEmail") = lower($2) AND "guardianUserId" IS DISTINCT FROM $1)
        ORDER BY "id" LIMIT 1`,
      [accountId, email],
      deadlineAt,
      signal,
      accountId
    );
    if (ambiguous) this.relationshipFailure(accountId);

    const sql = `SELECT "id", "userId", "guardianUserId", "status", "appId", "appName", "applicantEmail", "guardianEmail", "dateOfBirth"::text AS "dateOfBirth", "attestationVersion", "createdAt", "expiresAt", "attestedAt", "deleteAfter", "resumeExpiresAt"
                   FROM "guardian_permission"
                  WHERE ("userId" = $1 OR "guardianUserId" = $1) AND ($2::uuid IS NULL OR "id" > $2::uuid)
                  ORDER BY "id" LIMIT $3`;
    let cursor: string | null = null;
    let pageOrdinal = firstPageOrdinal;
    let rowCount = 0;
    while (true) {
      const rows = (await this.readQuery(
        runner,
        sql,
        [accountId, cursor, PAGE_LIMIT],
        deadlineAt,
        signal,
        accountId
      )) as SafeRow[];
      if (!Array.isArray(rows) || rows.length > PAGE_LIMIT)
        throw new Error('malformed guardian page');
      const pageRows = rows.slice(0, PAGE_SIZE);
      if (pageRows.length === 0) {
        if (rowCount === 0) {
          await this.emitPage(
            runner,
            onChunk,
            accountId,
            captureId,
            snapshotAt,
            {
              source: 'guardianPermission',
              cursor: null,
              records: [],
              pageOrdinal: ++pageOrdinal,
              sourceComplete: true,
              checksum,
            }
          );
        }
        break;
      }
      const records: AccountExportOwnerRecord<AuthenticationAccountExportSource>[] =
        [];
      let previous = cursor ?? '';
      for (const row of pageRows) {
        const id = this.stringValue(row.id, 'id');
        if (id <= previous) throw new Error('invalid guardian cursor');
        previous = id;
        const applicant = row.userId === accountId;
        const guardian = row.guardianUserId === accountId;
        if (applicant === guardian) this.relationshipFailure(accountId);
        records.push({
          source: 'guardianPermission',
          data: {
            id,
            role: applicant ? 'dependent' : 'guardian',
            status: row.status,
            appId: row.appId,
            appName: row.appName,
            ownEmail:
              (applicant ? row.applicantEmail : row.guardianEmail) == null
                ? null
                : this.stringValue(
                    applicant ? row.applicantEmail : row.guardianEmail,
                    'ownEmail'
                  ),
            dateOfBirth: applicant ? this.dateValue(row.dateOfBirth) : null,
            attestationVersion: row.attestationVersion ?? null,
            createdAt: this.isoValue(row.createdAt, 'createdAt'),
            expiresAt: this.isoValue(row.expiresAt, 'expiresAt'),
            attestedAt: this.dateValue(row.attestedAt),
            deleteAfter: this.dateValue(row.deleteAfter),
            resumeExpiresAt: this.dateValue(row.resumeExpiresAt),
          },
        });
      }
      cursor = previous;
      rowCount += records.length;
      await this.emitPage(runner, onChunk, accountId, captureId, snapshotAt, {
        source: 'guardianPermission',
        cursor,
        records,
        pageOrdinal: ++pageOrdinal,
        sourceComplete: rows.length <= PAGE_SIZE,
        checksum,
      });
      if (rows.length <= PAGE_SIZE) break;
    }
    return { pageOrdinal, rowCount };
  }

  private async emitPage(
    _runner: QueryRunner,
    onChunk: AuthenticationAccountExportOptions['onChunk'],
    accountId: string,
    captureId: string,
    snapshotAt: string,
    page: {
      source: AuthenticationAccountExportSource;
      cursor: string | null;
      records: AccountExportOwnerRecord<AuthenticationAccountExportSource>[];
      pageOrdinal: number;
      sourceComplete: boolean;
      checksum: ReturnType<typeof createHash>;
    }
  ): Promise<void> {
    if (
      page.records.length > PAGE_SIZE ||
      new TextEncoder().encode(JSON.stringify(page.records)).length > 512 * 1024
    ) {
      throw new Error('page size exceeded');
    }
    for (const record of page.records) {
      this.assertSafeFields(record.data);
      page.checksum.update(`${JSON.stringify(record)}\n`);
    }
    await onChunk({
      contractVersion: ACCOUNT_EXPORT_OWNER_CONTRACT_VERSION,
      schemaVersion: ACCOUNT_EXPORT_OWNER_SCHEMA_VERSION,
      participantId: 'authentication',
      accountId,
      captureId,
      snapshotAt,
      pageOrdinal: page.pageOrdinal,
      source: page.source,
      cursor: page.cursor,
      records: page.records,
      sourceComplete: page.sourceComplete,
      endOfStream: false,
      complete: false,
    });
  }

  private async deliver(
    onChunk: AuthenticationAccountExportOptions['onChunk'],
    chunk: AuthenticationAccountExportChunk,
    accountId: string,
    signal: AbortSignal,
    deadlineAt: number,
    externalSignal?: AbortSignal
  ): Promise<void> {
    this.assertCaptureActive(signal, accountId, externalSignal);
    const remainingMs = Math.min(
      MAX_CAPTURE_TIMEOUT_MS,
      deadlineAt - Date.now()
    );
    if (remainingMs <= 0) {
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_CAPTURE_TIMEOUT',
        accountId
      );
    }
    let rejectOnAbort!: (error: Error) => void;
    const aborted = new Promise<never>((_, reject) => {
      rejectOnAbort = reject;
    });
    const onAbort = () =>
      rejectOnAbort(
        new AuthenticationAccountExportOwnerError(
          externalSignal?.aborted
            ? 'OWNER_CAPTURE_ABORTED'
            : 'OWNER_CAPTURE_TIMEOUT',
          accountId
        )
      );
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      await Promise.race([onChunk(chunk, signal), aborted]);
      this.assertCaptureActive(signal, accountId, externalSignal);
      if (Date.now() >= deadlineAt) {
        throw new AuthenticationAccountExportOwnerError(
          'OWNER_CAPTURE_TIMEOUT',
          accountId
        );
      }
    } catch (error) {
      if (error instanceof AuthenticationAccountExportOwnerError) throw error;
      if (externalSignal?.aborted) {
        throw new AuthenticationAccountExportOwnerError(
          'OWNER_CAPTURE_ABORTED',
          accountId
        );
      }
      if (signal.aborted) {
        throw new AuthenticationAccountExportOwnerError(
          'OWNER_CAPTURE_TIMEOUT',
          accountId
        );
      }
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_STREAM_CONSUMER_FAILED',
        accountId
      );
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  private assertCaptureActive(
    signal: AbortSignal,
    accountId: string,
    externalSignal?: AbortSignal
  ): void {
    if (externalSignal?.aborted) {
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_CAPTURE_ABORTED',
        accountId
      );
    }
    if (signal.aborted) {
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_CAPTURE_TIMEOUT',
        accountId
      );
    }
  }

  private async readQuery(
    runner: QueryRunner,
    sql: string,
    parameters: unknown[],
    deadlineAt: number,
    signal: AbortSignal,
    accountId: string
  ): Promise<SafeRow[]> {
    this.assertCaptureActive(signal, accountId);
    const remainingMs = Math.floor(deadlineAt - Date.now());
    if (remainingMs <= 0) {
      throw new AuthenticationAccountExportOwnerError(
        'OWNER_CAPTURE_TIMEOUT',
        accountId
      );
    }
    const queryTimeoutMs = Math.max(1, Math.min(15_000, remainingMs));
    await runner.query(`SELECT set_config('statement_timeout', $1, true)`, [
      `${queryTimeoutMs}ms`,
    ]);
    this.assertCaptureActive(signal, accountId);
    const rows = await runner.query(sql, parameters);
    this.assertCaptureActive(signal, accountId);
    return rows as SafeRow[];
  }

  private relationshipFailure(accountId: string): never {
    throw new AuthenticationAccountExportOwnerError(
      'OWNER_RELATIONSHIP_AMBIGUOUS',
      accountId
    );
  }

  private assertSafeFields(value: unknown, path = ''): void {
    if (
      value === null ||
      typeof value === 'boolean' ||
      typeof value === 'number'
    )
      return;
    if (typeof value === 'string') {
      const max =
        path === 'publicKeyBase64' || path.endsWith('.publicKeyBase64')
          ? 65536
          : 4096;
      if (value.length > max) throw new Error('field size exceeded');
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > PAGE_SIZE) throw new Error('field size exceeded');
      value.forEach((item, index) =>
        this.assertSafeFields(item, `${path}[${index}]`)
      );
      return;
    }
    if (typeof value !== 'object') throw new Error('invalid field value');
    const forbidden = new Set([
      'password',
      'totpSecret',
      'tokenData',
      'tokenHash',
      'salt',
      'guardianTokenHash',
      'resumeTokenHash',
      'withdrawalTokenHash',
      'leaseOwner',
      'leaseExpiresAt',
      'idempotencyKey',
    ]);
    for (const [key, item] of Object.entries(value)) {
      if (forbidden.has(key)) throw new Error('credential field in export row');
      this.assertSafeFields(item, path ? `${path}.${key}` : key);
    }
  }

  private stringValue(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length > 4096) {
      throw new Error(`invalid ${field}`);
    }
    return value;
  }

  private nonNegativeInteger(value: unknown, field: string): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0)
      throw new Error(`invalid ${field}`);
    return parsed;
  }

  private booleanValue(value: unknown, field: string): boolean {
    if (typeof value !== 'boolean') throw new Error(`invalid ${field}`);
    return value;
  }

  private dateValue(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const date = new Date(String(value));
    if (!Number.isFinite(date.getTime())) throw new Error('invalid date');
    return date.toISOString();
  }

  private isoValue(value: unknown, field: string): string {
    const parsed = this.dateValue(value);
    if (!parsed) throw new Error(`invalid ${field}`);
    return parsed;
  }

  private safeErrorCode(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(value)) {
      throw new Error('invalid job error code');
    }
    return value;
  }

  private safeReturnPath(value: unknown): string {
    const path = this.stringValue(value, 'returnPath');
    if (
      path.length > 2048 ||
      !path.startsWith('/') ||
      path.startsWith('//') ||
      [...path].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
      )
    ) {
      throw new Error('invalid return path');
    }
    return path;
  }

  private safeCoverageSummary(value: unknown): SafeRow {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('invalid coverage summary');
    }
    const summary = value as SafeRow;
    const blockers = summary.blockers;
    if (
      !Array.isArray(blockers) ||
      blockers.length > 100 ||
      !blockers.every(
        (blocker) =>
          typeof blocker === 'string' &&
          blocker.length <= 128 &&
          /^[A-Za-z0-9:_-]+$/.test(blocker)
      )
    ) {
      throw new Error('invalid coverage summary');
    }
    const result: SafeRow = { blockers: [...blockers] };
    if (summary.participantCount != null) {
      result.participantCount = this.nonNegativeInteger(
        summary.participantCount,
        'participantCount'
      );
    }
    if (summary.artifactAvailable != null) {
      if (typeof summary.artifactAvailable !== 'boolean') {
        throw new Error('invalid coverage summary');
      }
      result.artifactAvailable = summary.artifactAvailable;
    }
    if (summary.capturedDatabaseOwners != null) {
      const owners = summary.capturedDatabaseOwners;
      const knownOwners = new Set<string>(
        ACCOUNT_EXPORT_COVERAGE_INVENTORY.participants
      );
      if (
        !Array.isArray(owners) ||
        owners.length > ACCOUNT_EXPORT_COVERAGE_INVENTORY.participants.length ||
        !owners.every(
          (owner) =>
            typeof owner === 'string' &&
            owner.length <= 80 &&
            knownOwners.has(owner)
        ) ||
        new Set(owners).size !== owners.length
      ) {
        throw new Error('invalid coverage summary');
      }
      result.capturedDatabaseOwners = [...owners];
    }
    return result;
  }
}
