import {
  ACCOUNT_DELETION_FENCED,
  assertDirectoryIdentitiesUnfenced,
} from './account-lifecycle-fence';
import { reconcileLinkCarries } from './business-link-carry';
import { identityVersionTokens } from './business-identity-undo';
import { assertFreshToken } from './review-version';

/**
 * Reviewer/operator identity decisions (S5-item1-business-identity-design.md, 2.5): confirm, retire, merge and
 * split, each with a `directory_business_identity_decision` row and events in `directory_business_event`.
 * These are the only paths that decide what the carry never decides on its own: a row that is not carried
 * by key, a business that must be joined to another, or one that must be pulled apart.
 *
 *  - Idempotent: `decisionId` is the decision's primary key. Replaying identical input is a no-op; the same id
 *    with different input throws.
 *  - Compare-and-set: every action requires the business (and for merge, the other) to be `active` under row locks.
 *  - Lock order: actor fence -> town advisory lock (same key as the carry and the link) -> business rows FOR
 *    UPDATE in id order -> writes. No candidate, binding, scan lock or listing row is ever locked.
 *  - Never automatic: merge and split are refused while an owner link is attached to either business; the link must
 *    be revoked or restored first, so a decision cannot silently move an owner's claim.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INVALID = 'Invalid business identity decision';
const ACTIONS = ['confirm', 'retire', 'merge', 'split'] as const;
export type DecisionAction = (typeof ACTIONS)[number];
export interface DecisionActor {
  readonly id: string | null;
  readonly domain: 'account' | 'profile' | 'system';
}
export interface DecisionRow {
  readonly scanId: string;
  readonly sourceFileRowNumber: string;
}
export interface DecisionInput {
  readonly decisionId: string;
  readonly townId: string;
  readonly action: DecisionAction;
  readonly businessId: string;
  readonly otherBusinessId?: string;
  /** split: the rows to pull out, one new business each. */
  readonly rows?: readonly DecisionRow[];
  readonly actor: DecisionActor;
  readonly reason: string;
  /** The item's version token as the reviewer saw it; a mismatch under the locks is a `stale_decision`. */
  readonly expectedVersionToken: string;
}
export interface DecisionResult {
  readonly replayed: boolean;
  readonly businessIds: readonly string[];
  readonly restoredLinks: number;
}

const lockTown = (tx: Q, town: string) =>
  tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))', [
    `directory-business-identity:${town}`,
  ]);

function validate(input: DecisionInput): void {
  const ok =
    input &&
    ACTIONS.includes(input.action) &&
    UUID.test(input.decisionId ?? '') &&
    UUID.test(input.townId ?? '') &&
    UUID.test(input.businessId ?? '') &&
    typeof input.reason === 'string' &&
    input.reason.trim().length > 0 &&
    input.reason.length <= 1024 &&
    input.actor &&
    ['account', 'profile', 'system'].includes(input.actor.domain) &&
    (input.actor.id === null
      ? input.actor.domain === 'system'
      : UUID.test(input.actor.id));
  if (!ok) throw Error(INVALID);
  if (
    input.action === 'merge' &&
    (!UUID.test(input.otherBusinessId ?? '') ||
      input.otherBusinessId === input.businessId)
  )
    throw Error(INVALID);
  if (input.action === 'split') {
    const rows = input.rows ?? [];
    const seen = new Set(
      rows.map((r) => `${r.scanId}:${r.sourceFileRowNumber}`)
    );
    if (
      !rows.length ||
      rows.length > 100 ||
      seen.size !== rows.length ||
      rows.some(
        (r) =>
          (!/^[0-9a-f]{64}$/.test(r.scanId) &&
            !/^[\w.-]{1,64}$/.test(r.scanId)) ||
          !/^[0-9]{1,18}$/.test(String(r.sourceFileRowNumber))
      )
    )
      throw Error(INVALID);
  } else if (input.otherBusinessId !== undefined && input.action !== 'merge')
    throw Error(INVALID);
}

async function liveLink(tx: Q, businessId: string): Promise<boolean> {
  const rows = await tx.query(
    `SELECT 1 FROM directory_business_link_active a
       JOIN directory_listing_identity li ON li.id=a."listingId"
       JOIN directory_business_assertion x ON x."scanId"=li."scanId" AND x."sourceFileRowNumber"=li."sourceFileRowNumber" AND x."businessId"=$1
      LIMIT 1`,
    [businessId]
  );
  return rows.length > 0;
}

export async function decideBusinessIdentity(
  db: Db,
  input: DecisionInput
): Promise<DecisionResult> {
  validate(input);
  let result: DecisionResult;
  try {
    result = await db.transaction(async (tx) => {
      await assertDirectoryIdentitiesUnfenced(tx, [input.actor.id]);
      await lockTown(tx, input.townId);
      const ids = [
        input.businessId,
        ...(input.action === 'merge' ? [input.otherBusinessId as string] : []),
      ].sort();
      const locked = await tx.query(
        'SELECT id,state FROM directory_business WHERE id = ANY($1::uuid[]) AND "communityId"=$2 ORDER BY id FOR UPDATE',
        [ids, input.townId]
      );
      if (locked.length !== ids.length) throw Error(INVALID);
      const prior = await tx.query(
        'SELECT * FROM directory_business_identity_decision WHERE id=$1',
        [input.decisionId]
      );
      if (prior.length) {
        const p = prior[0];
        if (
          p.communityId !== input.townId ||
          p.action !== input.action ||
          p.businessId !== input.businessId ||
          (p.otherBusinessId ?? null) !== (input.otherBusinessId ?? null) ||
          (p.actorId ?? null) !== input.actor.id ||
          p.reason !== input.reason
        )
          throw Error(INVALID);
        return { replayed: true, businessIds: ids, restoredLinks: 0 };
      }
      const current = (
        await identityVersionTokens(tx, input.townId, [input.businessId])
      ).get(input.businessId);
      assertFreshToken(input.expectedVersionToken, current as string);
      if (locked.some((b: any) => b.state !== 'active')) throw Error(INVALID);
      let snapshot: unknown = null;
      await tx.query(
        `INSERT INTO directory_business_identity_decision (id,"communityId",action,"businessId","otherBusinessId","actorId","actorDomain",reason,"createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())`,
        [
          input.decisionId,
          input.townId,
          input.action,
          input.businessId,
          input.otherBusinessId ?? null,
          input.actor.id,
          input.actor.id ? input.actor.domain : null,
          input.reason,
        ]
      );
      const event = (
        businessId: string,
        kind: string,
        cause: string,
        row?: { scanId: string; sourceFileRowNumber: string },
        other?: string
      ) =>
        tx.query(
          `INSERT INTO directory_business_event ("businessId",kind,cause,"scanId","sourceFileRowNumber","otherBusinessId","decisionId") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [
            businessId,
            kind,
            cause,
            row?.scanId ?? null,
            row?.sourceFileRowNumber ?? null,
            other ?? null,
            input.decisionId,
          ]
        );
      const closeCarries = (businessId: string) =>
        tx.query(
          `UPDATE directory_business_link_carry SET state='closed',"updatedAt"=now() WHERE "businessId"=$1 AND state='awaiting_confirmation'`,
          [businessId]
        );
      const touched: string[] = [input.businessId];

      if (input.action === 'confirm') {
        const rows = await tx.query(
          `SELECT a.id,a."scanId",a."sourceFileRowNumber",a.confidence,a.evidence FROM directory_business_assertion a JOIN directory_overture_private_policy p ON p."policyId"=a."policyId" AND p.revoked=false
            WHERE a."businessId"=$1 AND a.state='current' ORDER BY a.id`,
          [input.businessId]
        );
        if (!rows.length) throw Error(INVALID);
        snapshot = rows.map((r: any) => ({
          id: r.id,
          confidence: r.confidence,
          evidence: r.evidence,
        }));
        for (const row of rows) {
          await tx.query(
            `UPDATE directory_business_assertion SET confidence='confirmed',evidence='reviewer_confirmed' WHERE id=$1`,
            [row.id]
          );
          await event(input.businessId, 'confirmed', 'reviewer_confirmed', row);
        }
      } else if (input.action === 'retire') {
        await tx.query(
          `UPDATE directory_business SET state='retired',"stateCause"='reviewer_retired',"retiredAt"=now() WHERE id=$1`,
          [input.businessId]
        );
        await closeCarries(input.businessId);
        await event(input.businessId, 'retired', 'reviewer_retired');
      } else if (input.action === 'merge') {
        const other = input.otherBusinessId as string;
        if (
          (await liveLink(tx, input.businessId)) &&
          (await liveLink(tx, other))
        )
          throw Error(INVALID);
        if (await liveLink(tx, other)) throw Error(INVALID);
        await tx.query(
          `UPDATE directory_business SET state='merged',"successorId"=$2,"stateCause"='reviewer_merged',"retiredAt"=now() WHERE id=$1`,
          [other, input.businessId]
        );
        await closeCarries(other);
        await event(
          other,
          'merged',
          'reviewer_merged',
          undefined,
          input.businessId
        );
        await event(
          input.businessId,
          'merged',
          'reviewer_merged',
          undefined,
          other
        );
        touched.push(other);
      } else {
        if (await liveLink(tx, input.businessId)) throw Error(INVALID);
        const named = input.rows as readonly DecisionRow[];
        const current = await tx.query(
          `SELECT "scanId","sourceFileRowNumber" FROM directory_business_assertion WHERE "businessId"=$1 AND state='current'`,
          [input.businessId]
        );
        const key = (r: {
          scanId: string;
          sourceFileRowNumber: string | number;
        }) => `${r.scanId}:${r.sourceFileRowNumber}`;
        const namedKeys = new Set(named.map(key));
        // Every current assertion must leave, or the split original would still be asserted by a live row.
        if (current.some((c: any) => !namedKeys.has(key(c))))
          throw Error(INVALID);
        let primary: string | null = null;
        const moved: unknown[] = [];
        snapshot = moved;
        for (const row of [...named].sort((a, b) =>
          key(a).localeCompare(key(b))
        )) {
          const owned = await tx.query(
            `SELECT id,"policyId",confidence,evidence FROM directory_business_assertion WHERE "businessId"=$1 AND "scanId"=$2 AND "sourceFileRowNumber"=$3 AND state IN ('current','superseded') FOR UPDATE`,
            [input.businessId, row.scanId, row.sourceFileRowNumber]
          );
          if (owned.length !== 1) throw Error(INVALID);
          const [fresh] = await tx.query(
            `INSERT INTO directory_business ("communityId") VALUES ($1) RETURNING id`,
            [input.townId]
          );
          await tx.query(
            `UPDATE directory_business_assertion SET "businessId"=$2,confidence='confirmed',evidence='reviewer_confirmed' WHERE id=$1`,
            [owned[0].id, fresh.id]
          );
          moved.push({
            id: owned[0].id,
            businessId: fresh.id,
            confidence: owned[0].confidence,
            evidence: owned[0].evidence,
          });
          await event(
            fresh.id,
            'created',
            'reviewer_split',
            row,
            input.businessId
          );
          await event(
            input.businessId,
            'split',
            'reviewer_split',
            row,
            fresh.id
          );
          primary = primary ?? fresh.id;
          touched.push(fresh.id);
        }
        await tx.query(
          `UPDATE directory_business SET state='split',"successorId"=$2,"stateCause"='reviewer_split',"retiredAt"=now() WHERE id=$1`,
          [input.businessId, primary]
        );
        await closeCarries(input.businessId);
      }
      if (snapshot)
        await tx.query(
          'UPDATE directory_business_identity_decision SET snapshot=$2::jsonb WHERE id=$1',
          [input.decisionId, JSON.stringify(snapshot)]
        );
      return { replayed: false, businessIds: touched, restoredLinks: 0 };
    });
  } catch (error) {
    if (error instanceof Error && error.message === ACCOUNT_DELETION_FENCED)
      throw error;
    throw error;
  }
  if (input.action === 'confirm' && !result.replayed) {
    // A confirmed business releases the links waiting on it; a fenced owner is skipped.
    const moved = await reconcileLinkCarries(db, {
      townId: input.townId,
      businessId: input.businessId,
      actor: input.actor,
      basis: 'reviewer',
    });
    return { ...result, restoredLinks: moved.restored };
  }
  return result;
}
