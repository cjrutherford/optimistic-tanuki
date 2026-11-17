/**
 * Slice 8 (S5-item1-business-identity-design.md): the identity health block for `/health/ready` and the review
 * queue for carries that need a person. Health is counts only (no ids, no keys, no names) and is a label: it never
 * changes readiness. The queue returns business ids and row coordinates for an operator; it is not a public route.
 */
import { identityVersionTokens } from './business-identity-undo';

type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LIVE_POLICY = `EXISTS (SELECT 1 FROM directory_overture_private_policy p WHERE p."policyId"=a."policyId" AND p.revoked=false)`;

export interface BusinessIdentityHealth {
  /** A carry could not decide a row (duplicate or ambiguous key) and nothing has asserted it since. */
  readonly unresolved: number;
  /** Active businesses with no current assertion in a live policy. */
  readonly absent: number;
  /** Owner links waiting for the owner or a reviewer to re-confirm after a carry. */
  readonly awaitingOwner: number;
  /** Carry runs that were planned or started and have not completed. */
  readonly carryIncomplete: number;
  /** Carried businesses whose predecessor was verified but whose current row has no live binding. */
  readonly carriedUnbound: number;
}

const UNBOUND_FROM = `
  FROM directory_business b
  JOIN directory_business_assertion a ON a."businessId"=b.id AND a.state='current' AND a.confidence='carried' AND ${LIVE_POLICY}
  JOIN directory_business_assertion pa ON pa.id=a."predecessorAssertionId"
 WHERE b.state='active'
   AND EXISTS (SELECT 1 FROM directory_reviewed_binding pb WHERE pb."scanId"=pa."scanId" AND pb."sourceFileRowNumber"=pa."sourceFileRowNumber" AND pb."verifiedAt" IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM directory_reviewed_binding nb WHERE nb."scanId"=a."scanId" AND nb."sourceFileRowNumber"=a."sourceFileRowNumber" AND nb.state='active' AND nb."verifiedUntil">now())`;

const UNRESOLVED_FROM = `
  FROM directory_business_event e
  JOIN directory_business b ON b.id=e."businessId" AND b.state='active'
 WHERE e.kind='unresolved' AND e."scanId" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM directory_business_assertion x WHERE x."scanId"=e."scanId" AND x."sourceFileRowNumber"=e."sourceFileRowNumber")
   AND EXISTS (SELECT 1 FROM directory_overture_private_membership m JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false WHERE m."scanId"=e."scanId")
   AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation y WHERE y."scanId"=e."scanId" AND y."sourceFileRowNumber"=e."sourceFileRowNumber")`;

export async function businessIdentityHealth(
  db: Q
): Promise<BusinessIdentityHealth> {
  const [row] = await db.query(
    `SELECT
       (SELECT count(*) ${UNRESOLVED_FROM})::int AS unresolved,
       (SELECT count(*) FROM directory_business b WHERE b.state='active' AND NOT EXISTS (SELECT 1 FROM directory_business_assertion a WHERE a."businessId"=b.id AND a.state='current' AND ${LIVE_POLICY}))::int AS absent,
       (SELECT count(*) FROM directory_business_link_carry WHERE state='awaiting_confirmation')::int AS "awaitingOwner",
       (SELECT count(*) FROM directory_business_carry_state s WHERE s.state<>'complete' AND NOT EXISTS (SELECT 1 FROM directory_overture_private_policy p WHERE p."policyId"=s."toPolicyId" AND p.revoked=true))::int AS "carryIncomplete",
       (SELECT count(*) ${UNBOUND_FROM})::int AS "carriedUnbound"`
  );
  return {
    unresolved: row.unresolved,
    absent: row.absent,
    awaitingOwner: row.awaitingOwner,
    carryIncomplete: row.carryIncomplete,
    carriedUnbound: row.carriedUnbound,
  };
}

export interface IdentityReviewQueue {
  readonly carriedUnbound: ReadonlyArray<{
    businessId: string;
    scanId: string;
    sourceFileRowNumber: string;
    versionToken: string | null;
  }>;
  readonly unresolved: ReadonlyArray<{
    businessId: string;
    scanId: string;
    sourceFileRowNumber: string;
    cause: string;
    versionToken: string | null;
  }>;
  readonly awaitingOwner: ReadonlyArray<{
    carryId: string;
    requestId: string;
    businessId: string;
    versionToken: string | null;
  }>;
}

/** Operator queue for one town. Each list is capped at 100 and ordered by id so repeated reads are stable. */
export async function listIdentityReviewQueue(
  db: Q,
  townId: string
): Promise<IdentityReviewQueue> {
  if (!UUID.test(townId)) throw Error('Invalid business identity review');
  const carriedUnbound = await db.query(
    `SELECT b.id AS "businessId", a."scanId", a."sourceFileRowNumber"::text AS "sourceFileRowNumber" ${UNBOUND_FROM} AND b."communityId"=$1 ORDER BY b.id LIMIT 100`,
    [townId]
  );
  const unresolved = await db.query(
    `SELECT e."businessId", e."scanId", e."sourceFileRowNumber"::text AS "sourceFileRowNumber", e.cause ${UNRESOLVED_FROM} AND b."communityId"=$1 ORDER BY e."businessId", e."scanId", e."sourceFileRowNumber" LIMIT 100`,
    [townId]
  );
  const awaitingOwner = await db.query(
    `SELECT c.id AS "carryId", c."requestId", c."businessId" FROM directory_business_link_carry c JOIN directory_business_link_request r ON r."requestId"=c."requestId"
      WHERE r."townId"=$1 AND c.state='awaiting_confirmation' ORDER BY c.id LIMIT 100`,
    [townId]
  );
  const tokens = await identityVersionTokens(db, townId, [
    ...carriedUnbound.map((r) => r.businessId),
    ...unresolved.map((r) => r.businessId),
    ...awaitingOwner.map((r) => r.businessId),
  ]);
  const withToken = <T extends { businessId: string }>(rows: T[]) =>
    rows.map((r) => ({ ...r, versionToken: tokens.get(r.businessId) ?? null }));
  return {
    carriedUnbound: withToken(carriedUnbound),
    unresolved: withToken(unresolved),
    awaitingOwner: withToken(awaitingOwner),
  };
}
