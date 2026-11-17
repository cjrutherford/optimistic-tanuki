import { createHmac } from 'node:crypto';

/**
 * Read side of business identity (S5-item1-business-identity-design.md, section 3): which public id a served
 * row carries, how an id resolves, and the serving generation that invalidates cursors at a cutover. Nothing
 * here exposes confidence, evidence or a carry hint, and nothing returns a reason for a miss.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
export interface SourceRowRef { readonly scanId: string; readonly row: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const MAX_SUCCESSOR_HOPS = 5;

/**
 * Overlap guard (design 3.4): a row whose business has a current assertion in another, live cohort is not
 * served, so a carried business is listed once while two cohorts are live. Rows without assertions are untouched.
 */
export const supersededByLiveCohort = (row: string): string =>
  `AND NOT EXISTS (SELECT 1 FROM directory_business_assertion oa
      JOIN directory_business_assertion ca ON ca."businessId"=oa."businessId" AND ca.state='current' AND ca."policyId"<>oa."policyId"
      JOIN directory_overture_private_policy cp ON cp."policyId"=ca."policyId" AND cp.revoked=false
      JOIN directory_overture_private_membership cm ON cm."policyId"=ca."policyId"
      JOIN directory_overture_private_completion cc ON cc."scanId"=cm."scanId" AND cc."scanId"=ca."scanId"
      WHERE oa."scanId"=${row}."scanId" AND oa."sourceFileRowNumber"=${row}."sourceFileRowNumber" AND oa.state<>'current')`;

/** Business ids for served rows: only a current assertion to an active business in this town counts. */
export async function businessIdsForRows(q: Q, town: string, rows: readonly SourceRowRef[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!UUID.test(town) || !rows.length) return out;
  const found = await q.query(
    `SELECT a."scanId", a."sourceFileRowNumber", a."businessId"
       FROM unnest($2::varchar[],$3::bigint[]) AS u(scan,row)
       JOIN directory_business_assertion a ON a."scanId"=u.scan AND a."sourceFileRowNumber"=u.row AND a."communityId"=$1 AND a.state='current'
       JOIN directory_business b ON b.id=a."businessId" AND b."communityId"=$1 AND b.state='active'`,
    [town, rows.map((r) => r.scanId), rows.map((r) => r.row)]
  );
  for (const r of found) out.set(`${r.scanId}:${String(r.sourceFileRowNumber)}`, r.businessId);
  return out;
}

export type Resolution = { readonly kind: 'none' } | { readonly kind: 'dead' } | { readonly kind: 'row'; readonly position: SourceRowRef; readonly businessId: string };

/**
 * Resolves a business id. `none` means the id is not a business of this town (the caller may try a listing
 * identity); `dead` is every other miss: retired, absent, unresolved, split without a successor, an
 * over-long or cyclic successor chain. Callers must answer both misses identically.
 */
export async function resolveBusinessId(q: Q, town: string, id: string): Promise<Resolution> {
  if (!UUID.test(town) || !UUID.test(id)) return { kind: 'none' };
  const seen = new Set<string>();
  let current = id;
  for (let hop = 0; hop <= MAX_SUCCESSOR_HOPS; hop += 1) {
    if (seen.has(current)) return { kind: 'dead' };
    seen.add(current);
    const found = await q.query('SELECT state, "successorId" FROM directory_business WHERE id=$1 AND "communityId"=$2', [current, town]);
    if (!found.length) return hop === 0 ? { kind: 'none' } : { kind: 'dead' };
    const { state, successorId } = found[0];
    if (state === 'active') {
      const rows = await q.query(
        `SELECT a."scanId", a."sourceFileRowNumber" FROM directory_business_assertion a
           JOIN directory_overture_private_policy p ON p."policyId"=a."policyId" AND p.revoked=false
          WHERE a."businessId"=$1 AND a."communityId"=$2 AND a.state='current'`,
        [current, town]
      );
      // More than one live current assertion is an overlap this resolver will not break by choosing one.
      if (rows.length !== 1) return { kind: 'dead' };
      return { kind: 'row', position: { scanId: rows[0].scanId, row: String(rows[0].sourceFileRowNumber) }, businessId: current };
    }
    if ((state === 'merged' || state === 'split') && typeof successorId === 'string' && UUID.test(successorId)) { current = successorId; continue; }
    return { kind: 'dead' };
  }
  return { kind: 'dead' };
}

/** The business, if any, a historical source row was ever asserted to be (alias for an old listing id). */
export async function businessOfSourceRow(q: Q, town: string, position: SourceRowRef): Promise<string | null> {
  if (!UUID.test(town)) return null;
  const rows = await q.query('SELECT "businessId" FROM directory_business_assertion WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "communityId"=$3', [position.scanId, position.row, town]);
  return rows.length === 1 ? rows[0].businessId : null;
}

/**
 * Keyed hash of the sorted live, completed policy ids that carry business assertions (a cohort with no identity
 * cannot change what an id means, so revoking or adding one leaves cursors valid). A cutover changes it, so a cursor or reference sealed
 * before it is rejected like a change-token mismatch and the client restarts.
 */
export async function servingGeneration(q: Q, secret: string): Promise<string> {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw Error('Invalid generation secret');
  const rows = await q.query(
    `SELECT p."policyId" FROM directory_overture_private_policy p
      WHERE p.revoked=false AND EXISTS (SELECT 1 FROM directory_business_assertion a WHERE a."policyId"=p."policyId")
        AND EXISTS (SELECT 1 FROM directory_overture_private_membership m JOIN directory_overture_private_completion c ON c."scanId"=m."scanId" WHERE m."policyId"=p."policyId")
      ORDER BY p."policyId"`
  );
  return createHmac('sha256', secret).update('serving-generation-v1\0').update(rows.map((r) => r.policyId).join(',')).digest('hex');
}
