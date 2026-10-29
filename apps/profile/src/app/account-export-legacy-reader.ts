import { AccountExportOwnerRecord } from '@optimistic-tanuki/models';

export const PROFILE_ACCOUNT_EXPORT_LEGACY_SOURCES = [
  'legacyGoalText',
  'legacyGoal',
  'legacyProjectText',
  'legacyProject',
] as const;
export type ProfileAccountExportLegacySource =
  (typeof PROFILE_ACCOUNT_EXPORT_LEGACY_SOURCES)[number];
export type ProfileAccountExportLegacyRecord =
  AccountExportOwnerRecord<ProfileAccountExportLegacySource>;
export type ProfileAccountExportReadQuery = (
  sql: string,
  parameters: unknown[]
) => Promise<unknown>;

export class ProfileAccountExportLegacyReadError extends Error {
  readonly code = 'OWNER_READ_FAILED' as const;

  constructor() {
    super('PROFILE_LEGACY_READ_FAILED');
    this.name = 'ProfileAccountExportLegacyReadError';
  }
}

type Row = Record<string, unknown>;
type TextField = 'name' | 'description';
type TextTable = 'goal' | 'project';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRINCIPAL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 200;
const PAGE_LIMIT = PAGE_SIZE + 1;
const INLINE_TEXT_CHARS = 2500;
const TEXT_CHUNK_CHARS = 1000;

/** Bounded row and text readers that share the caller's authenticated DB snapshot. */
export class ProfileAccountExportLegacyReader {
  private readonly accountId: string;

  constructor(
    accountId: string,
    private readonly queryCallback: ProfileAccountExportReadQuery
  ) {
    if (
      !PRINCIPAL_ID_PATTERN.test(accountId) ||
      typeof queryCallback !== 'function'
    ) {
      throw new ProfileAccountExportLegacyReadError();
    }
    this.accountId = accountId.toLowerCase();
  }

  async *legacyGoalTextRows(): AsyncGenerator<ProfileAccountExportLegacyRecord> {
    yield* this.textRows('goal');
  }

  async *legacyGoalRows(): AsyncGenerator<ProfileAccountExportLegacyRecord> {
    yield* this.goalRows();
  }

  async *legacyProjectTextRows(): AsyncGenerator<ProfileAccountExportLegacyRecord> {
    yield* this.textRows('project');
  }

  async *legacyProjectRows(): AsyncGenerator<ProfileAccountExportLegacyRecord> {
    yield* this.projectRows();
  }

  private async *goalRows(): AsyncGenerator<ProfileAccountExportLegacyRecord> {
    let cursor: string | null = null;
    while (true) {
      const rows = await this.readPage(
        `SELECT g."id"::text AS "id", g."userId", left(g."name", ${
          INLINE_TEXT_CHARS + 1
        }) AS "namePrefix", char_length(g."name") AS "nameChars", octet_length(g."name") AS "nameBytes", left(g."description", ${
          INLINE_TEXT_CHARS + 1
        }) AS "descriptionPrefix", char_length(g."description") AS "descriptionChars", octet_length(g."description") AS "descriptionBytes", g."target", g."progress", g."startDate"::text AS "startDate", g."endDate"::text AS "endDate", g."completed", g."created_at"::text AS "created_at", (g."relatedProfileId" IS NOT NULL) AS "hasRelatedProfileId", CASE WHEN owned_profile."id" IS NULL THEN NULL ELSE g."relatedProfileId"::text END AS "ownedRelatedProfileId", (g."relatedProjectId" IS NOT NULL) AS "hasRelatedProjectId", CASE WHEN owned_project."id" IS NULL THEN NULL ELSE g."relatedProjectId"::text END AS "ownedRelatedProjectId"
           FROM "goal" g
           LEFT JOIN "profile" owned_profile ON owned_profile."id" = g."relatedProfileId" AND lower(owned_profile."userId") = lower($1::varchar)
           LEFT JOIN "project" owned_project ON owned_project."id" = g."relatedProjectId" AND lower(owned_project."userId") = lower($1::varchar)
          WHERE lower(g."userId") = lower($1::varchar) AND ($2::uuid IS NULL OR g."id" > $2::uuid)
          ORDER BY g."id" LIMIT $3::integer`,
        [this.accountId, cursor, PAGE_LIMIT],
        'goal',
        cursor
      );
      const page = rows.slice(0, PAGE_SIZE);
      for (const row of page) {
        const id = this.rowId(row, 'goal');
        const data: Row = {
          id,
          userId: this.ownedUser(row),
          name: this.textValue(row, 'name', id, 'goal'),
          description: this.textValue(row, 'description', id, 'goal'),
          target: this.integer(row['target']),
          progress: this.integer(row['progress']),
          startDate: this.timestamp(row['startDate'], false),
          endDate: this.timestamp(row['endDate'], true),
          completed: this.boolean(row['completed']),
          created_at: this.timestamp(row['created_at'], false),
          relatedProfileId: this.reference(
            row['hasRelatedProfileId'],
            row['ownedRelatedProfileId']
          ),
          relatedProjectId: this.reference(
            row['hasRelatedProjectId'],
            row['ownedRelatedProjectId']
          ),
        };
        yield { source: 'legacyGoal', data };
      }
      if (page.length === 0) return;
      cursor = this.rowId(page[page.length - 1], 'goal');
      if (rows.length <= PAGE_SIZE) return;
    }
  }

  private async *projectRows(): AsyncGenerator<ProfileAccountExportLegacyRecord> {
    let cursor: string | null = null;
    while (true) {
      const rows = await this.readPage(
        `SELECT p."id"::text AS "id", p."userId", left(p."name", ${
          INLINE_TEXT_CHARS + 1
        }) AS "namePrefix", char_length(p."name") AS "nameChars", octet_length(p."name") AS "nameBytes", left(p."description", ${
          INLINE_TEXT_CHARS + 1
        }) AS "descriptionPrefix", char_length(p."description") AS "descriptionChars", octet_length(p."description") AS "descriptionBytes", p."created_at"::text AS "created_at", (p."relatedProfileId" IS NOT NULL) AS "hasRelatedProfileId", CASE WHEN owned_profile."id" IS NULL THEN NULL ELSE p."relatedProfileId"::text END AS "ownedRelatedProfileId", (p."timeLineEventsId" IS NOT NULL) AS "hasTimeLineEventsId", CASE WHEN owned_timeline."id" IS NULL THEN NULL ELSE p."timeLineEventsId"::text END AS "ownedTimeLineEventsId", (p."goalsId" IS NOT NULL) AS "hasGoalsId", CASE WHEN owned_goal."id" IS NULL THEN NULL ELSE p."goalsId"::text END AS "ownedGoalsId"
           FROM "project" p
           LEFT JOIN "profile" owned_profile ON owned_profile."id" = p."relatedProfileId" AND lower(owned_profile."userId") = lower($1::varchar)
           LEFT JOIN "timeline" owned_timeline ON owned_timeline."id" = p."timeLineEventsId" AND lower(owned_timeline."userId") = lower($1::varchar)
           LEFT JOIN "goal" owned_goal ON owned_goal."id" = p."goalsId" AND lower(owned_goal."userId") = lower($1::varchar)
          WHERE lower(p."userId") = lower($1::varchar) AND ($2::uuid IS NULL OR p."id" > $2::uuid)
          ORDER BY p."id" LIMIT $3::integer`,
        [this.accountId, cursor, PAGE_LIMIT],
        'project',
        cursor
      );
      const page = rows.slice(0, PAGE_SIZE);
      for (const row of page) {
        const id = this.rowId(row, 'project');
        const data: Row = {
          id,
          userId: this.ownedUser(row),
          name: this.textValue(row, 'name', id, 'project'),
          description: this.textValue(row, 'description', id, 'project'),
          created_at: this.timestamp(row['created_at'], false),
          relatedProfileId: this.reference(
            row['hasRelatedProfileId'],
            row['ownedRelatedProfileId']
          ),
          timeLineEventsId: this.reference(
            row['hasTimeLineEventsId'],
            row['ownedTimeLineEventsId']
          ),
          goalsId: this.reference(row['hasGoalsId'], row['ownedGoalsId']),
        };
        yield { source: 'legacyProject', data };
      }
      if (page.length === 0) return;
      cursor = this.rowId(page[page.length - 1], 'project');
      if (rows.length <= PAGE_SIZE) return;
    }
  }

  private async *textRows(
    table: TextTable
  ): AsyncGenerator<ProfileAccountExportLegacyRecord> {
    let cursor: string | null = null;
    const source = table === 'goal' ? 'legacyGoalText' : 'legacyProjectText';
    const prefix = table === 'goal' ? 'g' : 'p';
    while (true) {
      const rows = await this.readPage(
        `SELECT ${prefix}."id"::text AS "id", ${prefix}."userId", left(${prefix}."name", ${
          INLINE_TEXT_CHARS + 1
        }) AS "namePrefix", char_length(${prefix}."name") AS "nameChars", octet_length(${prefix}."name") AS "nameBytes", left(${prefix}."description", ${
          INLINE_TEXT_CHARS + 1
        }) AS "descriptionPrefix", char_length(${prefix}."description") AS "descriptionChars", octet_length(${prefix}."description") AS "descriptionBytes"
           FROM "${table}" ${prefix}
          WHERE lower(${prefix}."userId") = lower($1::varchar) AND ($2::uuid IS NULL OR ${prefix}."id" > $2::uuid)
          ORDER BY ${prefix}."id" LIMIT $3::integer`,
        [this.accountId, cursor, PAGE_LIMIT],
        table,
        cursor
      );
      const page = rows.slice(0, PAGE_SIZE);
      for (const row of page) {
        const id = this.rowId(row, table);
        this.ownedUser(row);
        for (const [fieldIndex, field] of ['name', 'description'].entries()) {
          const fieldName = field as TextField;
          const chars = this.count(row[`${fieldName}Chars`]);
          this.textValue(row, fieldName, id, table);
          if (chars <= INLINE_TEXT_CHARS) continue;
          const byteLength = this.count(row[`${fieldName}Bytes`]);
          let offset = 1;
          let chunkIndex = 0;
          let emittedChars = 0;
          let emittedBytes = 0;
          while (offset <= chars) {
            const chunkRows = await this.queryRows(
              `SELECT substring("${fieldName}" from $2::integer for $3::integer) AS "value" FROM "${table}" WHERE "id" = $1::uuid AND lower("userId") = lower($4::varchar)`,
              [id, offset, TEXT_CHUNK_CHARS, this.accountId]
            );
            if (chunkRows.length !== 1)
              throw new ProfileAccountExportLegacyReadError();
            const value = this.string(chunkRows[0]['value']);
            const charLength = Array.from(value).length;
            const expectedChars = Math.min(
              TEXT_CHUNK_CHARS,
              chars - offset + 1
            );
            if (charLength !== expectedChars) {
              throw new ProfileAccountExportLegacyReadError();
            }
            const chunkBytes = Buffer.byteLength(value, 'utf8');
            const type = table === 'goal' ? 'goal' : 'project';
            const sourceId = `${id}:${type}-text:${fieldIndex
              .toString()
              .padStart(2, '0')}:${chunkIndex.toString().padStart(12, '0')}`;
            yield {
              source,
              data: {
                id: sourceId,
                accountId: this.accountId,
                ...(table === 'goal' ? { goalId: id } : { projectId: id }),
                field: fieldName,
                charOffset: offset - 1,
                charLength,
                byteLength,
                value,
              },
            };
            emittedChars += charLength;
            emittedBytes += chunkBytes;
            offset += charLength;
            chunkIndex++;
          }
          if (emittedChars !== chars || emittedBytes !== byteLength) {
            throw new ProfileAccountExportLegacyReadError();
          }
        }
      }
      if (page.length === 0) return;
      cursor = this.rowId(page[page.length - 1], table);
      if (rows.length <= PAGE_SIZE) return;
    }
  }

  private async readPage(
    sql: string,
    parameters: unknown[],
    table: string,
    cursor: string | null
  ): Promise<Row[]> {
    const rows = await this.queryRows(sql, parameters);
    if (rows.length > PAGE_LIMIT)
      throw new ProfileAccountExportLegacyReadError();
    let previous: string | undefined;
    for (const row of rows) {
      const id = this.rowId(row, table);
      if (cursor !== null && id <= cursor) {
        throw new ProfileAccountExportLegacyReadError();
      }
      if (previous !== undefined && id <= previous) {
        throw new ProfileAccountExportLegacyReadError();
      }
      previous = id;
    }
    return rows;
  }

  private async queryRows(sql: string, parameters: unknown[]): Promise<Row[]> {
    let result: unknown;
    try {
      result = await this.queryCallback(sql, parameters);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        ((error as { code?: unknown }).code === 'OWNER_CAPTURE_TIMEOUT' ||
          (error as { code?: unknown }).code === 'OWNER_CAPTURE_ABORTED')
      ) {
        throw error;
      }
      throw new ProfileAccountExportLegacyReadError();
    }
    if (
      !Array.isArray(result) ||
      result.some(
        (row) => !row || typeof row !== 'object' || Array.isArray(row)
      )
    ) {
      throw new ProfileAccountExportLegacyReadError();
    }
    return result as Row[];
  }

  private rowId(row: Row, table: string): string {
    const id = row['id'];
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      throw new ProfileAccountExportLegacyReadError();
    }
    const normalized = id.toLowerCase();
    if (!this.isOwnedUser(row['userId'])) {
      throw new ProfileAccountExportLegacyReadError();
    }
    return normalized;
  }

  private ownedUser(row: Row): string {
    if (!this.isOwnedUser(row['userId'])) {
      throw new ProfileAccountExportLegacyReadError();
    }
    return this.accountId;
  }

  private isOwnedUser(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      UUID_PATTERN.test(value) &&
      value.toLowerCase() === this.accountId
    );
  }

  private textValue(
    row: Row,
    field: TextField,
    ownerId: string,
    table: TextTable
  ): unknown {
    const chars = this.count(row[`${field}Chars`]);
    const bytes = this.count(row[`${field}Bytes`]);
    const value = this.string(row[`${field}Prefix`]);
    if (Array.from(value).length !== Math.min(chars, INLINE_TEXT_CHARS + 1)) {
      throw new ProfileAccountExportLegacyReadError();
    }
    if (chars <= INLINE_TEXT_CHARS) return value;
    const fieldIndex = field === 'name' ? 0 : 1;
    const tableName = table === 'goal' ? 'goal' : 'project';
    return {
      disposition: 'full-text-in-legacy-text-source',
      charLength: chars,
      byteLength: bytes,
      chunkIdPrefix: `${ownerId}:${tableName}-text:${fieldIndex
        .toString()
        .padStart(2, '0')}:`,
    };
  }

  private reference(hasValue: unknown, ownedId: unknown): unknown {
    if (typeof hasValue !== 'boolean')
      throw new ProfileAccountExportLegacyReadError();
    if (!hasValue) {
      if (ownedId !== null) throw new ProfileAccountExportLegacyReadError();
      return null;
    }
    if (ownedId === null) return { disposition: 'redacted-unowned-reference' };
    if (typeof ownedId !== 'string' || !UUID_PATTERN.test(ownedId)) {
      throw new ProfileAccountExportLegacyReadError();
    }
    return { disposition: 'owned-reference', id: ownedId.toLowerCase() };
  }

  private integer(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      throw new ProfileAccountExportLegacyReadError();
    }
    return value;
  }

  private boolean(value: unknown): boolean {
    if (typeof value !== 'boolean')
      throw new ProfileAccountExportLegacyReadError();
    return value;
  }

  private timestamp(value: unknown, nullable: boolean): string | null {
    if (value === null && nullable) return null;
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
      throw new ProfileAccountExportLegacyReadError();
    }
    return value;
  }

  private count(value: unknown): number {
    const count = typeof value === 'number' ? value : Number(value);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new ProfileAccountExportLegacyReadError();
    }
    return count;
  }

  private string(value: unknown): string {
    if (typeof value !== 'string')
      throw new ProfileAccountExportLegacyReadError();
    return value;
  }
}
