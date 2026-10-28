import { createHash } from 'node:crypto';
import {
  DataSource,
  Entity,
  EntityManager,
  PrimaryColumn,
  CreateDateColumn,
  Column,
} from 'typeorm';

export type DeletionIdentityKind = 'account' | 'profile' | 'legacy-profile';
export interface DeletionIdentity {
  kind: DeletionIdentityKind;
  id: string;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATION_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NIL_UUID = /^0{8}-0{4}-0{4}-0{4}-0{12}$/;

@Entity('account_deletion_write_fence')
export class AccountDeletionWriteFenceEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 }) key!: string;
  @Column({ type: 'varchar', length: 24 }) kind!: DeletionIdentityKind;
  @Column({ type: 'uuid' }) operationId!: string;
  @CreateDateColumn({ type: 'timestamptz' }) installedAt!: Date;
}

function canonicalIdentity(
  kind: unknown,
  id: unknown
): { kind: DeletionIdentityKind; id: string } {
  if (kind !== 'account' && kind !== 'profile' && kind !== 'legacy-profile')
    throw new Error('DELETION_IDENTITY_KIND_INVALID');
  if (typeof id !== 'string') throw new Error('DELETION_IDENTITY_INVALID');
  if (kind === 'legacy-profile') {
    if (id.length < 1 || id.length > 512 || id.trim() !== id)
      throw new Error('DELETION_IDENTITY_INVALID');
    return { kind, id: UUID.test(id) ? id.toLowerCase() : id };
  }
  const lower = id.toLowerCase();
  if (!UUID.test(id) || NIL_UUID.test(lower))
    throw new Error('DELETION_IDENTITY_INVALID');
  return { kind, id: lower };
}

export function deletionIdentityKey(
  kind: DeletionIdentityKind,
  id: string
): string {
  const identity = canonicalIdentity(kind, id);
  return createHash('sha256')
    .update(`ot-account-deletion-v1:${identity.kind}:${identity.id}`, 'utf8')
    .digest('hex');
}

function validateOperationId(operationId: string): string {
  if (
    typeof operationId !== 'string' ||
    !OPERATION_UUID.test(operationId) ||
    NIL_UUID.test(operationId.toLowerCase())
  )
    throw new Error('DELETION_OPERATION_ID_INVALID');
  return operationId.toLowerCase();
}

export async function installDeletionWriteFence(
  manager: EntityManager,
  operationId: string,
  identities: DeletionIdentity[]
): Promise<void> {
  const op = validateOperationId(operationId);
  if (!Array.isArray(identities) || identities.length > 1000)
    throw new Error('DELETION_IDENTITIES_INVALID');
  const rows = identities.map(({ kind, id }) => ({
    kind: canonicalIdentity(kind, id).kind,
    key: deletionIdentityKey(kind, id),
  }));
  const unique = new Map<string, DeletionIdentityKind>();
  for (const row of rows) {
    const prior = unique.get(row.key);
    if (prior && prior !== row.kind)
      throw new Error('DELETION_IDENTITY_HASH_COLLISION');
    unique.set(row.key, row.kind);
  }
  for (const [key, kind] of [...unique].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [key]
    );
    await manager.query(
      'INSERT INTO account_deletion_write_fence ("key", kind, "operationId") VALUES ($1, $2, $3) ON CONFLICT ("key") DO NOTHING',
      [key, kind, op]
    );
    const found = await manager.query(
      'SELECT "operationId" FROM account_deletion_write_fence WHERE "key" = $1',
      [key]
    );
    if (
      !Array.isArray(found) ||
      found.length !== 1 ||
      String(found[0].operationId).toLowerCase() !== op
    )
      throw new Error('DELETION_WRITE_FENCE_OWNERSHIP_CONFLICT');
  }
}

export async function fencedDeletionTransaction<T>(
  dataSource: DataSource,
  operationId: string,
  work: (manager: EntityManager) => Promise<T>
): Promise<T> {
  const op = validateOperationId(operationId);
  return dataSource.transaction(async (manager) => {
    await manager.query(
      "SELECT set_config('ot.deletion_operation', $1, true)",
      [op]
    );
    return work(manager);
  });
}

export interface DeletionWriteFencePolicy {
  table: string;
  identities: Array<{
    column: string;
    kind: DeletionIdentityKind;
    array?: 'json' | 'csv';
  }>;
}
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
function quoteIdentifier(value: string): string {
  if (!IDENTIFIER.test(value))
    throw new Error('DELETION_SQL_IDENTIFIER_INVALID');
  return `"${value}"`;
}

export function generateDeletionWriteFenceSql(
  policies: DeletionWriteFencePolicy[]
): { up: string[]; down: string[] } {
  if (!Array.isArray(policies))
    throw new Error('DELETION_SQL_POLICIES_INVALID');
  const tables = new Map<string, DeletionWriteFencePolicy>();
  for (const policy of policies) {
    const table = quoteIdentifier(policy.table);
    if (!Array.isArray(policy.identities) || !policy.identities.length)
      throw new Error('DELETION_SQL_POLICIES_INVALID');
    for (const item of policy.identities) {
      quoteIdentifier(item.column);
      canonicalIdentity(
        item.kind,
        item.kind === 'legacy-profile'
          ? 'x'
          : '00000000-0000-1000-8000-000000000001'
      );
      if (
        item.array !== undefined &&
        item.array !== 'json' &&
        item.array !== 'csv'
      )
        throw new Error('DELETION_SQL_POLICIES_INVALID');
    }
    const old = tables.get(policy.table);
    if (old) old.identities.push(...policy.identities);
    else
      tables.set(policy.table, {
        table: policy.table,
        identities: [...policy.identities],
      });
    void table;
  }
  const functionSql = `CREATE OR REPLACE FUNCTION ot_account_deletion_write_fence_guard() RETURNS trigger LANGUAGE plpgsql AS $ot$\nDECLARE side jsonb; raw_value text; op text; locked text[] := ARRAY[]::text[]; fenced_ops text[] := ARRAY[]::text[]; k text;\nBEGIN\n  IF TG_OP <> 'INSERT' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(OLD), TG_ARGV); END IF;\n  IF TG_OP <> 'DELETE' THEN locked := locked || ot_collect_deletion_fence_keys(to_jsonb(NEW), TG_ARGV); END IF;\n  SELECT array_agg(DISTINCT x ORDER BY x) INTO locked FROM unnest(locked) x;\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP PERFORM pg_advisory_xact_lock(hashtextextended(k, 0)); END LOOP;\n  op := current_setting('ot.deletion_operation', true);\n  FOREACH k IN ARRAY COALESCE(locked, ARRAY[]::text[]) LOOP\n    SELECT "operationId"::text INTO raw_value FROM account_deletion_write_fence WHERE "key" = k;\n    IF FOUND THEN fenced_ops := array_append(fenced_ops, raw_value); END IF;\n  END LOOP;\n  -- Trusted owner adapters enforce precise ownership and counterpart field policy.\n  IF cardinality(fenced_ops) > 0 AND (op IS NULL OR NOT (op = ANY(fenced_ops))) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCOUNT_DELETION_FENCED'; END IF;\n  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_collect_deletion_fence_keys(side jsonb, args text[]) RETURNS text[] LANGUAGE plpgsql AS $ot$\nDECLARE i integer := 0; col text; identity_kind text; mode text; v jsonb; s text; item jsonb; result text[] := ARRAY[]::text[]; k text;\nBEGIN\n  WHILE i < COALESCE(array_length(args, 1), 0) LOOP col := args[i]; identity_kind := args[i+1]; mode := args[i+2]; v := side -> col;\n    IF v IS NOT NULL AND v <> 'null'::jsonb THEN\n      IF mode = 'json' AND jsonb_typeof(v) = 'array' THEN FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP k := ot_deletion_fence_key(item #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSIF mode = 'csv' AND jsonb_typeof(v) = 'string' THEN s := v #>> '{}'; FOREACH col IN ARRAY string_to_array(s, ',') LOOP k := ot_deletion_fence_key(col, identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END LOOP;\n      ELSE k := ot_deletion_fence_key(v #>> '{}', identity_kind); IF k IS NOT NULL THEN result := array_append(result, k); END IF; END IF;\n    END IF; i := i + 3; END LOOP; RETURN result;\nEND $ot$;\nCREATE OR REPLACE FUNCTION ot_deletion_fence_key(raw_id text, identity_kind text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $ot$\nDECLARE canon text; BEGIN\n  IF identity_kind IN ('account','profile') THEN IF raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR lower(raw_id) = '00000000-0000-0000-0000-000000000000' THEN RETURN NULL; END IF; canon := lower(raw_id);\n  ELSIF identity_kind = 'legacy-profile' THEN IF length(raw_id) NOT BETWEEN 1 AND 512 OR raw_id ~ '^[[:space:]]|[[:space:]]$' THEN RETURN NULL; END IF; canon := CASE WHEN raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN lower(raw_id) ELSE raw_id END; ELSE RETURN NULL; END IF;\n  RETURN encode(sha256(convert_to('ot-account-deletion-v1:' || identity_kind || ':' || canon, 'UTF8')), 'hex');\nEND $ot$;`;
  const up = [functionSql];
  const down: string[] = [];
  for (const [tableName, policy] of tables) {
    const table = quoteIdentifier(tableName);
    const trigger = quoteIdentifier(`ot_deletion_write_fence_${tableName}`);
    const args = policy.identities
      .flatMap((p) => [p.column, p.kind, p.array ?? 'scalar'])
      .map((v) => `'${v.replace(/'/g, "''")}'`)
      .join(', ');
    up.push(
      `CREATE TRIGGER ${trigger} BEFORE INSERT OR UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION ot_account_deletion_write_fence_guard(${args});`
    );
    down.unshift(`DROP TRIGGER IF EXISTS ${trigger} ON ${table};`);
  }
  down.push(
    'DROP FUNCTION IF EXISTS ot_deletion_fence_key(text, text);',
    'DROP FUNCTION IF EXISTS ot_collect_deletion_fence_keys(jsonb, text[]);',
    'DROP FUNCTION IF EXISTS ot_account_deletion_write_fence_guard();'
  );
  return { up, down };
}
