import { deletionIdentityKey } from '@optimistic-tanuki/storage';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** One database statement checks expiry/binding and optionally advances activity.
 * A nullable legacy row bootstraps from verified JWT iat; migration never revives it. */
export async function assertRollingSession(
  database: { query(sql: string, parameters: unknown[]): Promise<unknown> },
  tokenId: string,
  payload: { userId?: unknown; profileId?: unknown; iat?: unknown },
  activity: boolean
): Promise<string> {
  if (
    !UUID.test(tokenId) ||
    typeof payload.userId !== 'string' ||
    !UUID.test(payload.userId) ||
    typeof payload.iat !== 'number' ||
    !Number.isSafeInteger(payload.iat) ||
    payload.iat <= 0 ||
    (payload.profileId != null &&
      payload.profileId !== '' &&
      (typeof payload.profileId !== 'string' || !UUID.test(payload.profileId)))
  )
    throw Error('SESSION_BINDING_INVALID');
  const base = `"id"=$1::uuid AND "userId"=$2::uuid AND "profileId" IS NOT DISTINCT FROM $4::uuid
    AND NOT "revoked" AND $3::double precision<=extract(epoch from clock_timestamp())+30
    AND COALESCE("lastActivityAt",to_timestamp($3::double precision))>clock_timestamp()-interval '7 days'
    AND COALESCE("lastActivityAt",to_timestamp($3::double precision))<=clock_timestamp()+interval '30 seconds'
    AND NOT EXISTS(SELECT 1 FROM "account_deletion_write_fence" WHERE "key"=$5)`;
  const sql = activity
    ? `UPDATE "token" SET "lastActivityAt"=clock_timestamp() WHERE ${base} RETURNING "lastActivityAt"+interval '7 days' AS "expiresAt"`
    : `SELECT COALESCE("lastActivityAt",to_timestamp($3::double precision))+interval '7 days' AS "expiresAt" FROM "token" WHERE ${base}`;
  const raw = await database.query(sql, [
    tokenId,
    payload.userId,
    payload.iat,
    payload.profileId || null,
    deletionIdentityKey('account', payload.userId),
  ]);
  const rows =
    activity &&
    Array.isArray(raw) &&
    raw.length === 2 &&
    Array.isArray(raw[0]) &&
    raw[1] === 1
      ? raw[0]
      : activity
      ? []
      : raw;
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    !(rows[0]?.expiresAt instanceof Date) ||
    !Number.isFinite(rows[0].expiresAt.getTime())
  )
    throw Error('SESSION_IDLE_EXPIRED');
  return rows[0].expiresAt.toISOString();
}
