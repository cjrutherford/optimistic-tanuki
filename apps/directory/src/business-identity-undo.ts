import { assertDirectoryIdentitiesUnfenced } from './account-lifecycle-fence';
import {
  assertFreshToken,
  NOT_LATEST,
  ReviewConflictError,
  versionToken,
} from './review-version';

/**
 * Review item reads and reversible undo for business identity decisions (S7b). An item is one business. Its
 * history is every decision that names it (as subject, as the other side of a merge, or as a business a split
 * created), oldest first, with undo decisions interleaved. An undo is a new `undo` decision row (so the original
 * is never edited or deleted) plus `undone` events; the original is "undone" because an undo row names it.
 *
 * Only the latest non-undone, non-undo decision touching the businesses it affected can be undone. Nothing here
 * reverses side effects outside the identity tables:
 *  - retire/merge/split closed link carries that were awaiting an owner; those stay closed (the owner can ask again).
 *  - confirm may have restored owner links through the carry reconciler; those links stay as the owner left them.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INVALID = 'Invalid business identity decision';

export interface IdentityHistoryEntry {
  readonly decisionId: string;
  readonly action: string;
  readonly businessId: string;
  readonly otherBusinessId: string | null;
  readonly actorId: string | null;
  readonly actorDomain: string | null;
  readonly reason: string;
  readonly createdAt: string;
  readonly undoOf: string | null;
  readonly undoneBy: string | null;
  readonly reversible: boolean;
}

export interface IdentityReviewItem {
  readonly businessId: string;
  readonly state: string;
  readonly successorId: string | null;
  readonly stateCause: string | null;
  readonly versionToken: string;
  readonly assertions: ReadonlyArray<{
    scanId: string;
    sourceFileRowNumber: string;
    state: string;
    confidence: string;
    evidence: string;
  }>;
  readonly history: readonly IdentityHistoryEntry[];
}

const TOUCHING = (businessIds: string) =>
  `(d."businessId"=ANY(${businessIds}::uuid[]) OR d."otherBusinessId"=ANY(${businessIds}::uuid[])
    OR d.id IN (SELECT e."decisionId" FROM directory_business_event e WHERE e."businessId"=ANY(${businessIds}::uuid[]) AND e."decisionId" IS NOT NULL))`;

/** Tokens for businesses of one town; a business that is not in the town has no token. */
export async function identityVersionTokens(
  q: Q,
  townId: string,
  businessIds: readonly string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(businessIds)].filter((id) => UUID.test(id));
  if (!ids.length) return out;
  const rows = await q.query(
    `SELECT b.id,b.state,b."successorId",b."stateCause",b."retiredAt"::text AS "retiredAt",
       (SELECT d.id FROM directory_business_identity_decision d WHERE ${TOUCHING(
         'ARRAY[b.id]'
       )} ORDER BY d."createdAt" DESC, d.id DESC LIMIT 1) AS latest,
       (SELECT count(*)::int FROM directory_business_identity_decision d WHERE ${TOUCHING(
         'ARRAY[b.id]'
       )}) AS decisions,
       (SELECT coalesce(string_agg(a.id::text||':'||a.state||':'||a.confidence||':'||a.evidence,',' ORDER BY a.id),'') FROM directory_business_assertion a WHERE a."businessId"=b.id) AS assertions
     FROM directory_business b WHERE b.id=ANY($1::uuid[]) AND b."communityId"=$2`,
    [ids, townId]
  );
  for (const r of rows)
    out.set(
      r.id,
      versionToken([
        'identity',
        r.id,
        r.state,
        r.successorId,
        r.stateCause,
        r.retiredAt,
        r.latest,
        r.decisions,
        r.assertions,
      ])
    );
  return out;
}

export async function getBusinessIdentityReviewItem(
  q: Q,
  townId: string,
  businessId: string
): Promise<IdentityReviewItem | null> {
  if (!UUID.test(townId) || !UUID.test(businessId)) return null;
  const [business] = await q.query(
    'SELECT id,state,"successorId","stateCause" FROM directory_business WHERE id=$1 AND "communityId"=$2',
    [businessId, townId]
  );
  if (!business) return null;
  const token = (await identityVersionTokens(q, townId, [businessId])).get(
    businessId
  ) as string;
  const assertions = await q.query(
    `SELECT "scanId","sourceFileRowNumber"::text AS "sourceFileRowNumber",state,confidence,evidence FROM directory_business_assertion WHERE "businessId"=$1 ORDER BY "scanId","sourceFileRowNumber" LIMIT 200`,
    [businessId]
  );
  const decisions = await q.query(
    `SELECT d.id,d.action,d."businessId",d."otherBusinessId",d."actorId",d."actorDomain",d.reason,d."createdAt"::text AS "createdAt",d."undoOf",
        (SELECT u.id FROM directory_business_identity_decision u WHERE u."undoOf"=d.id) AS "undoneBy"
       FROM directory_business_identity_decision d WHERE ${TOUCHING(
         '$1::uuid[]'
       )} ORDER BY d."createdAt", d.id`,
    [[businessId]]
  );
  let latest: string | null = null;
  for (const d of decisions)
    if (d.action !== 'undo' && !d.undoneBy) latest = d.id;
  return {
    businessId: business.id,
    state: business.state,
    successorId: business.successorId,
    stateCause: business.stateCause,
    versionToken: token,
    assertions,
    history: decisions.map((d: any) => ({
      decisionId: d.id,
      action: d.action,
      businessId: d.businessId,
      otherBusinessId: d.otherBusinessId,
      actorId: d.actorId,
      actorDomain: d.actorDomain,
      reason: d.reason,
      createdAt: d.createdAt,
      undoOf: d.undoOf,
      undoneBy: d.undoneBy,
      reversible: d.id === latest,
    })),
  };
}

export interface UndoInput {
  readonly decisionId: string;
  readonly townId: string;
  readonly businessId: string;
  readonly undoOf: string;
  readonly expectedVersionToken: string;
  readonly actor: {
    readonly id: string | null;
    readonly domain: 'account' | 'profile' | 'system';
  };
  readonly reason: string;
}
export interface UndoResult {
  readonly replayed: boolean;
  readonly businessIds: readonly string[];
}

export async function undoBusinessIdentityDecision(
  db: Db,
  input: UndoInput
): Promise<UndoResult> {
  const ok =
    input &&
    UUID.test(input.decisionId ?? '') &&
    UUID.test(input.townId ?? '') &&
    UUID.test(input.businessId ?? '') &&
    UUID.test(input.undoOf ?? '') &&
    typeof input.reason === 'string' &&
    input.reason.trim().length > 0 &&
    input.reason.length <= 1024 &&
    input.actor &&
    ['account', 'profile', 'system'].includes(input.actor.domain) &&
    (input.actor.id === null
      ? input.actor.domain === 'system'
      : UUID.test(input.actor.id));
  if (!ok) throw Error(INVALID);
  return db.transaction(async (tx) => {
    await assertDirectoryIdentitiesUnfenced(tx, [input.actor.id]);
    await tx.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',
      [`directory-business-identity:${input.townId}`]
    );
    const [target] = await tx.query(
      'SELECT * FROM directory_business_identity_decision WHERE id=$1 AND "communityId"=$2',
      [input.undoOf, input.townId]
    );
    if (!target || target.action === 'undo') throw Error(INVALID);
    const created = await tx.query(
      `SELECT "businessId" FROM directory_business_event WHERE "decisionId"=$1 AND kind='created'`,
      [target.id]
    );
    const affected = [
      ...new Set<string>([
        target.businessId,
        ...(target.otherBusinessId ? [target.otherBusinessId] : []),
        ...created.map((c: any) => c.businessId),
        input.businessId,
      ]),
    ].sort();
    const locked = await tx.query(
      'SELECT id,state,"successorId","stateCause" FROM directory_business WHERE id=ANY($1::uuid[]) AND "communityId"=$2 ORDER BY id FOR UPDATE',
      [affected, input.townId]
    );
    if (locked.length !== affected.length) throw Error(INVALID);
    const byId = new Map<string, any>(locked.map((b: any) => [b.id, b]));
    const [prior] = await tx.query(
      'SELECT * FROM directory_business_identity_decision WHERE id=$1',
      [input.decisionId]
    );
    if (prior) {
      if (
        prior.communityId !== input.townId ||
        prior.action !== 'undo' ||
        prior.undoOf !== input.undoOf ||
        (prior.actorId ?? null) !== input.actor.id ||
        prior.reason !== input.reason
      )
        throw Error(INVALID);
      return { replayed: true, businessIds: affected };
    }
    const current = (
      await identityVersionTokens(tx, input.townId, [input.businessId])
    ).get(input.businessId) as string;
    assertFreshToken(input.expectedVersionToken, current);
    // Latest non-undone decision among everything this decision touched.
    const [latest] = await tx.query(
      `SELECT d.id FROM directory_business_identity_decision d
        WHERE ${TOUCHING('$1::uuid[]')} AND d.action<>'undo'
          AND NOT EXISTS (SELECT 1 FROM directory_business_identity_decision u WHERE u."undoOf"=d.id)
        ORDER BY d."createdAt" DESC, d.id DESC LIMIT 1`,
      [affected]
    );
    if (!latest || latest.id !== target.id)
      throw new ReviewConflictError(NOT_LATEST);
    const notLatest = () => new ReviewConflictError(NOT_LATEST);
    const snapshot: any[] = Array.isArray(target.snapshot)
      ? target.snapshot
      : [];
    const touched = new Set<string>([target.businessId]);
    const reactivate = (id: string) =>
      tx.query(
        `UPDATE directory_business SET state='active',"successorId"=NULL,"stateCause"=NULL,"retiredAt"=NULL WHERE id=$1`,
        [id]
      );
    if (target.action === 'confirm') {
      if (byId.get(target.businessId)?.state !== 'active') throw notLatest();
      for (const s of snapshot)
        await tx.query(
          `UPDATE directory_business_assertion SET confidence=$2,evidence=$3 WHERE id=$1 AND "businessId"=$4 AND confidence='confirmed' AND evidence='reviewer_confirmed'`,
          [s.id, s.confidence, s.evidence, target.businessId]
        );
    } else if (target.action === 'retire') {
      const b = byId.get(target.businessId);
      if (b?.state !== 'retired' || b.stateCause !== 'reviewer_retired')
        throw notLatest();
      await reactivate(target.businessId);
    } else if (target.action === 'merge') {
      const survivor = byId.get(target.businessId);
      const other = byId.get(target.otherBusinessId);
      if (
        survivor?.state !== 'active' ||
        other?.state !== 'merged' ||
        other.successorId !== target.businessId
      )
        throw notLatest();
      await reactivate(target.otherBusinessId);
      touched.add(target.otherBusinessId);
    } else {
      const original = byId.get(target.businessId);
      if (original?.state !== 'split' || !snapshot.length) throw notLatest();
      for (const s of snapshot) {
        if (byId.get(s.businessId)?.state !== 'active') throw notLatest();
        const [held] = await tx.query(
          'SELECT 1 FROM directory_business_assertion WHERE id=$1 AND "businessId"=$2 FOR UPDATE',
          [s.id, s.businessId]
        );
        if (!held) throw notLatest();
      }
      for (const s of snapshot) {
        await tx.query(
          `UPDATE directory_business_assertion SET "businessId"=$2,confidence=$3,evidence=$4 WHERE id=$1`,
          [s.id, target.businessId, s.confidence, s.evidence]
        );
        await tx.query(
          `UPDATE directory_business SET state='retired',"stateCause"='reviewer_undo_split',"retiredAt"=now() WHERE id=$1`,
          [s.businessId]
        );
        touched.add(s.businessId);
      }
      await reactivate(target.businessId);
    }
    await tx.query(
      `INSERT INTO directory_business_identity_decision (id,"communityId",action,"businessId","otherBusinessId","actorId","actorDomain",reason,"undoOf","createdAt") VALUES ($1,$2,'undo',$3,$4,$5,$6,$7,$8,clock_timestamp())`,
      [
        input.decisionId,
        input.townId,
        target.businessId,
        target.otherBusinessId,
        input.actor.id,
        input.actor.id ? input.actor.domain : null,
        input.reason,
        target.id,
      ]
    );
    for (const id of touched)
      await tx.query(
        `INSERT INTO directory_business_event ("businessId",kind,cause,"otherBusinessId","decisionId") VALUES ($1,'undone',$2,$3,$4)`,
        [
          id,
          `undo_${target.action}`,
          id === target.businessId ? target.otherBusinessId : target.businessId,
          input.decisionId,
        ]
      );
    return { replayed: false, businessIds: [...touched] };
  });
}
