import { ACCOUNT_DELETION_FENCED, assertDirectoryIdentitiesUnfenced } from './account-lifecycle-fence';

/**
 * Owner links across a release (S5-item1-business-identity-design.md, 2.4 and decision 4). A carry never moves a
 * link by itself: it proposes the move (`awaiting_confirmation`, link hidden on the new row) and the move happens
 * only when
 *   - the business's new assertion is `corroborated` (upstream key, equal name, and an independently reviewed
 *     address that equals the predecessor's last active one), or
 *   - the owner re-confirms their own link, or
 *   - a reviewer confirms the business (`business-identity-decision.ts`).
 * Nothing here copies a binding, a candidate or reviewed fields.
 *
 * Lock order in every write transaction: owner/actor fence advisory locks -> town advisory lock -> business row
 * -> carry row -> request row. Revoke takes the same town lock, so a revoke and a restore never interleave.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const townLock = (town: string) => `directory-business-identity:${town}`;
const lockTown = (tx: Q, town: string) => tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))', [townLock(town)]);
const fenced = (error: unknown) => error instanceof Error && error.message === ACCOUNT_DELETION_FENCED;

export type LinkActor = { readonly id: string | null; readonly domain: 'account' | 'profile' | 'system' };
export const SYSTEM_ACTOR: LinkActor = { id: null, domain: 'system' };

export interface StageResult { readonly proposed: number; readonly existing: number; readonly skipped: number }

/**
 * Proposes the move of each approved link whose listing's row has been superseded by a carry. The target is the
 * single current live assertion of the same business; a business with more than one (overlapping cohorts) is
 * skipped. A link whose owner is being erased is skipped. Safe to repeat.
 */
export async function stageLinkCarries(db: Db, input: { townId: string }): Promise<StageResult> {
  if (!UUID.test(input.townId)) throw Error('Invalid business link carry');
  const candidates = await db.query(
    `SELECT a."requestId", a."listingId" AS "fromListingId", pa."businessId", ca."scanId", ca."sourceFileRowNumber"
       FROM directory_business_link_active a
       JOIN directory_business_link_request r ON r."requestId"=a."requestId" AND r.status='approved' AND r."townId"=$1
       JOIN directory_listing_identity li ON li.id=a."listingId" AND li."communityId"=$1
       JOIN directory_business_assertion pa ON pa."scanId"=li."scanId" AND pa."sourceFileRowNumber"=li."sourceFileRowNumber" AND pa."communityId"=$1 AND pa.state='superseded'
       JOIN directory_business b ON b.id=pa."businessId" AND b.state='active'
       JOIN directory_business_assertion ca ON ca."businessId"=pa."businessId" AND ca.state='current' AND ca."communityId"=$1
       JOIN directory_overture_private_policy cp ON cp."policyId"=ca."policyId" AND cp.revoked=false
      ORDER BY a."requestId", ca."scanId", ca."sourceFileRowNumber"`,
    [input.townId]
  );
  const perRequest = new Map<string, any[]>();
  for (const row of candidates) perRequest.set(row.requestId, [...(perRequest.get(row.requestId) ?? []), row]);
  let proposed = 0, existing = 0, skipped = 0;
  for (const [requestId, rows] of perRequest) {
    if (rows.length !== 1) { skipped += 1; continue; }
    const target = rows[0];
    try {
      const done = await db.transaction(async (tx) => {
        const owner = await tx.query('SELECT "ownerId" FROM directory_business_link_request WHERE "requestId"=$1', [requestId]);
        await assertDirectoryIdentitiesUnfenced(tx, [owner[0]?.ownerId]);
        await lockTown(tx, input.townId);
        const request = await tx.query('SELECT status FROM directory_business_link_request WHERE "requestId"=$1 FOR UPDATE', [requestId]);
        const active = await tx.query('SELECT "listingId" FROM directory_business_link_active WHERE "requestId"=$1', [requestId]);
        if (request.length !== 1 || request[0].status !== 'approved' || active.length !== 1 || active[0].listingId !== target.fromListingId) return 'skipped';
        await tx.query(
          `INSERT INTO directory_listing_identity ("communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3) ON CONFLICT ("communityId","scanId","sourceFileRowNumber") DO NOTHING`,
          [input.townId, target.scanId, target.sourceFileRowNumber]
        );
        const [to] = await tx.query('SELECT id FROM directory_listing_identity WHERE "communityId"=$1 AND "scanId"=$2 AND "sourceFileRowNumber"=$3', [input.townId, target.scanId, target.sourceFileRowNumber]);
        // A proposal for an older release that nobody confirmed is stale once a newer row is current.
        await tx.query(
          `UPDATE directory_business_link_carry SET state='closed',"updatedAt"=now() WHERE "requestId"=$1 AND state='awaiting_confirmation' AND "toListingId"<>$2`,
          [requestId, to.id]
        );
        const inserted = await tx.query(
          `INSERT INTO directory_business_link_carry ("requestId","businessId","fromListingId","toListingId") VALUES ($1,$2,$3,$4) ON CONFLICT ("requestId","toListingId") DO NOTHING RETURNING id`,
          [requestId, target.businessId, target.fromListingId, to.id]
        );
        await tx.query('UPDATE directory_business_link_request SET "businessId"=COALESCE("businessId",$2) WHERE "requestId"=$1', [requestId, target.businessId]);
        if (!inserted.length) return 'existing';
        await tx.query(`INSERT INTO directory_business_link_event ("requestId","actorId",action,"actorDomain") VALUES ($1,NULL,'carry_pending','system')`, [requestId]);
        return 'proposed';
      });
      if (done === 'proposed') proposed += 1; else if (done === 'existing') existing += 1; else skipped += 1;
    } catch (error) {
      if (!fenced(error)) throw error;
      skipped += 1;
    }
  }
  return { proposed, existing, skipped };
}

/**
 * Whether the business's new assertion has earned `corroborated`: it carried by key, the name hash is equal and
 * non-null, the new row has its own active binding with a current lease, and that binding's address hash equals
 * the address hash of the predecessor row's most recently verified binding. Read-only.
 */
export async function corroborationHolds(tx: Q, assertionId: string): Promise<boolean> {
  const rows = await tx.query(
    `SELECT 1
       FROM directory_business_assertion ca
       JOIN directory_business_assertion pa ON pa.id=ca."predecessorAssertionId"
       JOIN directory_reviewed_binding nb ON nb."scanId"=ca."scanId" AND nb."sourceFileRowNumber"=ca."sourceFileRowNumber" AND nb.state='active' AND nb."verifiedUntil">now()
       JOIN LATERAL (SELECT pb."fieldHashes" FROM directory_reviewed_binding pb
                      WHERE pb."scanId"=pa."scanId" AND pb."sourceFileRowNumber"=pa."sourceFileRowNumber" AND pb."verifiedAt" IS NOT NULL
                      ORDER BY pb."verifiedAt" DESC, pb.id LIMIT 1) last ON true
      WHERE ca.id=$1 AND ca.state='current' AND ca.confidence='carried' AND ca.evidence='upstream_id'
        AND ca."nameHash" IS NOT NULL AND ca."nameHash"=pa."nameHash"
        AND nb."fieldHashes"->'address'->>'hash' IS NOT NULL
        AND nb."fieldHashes"->'address'->>'hash'=last."fieldHashes"->'address'->>'hash'`,
    [assertionId]
  );
  return rows.length > 0;
}

export interface RestoreInput {
  readonly townId: string;
  readonly carryId: string;
  readonly actor: LinkActor;
  /** Why the move is allowed: derived corroboration, the owner, or a reviewer confirmation. */
  readonly basis: 'corroborated' | 'owner' | 'reviewer';
  /** Owner re-confirmation names the owner; it must equal the request's owner. */
  readonly ownerId?: string;
}

/**
 * Moves one approved link to the business's new listing identity, atomically with its audit event. Returns false
 * when nothing was moved (already restored, closed, or no longer matching). Throws when the caller is not the
 * owner on an owner confirmation or when an identity involved is fenced.
 */
export async function restoreLinkCarry(db: Db, input: RestoreInput): Promise<boolean> {
  if (!UUID.test(input.townId) || !UUID.test(input.carryId) || !['corroborated', 'owner', 'reviewer'].includes(input.basis)) throw Error('Invalid business link carry');
  if (input.basis === 'owner' && !UUID.test(input.ownerId ?? '')) throw Error('Invalid business link carry');
  return db.transaction(async (tx) => {
    const pre = await tx.query(
      `SELECT c."requestId", r."ownerId" FROM directory_business_link_carry c JOIN directory_business_link_request r ON r."requestId"=c."requestId" WHERE c.id=$1 AND r."townId"=$2`,
      [input.carryId, input.townId]
    );
    if (pre.length !== 1) throw Error('Invalid business link carry');
    await assertDirectoryIdentitiesUnfenced(tx, [pre[0].ownerId, input.actor.id, input.ownerId]);
    await lockTown(tx, input.townId);
    const carries = await tx.query('SELECT "businessId" FROM directory_business_link_carry WHERE id=$1', [input.carryId]);
    await tx.query('SELECT id FROM directory_business WHERE id=$1 AND "communityId"=$2 FOR UPDATE', [carries[0].businessId, input.townId]);
    const [carry] = await tx.query('SELECT * FROM directory_business_link_carry WHERE id=$1 FOR UPDATE', [input.carryId]);
    const [request] = await tx.query('SELECT "requestId","ownerId",status FROM directory_business_link_request WHERE "requestId"=$1 FOR UPDATE', [carry.requestId]);
    if (input.basis === 'owner' && request.ownerId !== input.ownerId) throw Error('Invalid business link carry');
    if (carry.state === 'restored') return false;
    if (carry.state !== 'awaiting_confirmation') return false;
    const close = async () => {
      await tx.query(`UPDATE directory_business_link_carry SET state='closed',"updatedAt"=now() WHERE id=$1`, [carry.id]);
      return false;
    };
    if (request.status !== 'approved') return close();
    const [business] = await tx.query('SELECT state FROM directory_business WHERE id=$1', [carry.businessId]);
    const current = await tx.query(
      `SELECT a.id, a.confidence FROM directory_business_assertion a
         JOIN directory_listing_identity li ON li."scanId"=a."scanId" AND li."sourceFileRowNumber"=a."sourceFileRowNumber" AND li."communityId"=$3
         JOIN directory_overture_private_policy p ON p."policyId"=a."policyId" AND p.revoked=false
        WHERE a."businessId"=$1 AND a.state='current' AND li.id=$2`,
      [carry.businessId, carry.toListingId, input.townId]
    );
    // The business must still be active and its one live current row must still be the proposed target.
    if (!business || business.state !== 'active' || current.length !== 1) return close();
    const confidence: string = current[0].confidence;
    if (input.basis === 'corroborated' && !['corroborated', 'confirmed'].includes(confidence)) return false;
    if (input.basis === 'reviewer' && confidence !== 'confirmed') return false;
    const active = await tx.query('SELECT "listingId" FROM directory_business_link_active WHERE "requestId"=$1 FOR UPDATE', [carry.requestId]);
    if (active.length !== 1 || active[0].listingId !== carry.fromListingId) return close();
    const occupied = await tx.query('SELECT "requestId" FROM directory_business_link_active WHERE "listingId"=$1', [carry.toListingId]);
    if (occupied.length) return close();
    if (input.basis === 'owner') {
      const [row] = await tx.query('SELECT scan."scanId",scan."sourceFileRowNumber" FROM (SELECT "scanId","sourceFileRowNumber" FROM directory_business_assertion WHERE id=$1) scan', [current[0].id]);
      await tx.query(`UPDATE directory_business_assertion SET confidence='confirmed',evidence='owner_confirmed' WHERE id=$1 AND state='current' AND confidence<>'confirmed'`, [current[0].id]);
      await tx.query(
        `INSERT INTO directory_business_event ("businessId",kind,cause,"scanId","sourceFileRowNumber") VALUES ($1,'confirmed','owner_confirmed',$2,$3) ON CONFLICT DO NOTHING`,
        [carry.businessId, row.scanId, row.sourceFileRowNumber]
      );
    }
    await tx.query('UPDATE directory_business_link_active SET "listingId"=$2 WHERE "requestId"=$1 AND "listingId"=$3', [carry.requestId, carry.toListingId, carry.fromListingId]);
    await tx.query(`UPDATE directory_business_link_carry SET state='restored',"updatedAt"=now() WHERE id=$1`, [carry.id]);
    await tx.query(
      `INSERT INTO directory_business_link_event ("requestId","actorId",action,"actorDomain") VALUES ($1,$2,$3,$4)`,
      [carry.requestId, input.actor.id, input.basis === 'owner' ? 'carry_confirm' : 'carry_restore', input.actor.domain]
    );
    return true;
  });
}

export interface ReconcileResult { readonly corroborated: number; readonly restored: number; readonly skipped: number }

/**
 * Derives `corroborated` for carried businesses that have a link waiting, then restores every waiting link whose
 * business is `corroborated` or `confirmed`. A restore by a reviewer decision passes that reviewer as the actor.
 * Fenced owners are skipped, never errors. Safe to repeat.
 */
export async function reconcileLinkCarries(db: Db, input: { townId: string; businessId?: string; actor?: LinkActor; basis?: 'corroborated' | 'reviewer' }): Promise<ReconcileResult> {
  if (!UUID.test(input.townId) || (input.businessId !== undefined && !UUID.test(input.businessId))) throw Error('Invalid business link carry');
  let corroborated = 0, restored = 0, skipped = 0;
  const waiting = await db.query(
    `SELECT c.id AS "carryId", c."businessId" FROM directory_business_link_carry c JOIN directory_business_link_request r ON r."requestId"=c."requestId"
      WHERE r."townId"=$1 AND c.state='awaiting_confirmation' AND ($2::uuid IS NULL OR c."businessId"=$2::uuid) ORDER BY c.id LIMIT 1000`,
    [input.townId, input.businessId ?? null]
  );
  if ((input.basis ?? 'corroborated') === 'corroborated') {
    for (const businessId of [...new Set(waiting.map((w: any) => w.businessId as string))].sort()) {
      const did = await db.transaction(async (tx) => {
        await lockTown(tx, input.townId);
        await tx.query('SELECT id FROM directory_business WHERE id=$1 AND "communityId"=$2 FOR UPDATE', [businessId, input.townId]);
        const [assertion] = await tx.query(
          `SELECT a.id,a."scanId",a."sourceFileRowNumber" FROM directory_business_assertion a JOIN directory_overture_private_policy p ON p."policyId"=a."policyId" AND p.revoked=false
            WHERE a."businessId"=$1 AND a.state='current' AND a.confidence='carried'`,
          [businessId]
        );
        if (!assertion || !(await corroborationHolds(tx, assertion.id))) return false;
        const changed = await tx.query(`UPDATE directory_business_assertion SET confidence='corroborated' WHERE id=$1 AND state='current' AND confidence='carried' RETURNING id`, [assertion.id]);
        if (!changed.length) return false;
        await tx.query(
          `INSERT INTO directory_business_event ("businessId",kind,cause,"scanId","sourceFileRowNumber") VALUES ($1,'corroborated','address_match',$2,$3) ON CONFLICT DO NOTHING`,
          [businessId, assertion.scanId, assertion.sourceFileRowNumber]
        );
        return true;
      });
      if (did) corroborated += 1;
    }
  }
  for (const w of waiting) {
    try {
      const moved = await restoreLinkCarry(db, { townId: input.townId, carryId: w.carryId, actor: input.actor ?? SYSTEM_ACTOR, basis: input.basis ?? 'corroborated' });
      if (moved) restored += 1;
    } catch (error) {
      if (!fenced(error)) throw error;
      skipped += 1;
    }
  }
  return { corroborated, restored, skipped };
}

/** Owner re-confirmation of their own carried link. The caller authenticates the owner. */
export async function confirmLinkCarry(db: Db, input: { townId: string; carryId: string; ownerId: string }): Promise<boolean> {
  if (![input?.townId, input?.carryId, input?.ownerId].every((x) => typeof x === 'string' && UUID.test(x))) throw Error('Invalid business link carry');
  return restoreLinkCarry(db, { townId: input.townId, carryId: input.carryId, ownerId: input.ownerId, actor: { id: input.ownerId, domain: 'account' }, basis: 'owner' });
}

/** Internal owner-scoped view of links waiting for the owner to re-confirm; authenticate the owner at the gateway. */
export async function listOwnerLinkCarries(db: Q, townId: string, ownerId: string): Promise<Array<{ carryId: string; requestId: string; businessCommunityId: string }>> {
  if (![townId, ownerId].every((x) => typeof x === 'string' && UUID.test(x))) throw Error('Invalid business link carry');
  const rows = await db.query(
    `SELECT c.id AS "carryId", c."requestId", r."businessCommunityId" FROM directory_business_link_carry c JOIN directory_business_link_request r ON r."requestId"=c."requestId"
      WHERE r."townId"=$1 AND r."ownerId"=$2 AND r.status='approved' AND c.state='awaiting_confirmation' ORDER BY c."createdAt", c.id LIMIT 101`,
    [townId, ownerId]
  );
  if (rows.length > 100) throw Error('Invalid business link carry');
  return rows;
}
