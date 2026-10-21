import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerChunk,
  AccountExportOwnerFailureCode,
  AccountExportOwnerRecord,
} from '@optimistic-tanuki/models';
import { AccountExportOwnerEmitter } from '@optimistic-tanuki/storage';
import { PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/profile-contracts';
import { ProfileAccountExportLegacyReader } from './account-export-legacy-reader';
import { firstValueFrom, timeout } from 'rxjs';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';

export const PROFILE_ACCOUNT_EXPORT_SOURCES =
  PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES;
export type ProfileAccountExportSource =
  (typeof PROFILE_ACCOUNT_EXPORT_SOURCES)[number];
export type ProfileAccountExportChunk =
  AccountExportOwnerChunk<ProfileAccountExportSource>;
export type ProfileAccountExportRecord =
  AccountExportOwnerRecord<ProfileAccountExportSource>;

export interface ProfileAccountExportOptions {
  accountId: string;
  sessionToken: string;
  appId: string;
  captureTimeoutMs?: number;
  signal?: AbortSignal;
  onChunk: (
    chunk: ProfileAccountExportChunk,
    signal?: AbortSignal
  ) => Promise<void>;
}

export class ProfileAccountExportOwnerError extends Error {
  constructor(
    readonly code: AccountExportOwnerFailureCode,
    readonly accountId: string
  ) {
    super(code);
    this.name = 'ProfileAccountExportOwnerError';
  }
}

type Row = Record<string, unknown>;
const PRINCIPAL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 200;
const PAGE_LIMIT = PAGE_SIZE + 1;
const MAX_CAPTURE_TIMEOUT_MS = 45_000;
const AUTH_TIMEOUT_MS = 3_000;
const STATEMENT_TIMEOUT_MS = 10_000;
const LOCK_TIMEOUT_MS = 2_000;
const MAX_INLINE_TEXT_CHARS = 2_500;
const TEXT_CHUNK_CHARS = 1_000;
const MEDIA_BASE64_CHUNK_CHARS = 64 * 1024;
const MAX_INLINE_MEDIA_BYTES = 20 * 1024 * 1024;
const PROFILE_TEXT_FIELDS = [
  'appScope',
  'profileName',
  'bio',
  'location',
  'occupation',
  'interests',
  'skills',
] as const;
type ProfileTextField = (typeof PROFILE_TEXT_FIELDS)[number];
const MEDIA_FIELDS = ['profilePic', 'coverPic'] as const;
type MediaField = (typeof MEDIA_FIELDS)[number];
const INLINE_MEDIA_HEADER = /^(data:image\/(?:png|jpeg);base64,)/;

/** Streams every retained Profile-owned row from one read-only DB snapshot. */
@Injectable()
export class ProfileAccountExportOwnerService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy
  ) {}

  async captureAccount(
    options: ProfileAccountExportOptions
  ): Promise<ProfileAccountExportChunk> {
    const {
      accountId: requestedAccountId,
      sessionToken,
      appId,
      onChunk,
      signal: externalSignal,
    } = options ?? ({} as ProfileAccountExportOptions);
    if (
      typeof requestedAccountId !== 'string' ||
      !PRINCIPAL_ID_PATTERN.test(requestedAccountId)
    ) {
      throw new ProfileAccountExportOwnerError(
        'OWNER_ACCOUNT_MISMATCH',
        typeof requestedAccountId === 'string' ? requestedAccountId : ''
      );
    }
    const accountId = requestedAccountId.toLowerCase();
    if (
      typeof sessionToken !== 'string' ||
      sessionToken.trim().length === 0 ||
      sessionToken.length > 8192 ||
      typeof appId !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(appId) ||
      typeof onChunk !== 'function'
    ) {
      throw new ProfileAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED',
        accountId
      );
    }
    const timeoutMs = options.captureTimeoutMs ?? MAX_CAPTURE_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > MAX_CAPTURE_TIMEOUT_MS
    ) {
      throw new ProfileAccountExportOwnerError(
        'OWNER_CAPTURE_TIMEOUT',
        accountId
      );
    }
    await this.assertAuthenticatedSubject(accountId, sessionToken, appId);

    const controller = new AbortController();
    const deadlineAt = Date.now() + timeoutMs;
    let timedOut = false;
    const abortFromCaller = (): void => controller.abort();
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (externalSignal?.aborted) controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    timer.unref?.();

    const queryRunner = this.dataSource.createQueryRunner();
    let committed = false;
    try {
      this.assertActive(controller.signal, deadlineAt, timedOut, accountId);
      await queryRunner.connect();
      await queryRunner.startTransaction('REPEATABLE READ');
      await queryRunner.query('SET TRANSACTION READ ONLY');
      await queryRunner.query(
        `SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT_MS}ms'`
      );
      await queryRunner.query(
        `SET LOCAL lock_timeout = '${LOCK_TIMEOUT_MS}ms'`
      );
      const [snapshot] = (await this.readQuery(
        queryRunner,
        'SELECT transaction_timestamp()::text AS "snapshotAt"',
        [],
        controller.signal,
        deadlineAt,
        timedOut,
        accountId
      )) as Row[];
      const snapshotAt = this.dateString(
        snapshot?.['snapshotAt'],
        'snapshotAt'
      );
      const legacy = new ProfileAccountExportLegacyReader(
        accountId,
        (sql, parameters) =>
          this.readQuery(
            queryRunner,
            sql,
            parameters,
            controller.signal,
            deadlineAt,
            timedOut,
            accountId
          )
      );
      const captureId = randomUUID();
      const emitter = new AccountExportOwnerEmitter<ProfileAccountExportSource>(
        {
          participantId: 'profile',
          accountId,
          captureId,
          snapshotAt,
          sources: PROFILE_ACCOUNT_EXPORT_SOURCES,
          signal: controller.signal,
        },
        onChunk
      );
      await emitter.emitSources({
        profileIdentity: () =>
          this.profileIdentityRows(
            queryRunner,
            accountId,
            controller.signal,
            deadlineAt,
            () => timedOut
          ),
        profileMedia: () =>
          this.profileMediaRows(
            queryRunner,
            accountId,
            controller.signal,
            deadlineAt,
            () => timedOut
          ),
        profileText: () =>
          this.profileTextRows(
            queryRunner,
            accountId,
            controller.signal,
            deadlineAt,
            () => timedOut
          ),
        timelineText: () =>
          this.timelineTextRows(
            queryRunner,
            accountId,
            controller.signal,
            deadlineAt,
            () => timedOut
          ),
        profile: () =>
          this.profileRows(
            queryRunner,
            accountId,
            controller.signal,
            deadlineAt,
            () => timedOut
          ),
        timeline: () =>
          this.timelineRows(
            queryRunner,
            accountId,
            controller.signal,
            deadlineAt,
            () => timedOut
          ),
        guardianActivity: () =>
          this.guardianActivityRows(
            queryRunner,
            accountId,
            controller.signal,
            deadlineAt,
            () => timedOut
          ),
        legacyGoalText: () => legacy.legacyGoalTextRows(),
        legacyGoal: () => legacy.legacyGoalRows(),
        legacyProjectText: () => legacy.legacyProjectTextRows(),
        legacyProject: () => legacy.legacyProjectRows(),
      });
      const identityCount = emitter.getSourceRowCount('profileIdentity');
      const profileCount = emitter.getSourceRowCount('profile');
      if (identityCount !== profileCount) {
        throw new ProfileAccountExportOwnerError(
          'OWNER_READ_FAILED',
          accountId
        );
      }
      this.assertActive(controller.signal, deadlineAt, timedOut, accountId);
      await queryRunner.commitTransaction();
      committed = true;
      await queryRunner.release();
      return await emitter.complete({
        profileIdentity: 'same-snapshot-owned-profile-identity',
        profileMedia: 'inline-bytes-decoded; references-preserved',
        profileText: 'full-text-inline-or-ordered-field-chunks',
        timelineText: 'full-timeline-text-inline-or-ordered-field-chunks',
        profile: 'all-retained-profile-columns',
        timeline: 'all-retained-owned-timeline-rows',
        guardianActivity: 'retained-activity-role-projected-and-verified',
        legacyGoalText: 'full-legacy-goal-text-inline-or-ordered-field-chunks',
        legacyGoal: 'all-retained-owned-legacy-goals',
        legacyProjectText:
          'full-legacy-project-text-inline-or-ordered-field-chunks',
        legacyProject: 'all-retained-owned-legacy-projects',
      });
    } catch (error) {
      if (error instanceof ProfileAccountExportOwnerError) throw error;
      if (controller.signal.aborted || externalSignal?.aborted) {
        throw new ProfileAccountExportOwnerError(
          timedOut ? 'OWNER_CAPTURE_TIMEOUT' : 'OWNER_CAPTURE_ABORTED',
          accountId
        );
      }
      if (
        error instanceof Error &&
        error.message === 'OWNER_STREAM_CONSUMER_FAILED'
      ) {
        throw new ProfileAccountExportOwnerError(
          'OWNER_STREAM_CONSUMER_FAILED',
          accountId
        );
      }
      throw new ProfileAccountExportOwnerError('OWNER_READ_FAILED', accountId);
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abortFromCaller);
      if (!committed && queryRunner.isTransactionActive) {
        try {
          await queryRunner.rollbackTransaction();
        } catch {
          // Preserve the stable capture failure; this runner is released below.
        }
      }
      try {
        await queryRunner.release();
      } catch {
        // No terminal chunk was emitted before commit; cleanup failure stays private.
      }
    }
  }

  private async assertAuthenticatedSubject(
    accountId: string,
    token: string,
    appId: string
  ): Promise<void> {
    let validation: {
      isValid?: boolean;
      data?: { userId?: string; appId?: string };
    };
    try {
      validation = await firstValueFrom(
        this.authClient
          .send(
            { cmd: AuthCommands.Validate },
            { token, userId: accountId, appId }
          )
          .pipe(timeout({ first: AUTH_TIMEOUT_MS }))
      );
    } catch {
      throw new ProfileAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED',
        accountId
      );
    }
    if (
      validation?.isValid !== true ||
      !this.isAccountId(validation.data?.userId, accountId) ||
      validation.data?.appId !== appId
    ) {
      throw new ProfileAccountExportOwnerError(
        'OWNER_AUTHORIZATION_FAILED',
        accountId
      );
    }
  }

  private async *profileIdentityRows(
    runner: QueryRunner,
    accountId: string,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): AsyncGenerator<ProfileAccountExportRecord> {
    for await (const row of this.uuidPages(
      runner,
      'SELECT "id"::text AS "id", "userId" FROM "profile" WHERE lower("userId") = $1 AND ($2::uuid IS NULL OR "id" > $2::uuid) ORDER BY "id" LIMIT $3',
      accountId,
      signal,
      deadlineAt,
      timedOut
    )) {
      const id = this.uuid(row['id'], 'profile id');
      if (!this.isAccountId(row['userId'], accountId))
        this.relationshipFailure(accountId);
      yield { source: 'profileIdentity', data: { id, userId: accountId } };
    }
  }

  private async *profileRows(
    runner: QueryRunner,
    accountId: string,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): AsyncGenerator<ProfileAccountExportRecord> {
    for await (const row of this.profilePages(
      runner,
      accountId,
      signal,
      deadlineAt,
      timedOut
    )) {
      const id = this.uuid(row['id'], 'profile id');
      if (!this.isAccountId(row['userId'], accountId))
        this.relationshipFailure(accountId);
      const data: Row = {
        id,
        userId: accountId,
        appScope: this.textValue(row, 'appScope', id),
        profileName: this.textValue(row, 'profileName', id),
        bio: this.textValue(row, 'bio', id),
        location: this.textValue(row, 'location', id),
        occupation: this.textValue(row, 'occupation', id),
        interests: this.textValue(row, 'interests', id),
        skills: this.textValue(row, 'skills', id),
        blogRole: this.blogRoleValue(row['blogRole'], accountId),
        created_at: this.dateString(row['createdAt'], 'createdAt'),
        profilePic: this.mediaFieldValue(row, 'profilePic', id, 0),
        coverPic: this.mediaFieldValue(row, 'coverPic', id, 1),
      };
      yield { source: 'profile', data };
    }
  }

  private async *profileTextRows(
    runner: QueryRunner,
    accountId: string,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): AsyncGenerator<ProfileAccountExportRecord> {
    const fields: readonly string[] = [...PROFILE_TEXT_FIELDS, ...MEDIA_FIELDS];
    for await (const profile of this.profilePages(
      runner,
      accountId,
      signal,
      deadlineAt,
      timedOut
    )) {
      const profileId = this.uuid(profile['id'], 'profile id');
      if (!this.isAccountId(profile['userId'], accountId))
        this.relationshipFailure(accountId);
      for (const [fieldIndex, field] of fields.entries()) {
        const chars = this.numberValue(
          profile[`${field}Chars`],
          `${field}Chars`
        );
        if (chars <= MAX_INLINE_TEXT_CHARS) continue;
        if (
          (field === 'profilePic' || field === 'coverPic') &&
          this.mediaPrefix(profile, field).startsWith('data:')
        ) {
          continue;
        }
        const byteLength = this.numberValue(
          profile[`${field}Bytes`],
          `${field}Bytes`
        );
        let offset = 1;
        let chunkIndex = 0;
        while (offset <= chars) {
          const [chunk] = (await this.readQuery(
            runner,
            `SELECT substring("${field}" from $2::integer for $3::integer) AS "value" FROM "profile" WHERE "id" = $1::uuid AND lower("userId") = $4`,
            [profileId, offset, TEXT_CHUNK_CHARS, accountId],
            signal,
            deadlineAt,
            timedOut(),
            accountId
          )) as Row[];
          const value = this.stringValue(chunk?.['value'], field);
          if (value.length === 0) this.readFailure(accountId);
          yield {
            source: 'profileText',
            data: {
              id: this.textChunkId(profileId, fieldIndex, chunkIndex++),
              accountId,
              profileId,
              field,
              charOffset: offset - 1,
              charLength: Array.from(value).length,
              byteLength,
              value,
            },
          };
          offset += Array.from(value).length;
        }
      }
    }
  }

  private async *profileMediaRows(
    runner: QueryRunner,
    accountId: string,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): AsyncGenerator<ProfileAccountExportRecord> {
    for await (const row of this.profilePages(
      runner,
      accountId,
      signal,
      deadlineAt,
      timedOut
    )) {
      const profileId = this.uuid(row['id'], 'profile id');
      if (!this.isAccountId(row['userId'], accountId))
        this.relationshipFailure(accountId);
      for (const [fieldIndex, field] of MEDIA_FIELDS.entries()) {
        const chars = this.numberValue(row[`${field}Chars`], `${field}Chars`);
        if (chars === 0) continue;
        const prefix = this.mediaPrefix(row, field);
        if (!prefix.startsWith('data:')) {
          const isInlinePrefix = /^data:/i.test(prefix);
          if (isInlinePrefix) this.readFailure(accountId);
          const short = chars <= MAX_INLINE_TEXT_CHARS;
          yield {
            source: 'profileMedia',
            data: {
              id: this.mediaChunkId(profileId, fieldIndex, 0),
              accountId,
              profileId,
              field,
              disposition: this.referenceType(prefix),
              ...(short
                ? { value: this.prefixValue(row, field) }
                : {
                    referenceText: {
                      source: 'profileText',
                      field,
                      charLength: chars,
                      byteLength: this.numberValue(
                        row[`${field}Bytes`],
                        `${field}Bytes`
                      ),
                      chunkIdPrefix: `${profileId}:text:${(
                        fieldIndex + PROFILE_TEXT_FIELDS.length
                      )
                        .toString()
                        .padStart(2, '0')}:`,
                    },
                  }),
            },
          };
          continue;
        }
        const header = INLINE_MEDIA_HEADER.exec(prefix)?.[1];
        if (!header) this.readFailure(accountId);
        const mimeType = header.includes('/png;') ? 'image/png' : 'image/jpeg';
        const encodedLength = chars - header.length;
        if (
          encodedLength <= 0 ||
          encodedLength % 4 !== 0 ||
          encodedLength > Math.ceil(MAX_INLINE_MEDIA_BYTES / 3) * 4
        ) {
          this.readFailure(accountId);
        }
        const metadata = await this.scanInlineImage(
          runner,
          profileId,
          accountId,
          field,
          header,
          encodedLength,
          mimeType,
          signal,
          deadlineAt,
          timedOut
        );
        const chunkCount = Math.ceil(encodedLength / MEDIA_BASE64_CHUNK_CHARS);
        let chunkIndex = 0;
        let byteOffset = 0;
        for await (const base64 of this.base64Chunks(
          runner,
          profileId,
          accountId,
          field,
          header.length + 1,
          encodedLength,
          signal,
          deadlineAt,
          timedOut
        )) {
          const bytes = Buffer.from(base64, 'base64');
          yield {
            source: 'profileMedia',
            data: {
              id: this.mediaChunkId(profileId, fieldIndex, chunkIndex),
              accountId,
              profileId,
              field,
              disposition: 'inline-image-bytes',
              mimeType,
              originalHeader: header,
              byteCount: metadata.byteCount,
              sha256: metadata.sha256,
              chunkIndex,
              chunkCount,
              byteOffset,
              bytesBase64: bytes.toString('base64'),
            },
          };
          byteOffset += bytes.length;
          chunkIndex++;
        }
        if (byteOffset !== metadata.byteCount || chunkIndex !== chunkCount) {
          this.readFailure(accountId);
        }
      }
    }
  }

  private async *timelineRows(
    runner: QueryRunner,
    accountId: string,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): AsyncGenerator<ProfileAccountExportRecord> {
    let cursor: string | null = null;
    while (true) {
      const rows = (await this.readQuery(
        runner,
        `SELECT t."id"::text AS "id", t."userId", left(t."title", ${
          MAX_INLINE_TEXT_CHARS + 1
        }) AS "titlePrefix", char_length(t."title") AS "titleChars", octet_length(t."title") AS "titleBytes", left(t."description", ${
          MAX_INLINE_TEXT_CHARS + 1
        }) AS "descriptionPrefix", char_length(t."description") AS "descriptionChars", octet_length(t."description") AS "descriptionBytes", t."timeStamp"::text AS "timeStamp", t."eventType", t."relatedProfileId"::text AS "relatedProfileId", owned."id"::text AS "ownedRelatedProfileId", (t."relatedGoalId" IS NOT NULL) AS "hasRelatedGoalId", owned_goal."id"::text AS "ownedRelatedGoalId", (t."relatedProjectId" IS NOT NULL) AS "hasRelatedProjectId", owned_project."id"::text AS "ownedRelatedProjectId"
           FROM "timeline" t
           LEFT JOIN "profile" owned ON owned."id" = t."relatedProfileId" AND lower(owned."userId") = $1
           LEFT JOIN "goal" owned_goal ON owned_goal."id" = t."relatedGoalId" AND lower(owned_goal."userId") = $1
           LEFT JOIN "project" owned_project ON owned_project."id" = t."relatedProjectId" AND lower(owned_project."userId") = $1
          WHERE lower(t."userId") = $1 AND ($2::uuid IS NULL OR t."id" > $2::uuid)
          ORDER BY t."id" LIMIT $3`,
        [accountId, cursor, PAGE_LIMIT],
        signal,
        deadlineAt,
        timedOut(),
        accountId
      )) as Row[];
      this.validatePage(rows, accountId);
      const pageRows = rows.slice(0, PAGE_SIZE);
      for (const row of pageRows) {
        const id = this.uuid(row['id'], 'timeline id');
        if (!this.isAccountId(row['userId'], accountId))
          this.relationshipFailure(accountId);
        const rawRelated = row['relatedProfileId'];
        const related = row['ownedRelatedProfileId'];
        yield {
          source: 'timeline',
          data: {
            id,
            userId: accountId,
            title: this.timelineTextValue(row, 'title', id),
            description: this.timelineTextValue(row, 'description', id),
            timeStamp: this.dateString(row['timeStamp'], 'timeStamp'),
            eventType: this.stringValue(row['eventType'], 'eventType'),
            relatedProfile:
              rawRelated == null
                ? null
                : related == null
                ? { disposition: 'redacted-unowned-profile-reference' }
                : { disposition: 'owned-profile-reference', id: related },
            relatedGoalId: this.legacyReference(
              row['hasRelatedGoalId'],
              row['ownedRelatedGoalId']
            ),
            relatedProjectId: this.legacyReference(
              row['hasRelatedProjectId'],
              row['ownedRelatedProjectId']
            ),
          },
        };
      }
      if (pageRows.length === 0) break;
      cursor = this.uuid(
        pageRows[pageRows.length - 1]['id'],
        'timeline cursor'
      );
      if (rows.length <= PAGE_SIZE) break;
    }
  }

  private legacyReference(hasValue: unknown, ownedId: unknown): Row | null {
    if (typeof hasValue !== 'boolean')
      throw new Error('Invalid legacy reference');
    if (!hasValue) {
      if (ownedId !== null) throw new Error('Invalid legacy reference');
      return null;
    }
    if (ownedId === null) return { disposition: 'redacted-unowned-reference' };
    return {
      disposition: 'owned-reference',
      id: this.uuid(ownedId, 'legacy reference'),
    };
  }

  private async *timelineTextRows(
    runner: QueryRunner,
    accountId: string,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): AsyncGenerator<ProfileAccountExportRecord> {
    let cursor: string | null = null;
    while (true) {
      const rows = (await this.readQuery(
        runner,
        `SELECT "id"::text AS "id", "userId", char_length("title") AS "titleChars", octet_length("title") AS "titleBytes", char_length("description") AS "descriptionChars", octet_length("description") AS "descriptionBytes" FROM "timeline" WHERE lower("userId") = $1 AND ($2::uuid IS NULL OR "id" > $2::uuid) ORDER BY "id" LIMIT $3`,
        [accountId, cursor, PAGE_LIMIT],
        signal,
        deadlineAt,
        timedOut(),
        accountId
      )) as Row[];
      this.validatePage(rows, accountId);
      const pageRows = rows.slice(0, PAGE_SIZE);
      for (const row of pageRows) {
        const timelineId = this.uuid(row['id'], 'timeline text id');
        if (!this.isAccountId(row['userId'], accountId))
          this.relationshipFailure(accountId);
        for (const [fieldIndex, field] of ['title', 'description'].entries()) {
          const chars = this.numberValue(row[`${field}Chars`], `${field}Chars`);
          if (chars <= MAX_INLINE_TEXT_CHARS) continue;
          const byteLength = this.numberValue(
            row[`${field}Bytes`],
            `${field}Bytes`
          );
          let offset = 1;
          let chunkIndex = 0;
          while (offset <= chars) {
            const [chunk] = (await this.readQuery(
              runner,
              `SELECT substring("${field}" from $2::integer for $3::integer) AS "value" FROM "timeline" WHERE "id" = $1::uuid AND lower("userId") = $4`,
              [timelineId, offset, TEXT_CHUNK_CHARS, accountId],
              signal,
              deadlineAt,
              timedOut(),
              accountId
            )) as Row[];
            const value = this.stringValue(chunk?.['value'], field);
            const charLength = Array.from(value).length;
            if (charLength === 0) this.readFailure(accountId);
            yield {
              source: 'timelineText',
              data: {
                id: this.timelineTextChunkId(
                  timelineId,
                  fieldIndex,
                  chunkIndex++
                ),
                accountId,
                timelineId,
                field,
                charOffset: offset - 1,
                charLength,
                byteLength,
                value,
              },
            };
            offset += charLength;
          }
        }
      }
      if (pageRows.length === 0) break;
      cursor = this.uuid(
        pageRows[pageRows.length - 1]['id'],
        'timeline text cursor'
      );
      if (rows.length <= PAGE_SIZE) break;
    }
  }

  private timelineTextValue(
    row: Row,
    field: 'title' | 'description',
    timelineId: string
  ): unknown {
    const chars = this.numberValue(row[`${field}Chars`], `${field}Chars`);
    const bytes = this.numberValue(row[`${field}Bytes`], `${field}Bytes`);
    const prefix = this.stringValue(row[`${field}Prefix`], `${field}Prefix`);
    if (chars <= MAX_INLINE_TEXT_CHARS) {
      if (Array.from(prefix).length !== chars) this.readFailure(timelineId);
      return prefix;
    }
    const fieldIndex = field === 'title' ? 0 : 1;
    return {
      disposition: 'full-text-in-timelineText-source',
      charLength: chars,
      byteLength: bytes,
      chunkIdPrefix: `${timelineId}:timeline-text:${fieldIndex
        .toString()
        .padStart(2, '0')}:`,
    };
  }

  private async *guardianActivityRows(
    runner: QueryRunner,
    accountId: string,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): AsyncGenerator<ProfileAccountExportRecord> {
    let cursor: string | null = null;
    while (true) {
      const rows = (await this.readQuery(
        runner,
        `SELECT a."id"::text AS "id", a."actorUserId"::text AS "actorUserId", a."dependentUserId"::text AS "dependentUserId", a."profileId"::text AS "profileId", a."appId", a."operation", CASE WHEN a."dependentUserId"::text = $1 THEN CASE WHEN cardinality(a."changedFieldNames") <= 1000 AND octet_length(a."changedFieldNames"::text) <= 65536 THEN a."changedFieldNames" ELSE NULL END ELSE NULL END AS "changedFieldNames", a."createdAt"::text AS "createdAt", owned."id"::text AS "verifiedProfileId"
           FROM "guardian_profile_activity" a
           LEFT JOIN "profile" owned ON owned."id" = a."profileId" AND lower(owned."userId") = lower(a."dependentUserId"::text)
          WHERE (a."actorUserId" = $1::uuid OR a."dependentUserId" = $1::uuid)
            AND ($2::uuid IS NULL OR a."id" > $2::uuid)
          ORDER BY a."id" LIMIT $3`,
        [accountId, cursor, PAGE_LIMIT],
        signal,
        deadlineAt,
        timedOut(),
        accountId
      )) as Row[];
      this.validatePage(rows, accountId);
      const pageRows = rows.slice(0, PAGE_SIZE);
      for (const row of pageRows) {
        const id = this.uuid(row['id'], 'guardian activity id');
        const isActor = this.isAccountId(row['actorUserId'], accountId);
        const isDependent = this.isAccountId(row['dependentUserId'], accountId);
        if (isActor === isDependent || row['verifiedProfileId'] == null) {
          this.relationshipFailure(accountId);
        }
        if (
          !['profile.view', 'profile.manage'].includes(String(row['operation']))
        ) {
          this.relationshipFailure(accountId);
        }
        const data: Row = {
          id,
          accountId,
          role: isDependent ? 'dependent' : 'guardian',
          appId: this.stringValue(row['appId'], 'appId'),
          operation: row['operation'],
          createdAt: this.dateString(row['createdAt'], 'createdAt'),
        };
        if (isDependent) {
          data['profileId'] = this.uuid(row['profileId'], 'profileId');
          const changed = row['changedFieldNames'];
          if (
            !Array.isArray(changed) ||
            changed.length > 1000 ||
            changed.some(
              (field) => typeof field !== 'string' || field.length > 4096
            )
          ) {
            this.relationshipFailure(accountId);
          }
          data['changedFieldNames'] = changed;
        }
        yield { source: 'guardianActivity', data };
      }
      if (pageRows.length === 0) break;
      cursor = this.uuid(
        pageRows[pageRows.length - 1]['id'],
        'activity cursor'
      );
      if (rows.length <= PAGE_SIZE) break;
    }
  }

  private async *uuidPages(
    runner: QueryRunner,
    sql: string,
    accountId: string,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): AsyncGenerator<Row> {
    let cursor: string | null = null;
    while (true) {
      const rows = (await this.readQuery(
        runner,
        sql,
        [accountId, cursor, PAGE_LIMIT],
        signal,
        deadlineAt,
        timedOut(),
        accountId
      )) as Row[];
      this.validatePage(rows, accountId);
      const pageRows = rows.slice(0, PAGE_SIZE);
      for (const row of pageRows) {
        const id = this.uuid(row['id'], 'cursor');
        if (cursor && id <= cursor) this.relationshipFailure(accountId);
        yield row;
      }
      if (pageRows.length === 0) break;
      cursor = this.uuid(pageRows[pageRows.length - 1]['id'], 'cursor');
      if (rows.length <= PAGE_SIZE) break;
    }
  }

  private async *profilePages(
    runner: QueryRunner,
    accountId: string,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): AsyncGenerator<Row> {
    let cursor: string | null = null;
    const textColumns = [...PROFILE_TEXT_FIELDS, ...MEDIA_FIELDS];
    const selected = textColumns
      .map(
        (field) =>
          `left("${field}", ${
            MAX_INLINE_TEXT_CHARS + 1
          }) AS "${field}Prefix", char_length("${field}") AS "${field}Chars", octet_length("${field}") AS "${field}Bytes"`
      )
      .join(', ');
    while (true) {
      const rows = (await this.readQuery(
        runner,
        `SELECT \"id\"::text AS \"id\", \"userId\", ${selected}, CASE WHEN \"blogRole\" IN ('none', 'poster', 'owner') THEN \"blogRole\" ELSE NULL END AS \"blogRole\", \"created_at\"::text AS \"createdAt\"
           FROM "profile" WHERE lower("userId") = $1 AND ($2::uuid IS NULL OR "id" > $2::uuid)
          ORDER BY "id" LIMIT $3`,
        [accountId, cursor, PAGE_LIMIT],
        signal,
        deadlineAt,
        timedOut(),
        accountId
      )) as Row[];
      this.validatePage(rows, accountId);
      const pageRows = rows.slice(0, PAGE_SIZE);
      for (const row of pageRows) {
        const id = this.uuid(row['id'], 'profile cursor');
        if (
          !this.isAccountId(row['userId'], accountId) ||
          (cursor && id <= cursor)
        ) {
          this.relationshipFailure(accountId);
        }
        yield row;
      }
      if (pageRows.length === 0) break;
      cursor = this.uuid(pageRows[pageRows.length - 1]['id'], 'profile cursor');
      if (rows.length <= PAGE_SIZE) break;
    }
  }

  private async scanInlineImage(
    runner: QueryRunner,
    profileId: string,
    accountId: string,
    field: MediaField,
    header: string,
    encodedLength: number,
    mimeType: string,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): Promise<{ byteCount: number; sha256: string }> {
    const hash = createHash('sha256');
    let byteCount = 0;
    let index = 0;
    for await (const base64 of this.base64Chunks(
      runner,
      profileId,
      accountId,
      field,
      header.length + 1,
      encodedLength,
      signal,
      deadlineAt,
      timedOut
    )) {
      const bytes = this.decodeBase64(base64, accountId);
      if (
        index < Math.ceil(encodedLength / MEDIA_BASE64_CHUNK_CHARS) - 1 &&
        base64.includes('=')
      ) {
        this.readFailure(accountId);
      }
      if (index === 0) {
        const initialBytes = bytes.subarray(0, 8);
        const validMagic =
          mimeType === 'image/png'
            ? initialBytes.length >= 8 &&
              initialBytes
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : initialBytes.length >= 3 &&
              initialBytes[0] === 0xff &&
              initialBytes[1] === 0xd8 &&
              initialBytes[2] === 0xff;
        if (!validMagic) this.readFailure(accountId);
      }
      index++;
      byteCount += bytes.length;
      if (byteCount > MAX_INLINE_MEDIA_BYTES) this.readFailure(accountId);
      hash.update(bytes);
    }
    if (byteCount === 0) this.readFailure(accountId);
    return { byteCount, sha256: hash.digest('hex') };
  }

  private async *base64Chunks(
    runner: QueryRunner,
    profileId: string,
    accountId: string,
    field: MediaField,
    firstBase64Position: number,
    encodedLength: number,
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: () => boolean
  ): AsyncGenerator<string> {
    for (
      let offset = 0;
      offset < encodedLength;
      offset += MEDIA_BASE64_CHUNK_CHARS
    ) {
      this.assertActive(signal, deadlineAt, timedOut(), accountId);
      const length = Math.min(MEDIA_BASE64_CHUNK_CHARS, encodedLength - offset);
      const [row] = (await this.readQuery(
        runner,
        `SELECT substring("${field}" from $2::integer for $3::integer) AS "value" FROM "profile" WHERE "id" = $1::uuid AND lower("userId") = $4`,
        [profileId, firstBase64Position + offset, length, accountId],
        signal,
        deadlineAt,
        timedOut(),
        accountId
      )) as Row[];
      const value = this.stringValue(row?.['value'], field);
      if (value.length !== length) this.readFailure(accountId);
      yield value;
    }
  }

  private decodeBase64(value: string, accountId: string): Buffer {
    if (
      value.length === 0 ||
      value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        value
      )
    ) {
      this.readFailure(accountId);
    }
    const bytes = Buffer.from(value, 'base64');
    if (bytes.toString('base64') !== value) this.readFailure(accountId);
    return bytes;
  }

  private textValue(
    row: Row,
    field: ProfileTextField,
    profileId: string
  ): unknown {
    const chars = this.numberValue(row[`${field}Chars`], `${field}Chars`);
    const bytes = this.numberValue(row[`${field}Bytes`], `${field}Bytes`);
    const rawValue = row[`${field}Prefix`];
    if (rawValue === null && field === 'appScope') return null;
    const value = this.stringValue(rawValue, `${field}Prefix`);
    if (chars <= MAX_INLINE_TEXT_CHARS) {
      if (Array.from(value).length !== chars) this.readFailure(profileId);
      return value;
    }
    return {
      disposition: 'full-text-in-profileText-source',
      charLength: chars,
      byteLength: bytes,
      chunkIdPrefix: `${profileId}:text:${PROFILE_TEXT_FIELDS.indexOf(field)
        .toString()
        .padStart(2, '0')}:`,
    };
  }

  private mediaFieldValue(
    row: Row,
    field: MediaField,
    profileId: string,
    fieldIndex: number
  ): Row | string {
    const chars = this.numberValue(row[`${field}Chars`], `${field}Chars`);
    if (chars === 0) return '';
    const prefix = this.mediaPrefix(row, field);
    const sourceRecordId = `${profileId}:media:${fieldIndex
      .toString()
      .padStart(2, '0')}:`;
    if (prefix.startsWith('data:')) {
      const header = INLINE_MEDIA_HEADER.exec(prefix)?.[1];
      if (!header) this.readFailure(profileId);
      return {
        disposition: 'decoded-inline-media-in-profileMedia-source',
        sourceRecordId,
        mimeType: header.includes('/png;') ? 'image/png' : 'image/jpeg',
        originalHeader: header,
      };
    }
    if (/^data:/i.test(prefix)) this.readFailure(profileId);
    if (chars <= MAX_INLINE_TEXT_CHARS) {
      const value = this.prefixValue(row, field);
      return {
        disposition: this.referenceType(value),
        sourceRecordId,
      };
    }
    return {
      disposition: this.referenceType(prefix),
      sourceRecordId,
      referenceText: {
        source: 'profileText',
        charLength: chars,
        byteLength: this.numberValue(row[`${field}Bytes`], `${field}Bytes`),
        chunkIdPrefix: `${profileId}:text:${(
          fieldIndex + PROFILE_TEXT_FIELDS.length
        )
          .toString()
          .padStart(2, '0')}:`,
      },
    };
  }

  private mediaPrefix(row: Row, field: MediaField): string {
    return this.stringValue(row[`${field}Prefix`], `${field}Prefix`);
  }

  private prefixValue(row: Row, field: MediaField): string {
    return this.mediaPrefix(row, field);
  }

  private referenceType(value: string): string {
    if (/^https?:\/\//i.test(value))
      return 'remote-reference-preserved-bytes-not-included';
    if (
      /\/asset\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:[?#].*)?$/i.test(
        value
      )
    ) {
      return 'asset-reference-preserved-bytes-not-included';
    }
    return 'opaque-reference-preserved-bytes-not-included';
  }

  private blogRoleValue(value: unknown, accountId: string): string {
    if (value !== 'none' && value !== 'poster' && value !== 'owner') {
      this.readFailure(accountId);
    }
    return value;
  }

  private mediaChunkId(
    profileId: string,
    fieldIndex: number,
    chunkIndex: number
  ): string {
    return `${profileId}:media:${fieldIndex
      .toString()
      .padStart(2, '0')}:${chunkIndex.toString().padStart(12, '0')}`;
  }

  private textChunkId(
    profileId: string,
    fieldIndex: number,
    chunkIndex: number
  ): string {
    return `${profileId}:text:${fieldIndex
      .toString()
      .padStart(2, '0')}:${chunkIndex.toString().padStart(12, '0')}`;
  }

  private timelineTextChunkId(
    timelineId: string,
    fieldIndex: number,
    chunkIndex: number
  ): string {
    return `${timelineId}:timeline-text:${fieldIndex
      .toString()
      .padStart(2, '0')}:${chunkIndex.toString().padStart(12, '0')}`;
  }

  private async readQuery(
    runner: QueryRunner,
    sql: string,
    params: unknown[],
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: boolean,
    accountId: string
  ): Promise<unknown> {
    this.assertActive(signal, deadlineAt, timedOut, accountId);
    try {
      const result = await runner.query(sql, params);
      this.assertActive(signal, deadlineAt, timedOut, accountId);
      return result;
    } catch {
      this.assertActive(signal, deadlineAt, timedOut, accountId);
      throw new ProfileAccountExportOwnerError('OWNER_READ_FAILED', accountId);
    }
  }

  private assertActive(
    signal: AbortSignal,
    deadlineAt: number,
    timedOut: boolean,
    accountId: string
  ): void {
    if (signal.aborted || Date.now() >= deadlineAt) {
      throw new ProfileAccountExportOwnerError(
        timedOut || Date.now() >= deadlineAt
          ? 'OWNER_CAPTURE_TIMEOUT'
          : 'OWNER_CAPTURE_ABORTED',
        accountId
      );
    }
  }

  private validatePage(
    rows: unknown,
    accountId: string
  ): asserts rows is Row[] {
    if (!Array.isArray(rows) || rows.length > PAGE_LIMIT) {
      this.readFailure(accountId);
    }
  }

  private stringValue(value: unknown, field: string): string {
    if (typeof value !== 'string') throw new Error(`invalid ${field}`);
    return value;
  }

  private numberValue(value: unknown, field: string): number {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < 0)
      throw new Error(`invalid ${field}`);
    return number;
  }

  private uuid(value: unknown, field: string): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw new Error(`invalid ${field}`);
    }
    return value.toLowerCase();
  }

  private isAccountId(value: unknown, accountId: string): boolean {
    return (
      typeof value === 'string' &&
      UUID_PATTERN.test(value) &&
      value.toLowerCase() === accountId.toLowerCase()
    );
  }

  private dateString(value: unknown, field: string): string {
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime()))
        throw new Error(`invalid ${field}`);
      return value.toISOString();
    }
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
      throw new Error(`invalid ${field}`);
    }
    return value;
  }

  private readFailure(accountId: string): never {
    throw new ProfileAccountExportOwnerError('OWNER_READ_FAILED', accountId);
  }

  private relationshipFailure(accountId: string): never {
    throw new ProfileAccountExportOwnerError(
      'OWNER_RELATIONSHIP_AMBIGUOUS',
      accountId
    );
  }
}
