import { randomUUID } from 'node:crypto';
import {
  DIRECTORY_OPERATING_CONTROL_KEYS,
  type DirectoryOperatingControl,
  type DirectoryOperatingControlKey,
} from '../../../libs/social/contracts/src/lib/directory';

/**
 * Operator pause switches (S9a). An absent row means running. Pausing stops *new* work only: a leased export job or an
 * in-flight transaction finishes. The withdrawal worker has no switch; rights obligations are never pausable.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const CONTROL_REASON_MAX = 500;

export const isControlKey = (
  key: unknown
): key is DirectoryOperatingControlKey =>
  typeof key === 'string' &&
  (DIRECTORY_OPERATING_CONTROL_KEYS as readonly string[]).includes(key);

/** Thrown (and classified by the run ledger as blocked `provider_paused`) when provider work starts while paused. */
export class ProviderPausedError extends Error {
  readonly reason = 'provider_paused' as const;
  constructor() {
    super('Provider acquisition is paused (provider_paused)');
  }
}

export interface SetControlInput {
  key: string;
  paused: boolean;
  reason?: string | null;
  actorId: string;
  expectedVersion: number;
}
export type SetControlResult =
  | { ok: true; control: DirectoryOperatingControl }
  | { ok: false; code: 'stale_version' };

const iso = (v: unknown) =>
  v === null || v === undefined
    ? null
    : v instanceof Date
    ? v.toISOString()
    : String(v);

// TypeORM returns [rows, affected] for UPDATE ... RETURNING and plain rows otherwise.
const rowsOf = (result: any): any[] =>
  Array.isArray(result?.[0]) ? result[0] : result ?? [];

const toControl = (r: any): DirectoryOperatingControl => ({
  key: r.key,
  paused: r.paused === true,
  reason: r.reason ?? null,
  version: Number(r.version),
  updatedBy: r.updatedBy ?? null,
  updatedAt: iso(r.updatedAt),
});

/** Validates an update; returns the normalised reason or throws `Invalid operating control`. */
export function validateControlInput(i: SetControlInput): string | null {
  const reason = typeof i?.reason === 'string' ? i.reason.trim() : '';
  if (
    !i ||
    !isControlKey(i.key) ||
    typeof i.paused !== 'boolean' ||
    (i.reason !== undefined &&
      i.reason !== null &&
      typeof i.reason !== 'string') ||
    reason.length > CONTROL_REASON_MAX ||
    (i.paused && !reason) ||
    typeof i.actorId !== 'string' ||
    !UUID.test(i.actorId) ||
    !Number.isSafeInteger(i.expectedVersion) ||
    i.expectedVersion < 0
  )
    throw Error('Invalid operating control');
  return reason || null;
}

/** All three controls; a key with no row is synthesized as running at version 0. */
export async function listControls(
  db: Q
): Promise<DirectoryOperatingControl[]> {
  const rows = await db.query(
    'SELECT "key",paused,reason,version,"updatedBy","updatedAt" FROM directory_operating_control'
  );
  const byKey = new Map(rows.map((r) => [r.key as string, r]));
  return DIRECTORY_OPERATING_CONTROL_KEYS.map((key) => {
    const row = byKey.get(key);
    return row
      ? toControl(row)
      : {
          key,
          paused: false,
          reason: null,
          version: 0,
          updatedBy: null,
          updatedAt: null,
        };
  });
}

/** True only when a row says paused. Works on a DataSource, a transaction manager or any `query` client. */
export async function isPaused(
  db: Q,
  key: DirectoryOperatingControlKey
): Promise<boolean> {
  const rows = await db.query(
    'SELECT paused FROM directory_operating_control WHERE "key"=$1',
    [key]
  );
  return rows[0]?.paused === true;
}

/**
 * One transaction: optimistic version check, upsert, audit event. `expectedVersion` 0 means "no row yet"; any other
 * value must equal the stored version. A mismatch is `stale_version` and changes nothing.
 */
export async function setControl(
  db: Db,
  input: SetControlInput
): Promise<SetControlResult> {
  const reason = validateControlInput(input);
  return db.transaction(async (q) => {
    await q.query("SET LOCAL lock_timeout = '2s'");
    let rows: any[];
    if (input.expectedVersion === 0) {
      rows = await q.query(
        `INSERT INTO directory_operating_control ("key",paused,reason,version,"updatedBy","updatedAt")
         VALUES ($1,$2,$3,1,$4,now()) ON CONFLICT ("key") DO NOTHING
         RETURNING "key",paused,reason,version,"updatedBy","updatedAt"`,
        [input.key, input.paused, reason, input.actorId]
      );
    } else {
      rows = await q.query(
        `UPDATE directory_operating_control SET paused=$2,reason=$3,version=version+1,"updatedBy"=$4,"updatedAt"=now()
         WHERE "key"=$1 AND version=$5
         RETURNING "key",paused,reason,version,"updatedBy","updatedAt"`,
        [input.key, input.paused, reason, input.actorId, input.expectedVersion]
      );
    }
    rows = rowsOf(rows);
    if (!rows.length)
      return { ok: false as const, code: 'stale_version' as const };
    await q.query(
      `INSERT INTO directory_operating_control_event (id,"key",paused,reason,"actorId","previousVersion")
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        randomUUID(),
        input.key,
        input.paused,
        reason,
        input.actorId,
        input.expectedVersion,
      ]
    );
    return { ok: true as const, control: toControl(rows[0]) };
  });
}
