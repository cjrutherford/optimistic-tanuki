import { LogSubjectSelection } from './log-sink-deletion';

export type AuditClearValue =
  | 'null'
  | 'json-object'
  | 'json-array'
  | 'serialized-json-array'
  | 'text-array'
  | 'empty-text';
export interface AuditErasurePolicy {
  table: string;
  accountColumns: readonly string[];
  profileColumns: readonly string[];
  clearColumns?: Readonly<Record<string, AuditClearValue>>;
  profileAccountBindings?: Readonly<Record<string, string>>;
  disposition?: 'redact' | 'delete-private';
}
interface AuditTransaction {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}
interface AuditDatabase {
  transaction<T>(
    run: (transaction: AuditTransaction) => Promise<T>
  ): Promise<T>;
}
export interface AuditErasureReceipt {
  allDeclaredSourcesVerified: boolean;
  sources: { source: string; changed: number; remaining: number }[];
}
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/;
const CLEAR: Record<AuditClearValue, string> = {
  null: 'NULL',
  'json-object': "'{}'::jsonb",
  'json-array': "'[]'::jsonb",
  'serialized-json-array': "'[]'",
  'text-array': "'{}'::text[]",
  'empty-text': "''",
};
const MAX_ROWS = 100_000;

/** Internal owner primitive, not an authentication/ownership verifier or public
 * deletion endpoint. The caller must supply its authoritative account/profile
 * set. D00 must fence future producers before global deletion acknowledgement. */
export class AuditErasureRunner {
  constructor(private readonly database: AuditDatabase) {}

  /** Independent identity readback; works after Profile root finalization too. */
  async readback(
    subject: LogSubjectSelection,
    policies: readonly AuditErasurePolicy[]
  ): Promise<number> {
    if (
      !subject ||
      typeof subject.accountId !== 'string' ||
      !UUID.test(subject.accountId) ||
      !Array.isArray(subject.profileIds) ||
      subject.profileIds.length > 10000 ||
      subject.profileIds.some((id) => typeof id !== 'string' || !UUID.test(id))
    )
      throw Error('INVALID_LOG_SUBJECT_SELECTION');
    if (!Array.isArray(policies) || !policies.length || policies.length > 16)
      throw Error('INVALID_AUDIT_ERASURE_POLICY');
    const parameters = [
      subject.accountId.toLowerCase(),
      [...new Set(subject.profileIds.map((id) => id.toLowerCase()))],
    ];
    const sources = policies.map((policy: AuditErasurePolicy) => {
      const names = [...policy.accountColumns, ...policy.profileColumns];
      if (
        !IDENTIFIER.test(policy.table) ||
        !names.length ||
        names.length > 32 ||
        names.some((name) => !IDENTIFIER.test(name)) ||
        new Set(names).size !== names.length
      )
        throw Error('INVALID_AUDIT_ERASURE_POLICY');
      const branches = [
        ...policy.accountColumns.map(
          (name) => `lower(btrim("${name}"::text))=$1::text`
        ),
        ...policy.profileColumns.map(
          (name) => `lower(btrim("${name}"::text))=ANY($2::text[])`
        ),
      ];
      // Both typed identity domains remain bound even for single-domain sources.
      return {
        table: policy.table,
        predicate: `($1::text IS NOT NULL AND $2::text[] IS NOT NULL) AND (${branches.join(
          ' OR '
        )})`,
      };
    });
    if (new Set(sources.map((source) => source.table)).size !== sources.length)
      throw Error('INVALID_AUDIT_ERASURE_POLICY');
    try {
      return await this.database.transaction(async (transaction) => {
        await transaction.query('SET TRANSACTION READ ONLY');
        await transaction.query("SET LOCAL statement_timeout='12s'");
        let total = 0;
        for (const source of sources) {
          const rows = await transaction.query(
            `SELECT count(*)::text AS n FROM (SELECT 1 FROM "public"."${
              source.table
            }" WHERE ${source.predicate} LIMIT ${MAX_ROWS + 1}) AS matches`,
            parameters
          );
          const n =
            Array.isArray(rows) && rows.length === 1 ? rows[0]?.n : undefined;
          if (
            typeof n !== 'string' ||
            !/^\d+$/.test(n) ||
            !Number.isSafeInteger(Number(n)) ||
            Number(n) > MAX_ROWS
          )
            throw Error('INVALID_AUDIT_READBACK');
          total += Number(n);
        }
        return total;
      });
    } catch {
      throw Error('AUDIT_READBACK_FAILED');
    }
  }

  async erase(
    subject: LogSubjectSelection,
    policies: readonly AuditErasurePolicy[],
    prepareTransaction?: (transaction: AuditTransaction) => Promise<void>
  ): Promise<AuditErasureReceipt> {
    if (
      !subject ||
      typeof subject.accountId !== 'string' ||
      !UUID.test(subject.accountId) ||
      !Array.isArray(subject.profileIds) ||
      subject.profileIds.length > 10_000 ||
      subject.profileIds.some((id) => typeof id !== 'string' || !UUID.test(id))
    )
      throw new Error('INVALID_LOG_SUBJECT_SELECTION');
    if (!Array.isArray(policies) || !policies.length || policies.length > 16)
      throw new Error('INVALID_AUDIT_ERASURE_POLICY');
    // Snapshot caller input before awaiting; neither adapters nor callers may
    // change the selected identity or schema policy during the transaction.
    const parameters = [
      subject.accountId.toLowerCase(),
      [...new Set(subject.profileIds.map((id) => id.toLowerCase()))],
    ];
    const sources = policies
      .map((policy) => {
        const account = [...policy.accountColumns],
          profile = [...policy.profileColumns];
        const clear = Object.entries(policy.clearColumns || {}) as [
          string,
          AuditClearValue
        ][];
        const bindings = { ...(policy.profileAccountBindings || {}) };
        const names = [...account, ...profile, ...clear.map(([name]) => name)];
        if (
          !IDENTIFIER.test(policy.table) ||
          account.length + profile.length === 0 ||
          names.length > 32 ||
          names.some((name) => !IDENTIFIER.test(name)) ||
          new Set(names).size !== names.length ||
          clear.some(
            ([, value]) => !Object.prototype.hasOwnProperty.call(CLEAR, value)
          ) ||
          Object.entries(bindings).some(
            ([column, accountColumn]) =>
              !profile.includes(column) || !account.includes(accountColumn)
          ) ||
          (policy.disposition !== undefined &&
            !['redact', 'delete-private'].includes(policy.disposition))
        )
          throw new Error('INVALID_AUDIT_ERASURE_POLICY');
        const equalsAccount = (column: string) =>
          `lower(btrim("${column}"::text)) = $1`;
        const equalsProfile = (column: string) =>
          `lower(btrim("${column}"::text)) = ANY($2::text[])`;
        const predicate = `($1::text IS NOT NULL AND $2::text[] IS NOT NULL) AND (${[
          ...account.map(equalsAccount),
          ...profile.map(equalsProfile),
        ].join(' OR ')})`;
        const assignments = [
          ...account.map(
            (column) =>
              `"${column}" = CASE WHEN ${equalsAccount(
                column
              )} THEN NULL ELSE "${column}" END`
          ),
          ...profile.map(
            (column) =>
              `"${column}" = CASE WHEN ${equalsProfile(column)}${
                bindings[column] ? ` OR ${equalsAccount(bindings[column])}` : ''
              } THEN NULL ELSE "${column}" END`
          ),
          ...clear.map(([column, value]) => `"${column}" = ${CLEAR[value]}`),
        ].join(', ');
        const unsafe =
          clear
            .map(
              ([column, value]) =>
                `"${column}" IS DISTINCT FROM ${CLEAR[value]}`
            )
            .join(' OR ') || 'FALSE';
        return {
          table: policy.table,
          relation: `"public"."${policy.table}"`,
          predicate,
          assignments,
          unsafe,
          disposition: policy.disposition,
        };
      })
      .sort((a, b) => a.table.localeCompare(b.table));
    if (new Set(sources.map((source) => source.table)).size !== sources.length)
      throw new Error('INVALID_AUDIT_ERASURE_POLICY');
    const count = (rows: unknown): number => {
      const value =
        Array.isArray(rows) &&
        rows.length === 1 &&
        rows[0] &&
        typeof rows[0] === 'object'
          ? (rows[0] as { n?: unknown }).n
          : undefined;
      const n =
        typeof value === 'string' && /^\d+$/.test(value)
          ? Number(value)
          : value;
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0)
        throw new Error('INVALID_AUDIT_READBACK');
      return n;
    };
    try {
      return await this.database.transaction(async (transaction) => {
        if (prepareTransaction) await prepareTransaction(transaction);
        await transaction.query("SET LOCAL lock_timeout = '5s'");
        await transaction.query("SET LOCAL statement_timeout = '15s'");
        for (const source of sources)
          await transaction.query(
            `LOCK TABLE ${source.relation} IN SHARE ROW EXCLUSIVE MODE`
          );
        let total = 0;
        for (const source of sources) {
          total += count(
            await transaction.query(
              `SELECT count(*)::text AS n FROM ${source.relation} WHERE ${source.predicate}`,
              parameters
            )
          );
          if (total > MAX_ROWS) throw new Error('AUDIT_ERASURE_LIMIT_EXCEEDED');
        }
        const receipt: AuditErasureReceipt = {
          allDeclaredSourcesVerified: true,
          sources: [],
        };
        for (const source of sources) {
          const mutation =
            source.disposition === 'delete-private'
              ? `DELETE FROM ${source.relation} WHERE ${source.predicate}`
              : `UPDATE ${source.relation} SET ${source.assignments} WHERE ${source.predicate}`;
          const changedRows = await transaction.query(
            `WITH changed AS (${mutation} RETURNING "id") SELECT count(*)::text AS n, array_agg("id") AS ids FROM changed`,
            parameters
          );
          const changed = count(changedRows);
          const ids = (changedRows as { ids?: unknown }[])[0].ids ?? [];
          if (
            !Array.isArray(ids) ||
            ids.length !== changed ||
            ids.some((id) => typeof id !== 'string' || !UUID.test(id))
          )
            throw new Error('INVALID_AUDIT_READBACK');
          const remaining = count(
            await transaction.query(
              `SELECT count(*)::text AS n FROM ${source.relation} WHERE ${source.predicate}`,
              parameters
            )
          );
          if (remaining !== 0) throw new Error('AUDIT_ERASURE_READBACK_FAILED');
          const retainedRows = await transaction.query(
            `SELECT count(*)::text AS n, count(*) FILTER (WHERE ${source.unsafe})::text AS unsafe FROM ${source.relation} WHERE $1::text IS NOT NULL AND $2::text[] IS NOT NULL AND "id" = ANY($3::uuid[])`,
            [...parameters, ids]
          );
          const retained = count(retainedRows);
          const unsafe = count([
            { n: (retainedRows as { unsafe?: unknown }[])[0]?.unsafe },
          ]);
          if (
            retained !==
              (source.disposition === 'delete-private' ? 0 : changed) ||
            unsafe !== 0
          )
            throw new Error('AUDIT_ERASURE_READBACK_FAILED');
          receipt.sources.push({ source: source.table, changed, remaining });
        }
        return receipt;
      });
    } catch {
      // Never leak SQL, raw driver errors, identities or private row content.
      throw new Error('AUDIT_ERASURE_FAILED');
    }
  }
}
