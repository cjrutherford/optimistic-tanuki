import { randomUUID } from 'node:crypto';
import { assertDirectoryIdentitiesUnfenced } from './account-lifecycle-fence';
import { findListingIdentity } from './listing-identity';
import { resolveBusinessId } from './business-identity-read';
import { unprojectBinding } from './reviewed-spatial';

/**
 * Reviewer-only suppression of one listing (S5 criterion 12). A suppression adds one `directory_listing_suppression`
 * row that every public read excludes (see `notSuppressedSql`); it never writes the source provenance tables
 * (private row, scan, completion, revocation) and never copies a corrected value anywhere. A correction is
 * `incorrect-details`: suppress, and suspend the reviewed binding so the candidate goes back to review.
 *
 *  - Idempotent: `suppressionId` is the primary key. Replaying identical input returns the same result; the same
 *    id with different input is a conflict.
 *  - Reversible and append-only: a lift stamps the same row (reason, actor, time); a later suppression is a new row.
 *  - Lock order: actor fence -> town advisory lock -> (incorrect-details) candidate -> binding -> writes.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const SUPPRESSION_REASONS = [
  'rights-request',
  'incorrect-details',
  'closed-business',
  'safety',
  'duplicate',
  'other',
] as const;
export const LIFT_REASONS = [
  'resolved',
  'mistaken-suppression',
  'other',
] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];
export type LiftReason = (typeof LIFT_REASONS)[number];
export const SUPPRESSION_CONFLICT = 'Invalid listing suppression';
export const SUPPRESSION_NOT_FOUND = 'Listing unavailable';
export const CORRECTION_SUSPEND_CAUSE = 'listing_correction';

export interface SuppressionInput {
  readonly suppressionId: string;
  readonly townId: string;
  readonly listingId: string;
  readonly reasonCode: SuppressionReason;
  readonly note?: string;
  readonly actorId: string;
}
export interface LiftInput {
  readonly suppressionId: string;
  readonly townId: string;
  readonly reasonCode: LiftReason;
  readonly actorId: string;
}
export interface SuppressionResult {
  readonly replayed: boolean;
  readonly suppressionId: string;
  readonly reasonCode: SuppressionReason;
  /** Reviewed bindings sent back to re-review by this call (incorrect-details only). */
  readonly sentToReview: number;
}
export interface LiftResult {
  readonly replayed: boolean;
  readonly suppressionId: string;
  readonly liftReasonCode: LiftReason;
}
export interface SuppressionRecord {
  readonly suppressionId: string;
  readonly listingId: string;
  readonly listingName: string | null;
  readonly reasonCode: SuppressionReason;
  readonly note: string | null;
  readonly actorId: string | null;
  readonly createdAt: string;
  readonly liftedAt: string | null;
  readonly liftReasonCode: LiftReason | null;
  readonly liftedById: string | null;
}

const lockTown = (tx: Q, town: string) =>
  tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))', [
    `directory-listing-suppression:${town}`,
  ]);

function validateSuppress(input: SuppressionInput): void {
  const ok =
    input &&
    UUID.test(input.suppressionId ?? '') &&
    UUID.test(input.townId ?? '') &&
    UUID.test(input.listingId ?? '') &&
    UUID.test(input.actorId ?? '') &&
    (SUPPRESSION_REASONS as readonly string[]).includes(input.reasonCode) &&
    (input.note === undefined ||
      (typeof input.note === 'string' &&
        input.note.trim().length > 0 &&
        input.note.length <= 1024));
  if (!ok) throw Error(SUPPRESSION_CONFLICT);
}
function validateLift(input: LiftInput): void {
  const ok =
    input &&
    UUID.test(input.suppressionId ?? '') &&
    UUID.test(input.townId ?? '') &&
    UUID.test(input.actorId ?? '') &&
    (LIFT_REASONS as readonly string[]).includes(input.reasonCode);
  if (!ok) throw Error(SUPPRESSION_CONFLICT);
}

/** The exact source row a public listing id names, the same way public detail resolves it. */
async function resolveRow(
  tx: Q,
  town: string,
  listingId: string
): Promise<{ scanId: string; row: string; businessId: string | null }> {
  let position: { scanId: string; row: string } | null = null;
  const business = await resolveBusinessId(tx, town, listingId);
  if (business.kind === 'row') position = business.position;
  else if (business.kind === 'none')
    position = await findListingIdentity(tx, town, listingId);
  if (!position) throw Error(SUPPRESSION_NOT_FOUND);
  const exists = await tx.query(
    'SELECT 1 FROM directory_overture_private_row WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "regionId"=$3',
    [position.scanId, position.row, town]
  );
  if (exists.length !== 1) throw Error(SUPPRESSION_NOT_FOUND);
  const owner = await tx.query(
    `SELECT a."businessId" FROM directory_business_assertion a
       JOIN directory_business b ON b.id=a."businessId" AND b."communityId"=$3 AND b.state='active'
      WHERE a."scanId"=$1 AND a."sourceFileRowNumber"=$2 AND a."communityId"=$3 AND a.state='current'`,
    [position.scanId, position.row, town]
  );
  return {
    ...position,
    businessId: owner.length === 1 ? owner[0].businessId : null,
  };
}

/** Sends the row's reviewed binding back to re-review. Copies no value; the binding's own hashes stay as they were. */
async function sendToReview(
  tx: Q,
  town: string,
  scanId: string,
  row: string
): Promise<number> {
  const bindings = await tx.query(
    `SELECT id,"candidateId" FROM directory_reviewed_binding
      WHERE "communityId"=$1 AND "scanId"=$2 AND "sourceFileRowNumber"=$3 AND state IN ('pending','active')
      ORDER BY id`,
    [town, scanId, row]
  );
  let sent = 0;
  for (const b of bindings) {
    await tx.query(
      'SELECT 1 FROM directory_address_review_candidate WHERE id=$1 FOR UPDATE',
      [b.candidateId]
    );
    const changed = await tx.query(
      `WITH t AS (UPDATE directory_reviewed_binding SET state='suspended',"stateCause"=$2,"suspendedAt"=CURRENT_TIMESTAMP
         WHERE id=$1 AND state IN ('pending','active') RETURNING id) SELECT id FROM t`,
      [b.id, CORRECTION_SUSPEND_CAUSE]
    );
    if (changed.length !== 1) continue;
    await unprojectBinding(tx as never, b.id);
    await tx.query(
      `INSERT INTO directory_reviewed_binding_event ("bindingId",kind,cause) VALUES ($1,'suspended',$2) ON CONFLICT DO NOTHING`,
      [b.id, CORRECTION_SUSPEND_CAUSE]
    );
    await tx.query(
      `UPDATE directory_address_review_candidate SET status='needs_human',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND status IN ('published','approved','auto_approved')`,
      [b.candidateId]
    );
    sent += 1;
  }
  return sent;
}

export async function suppressListing(
  db: Db,
  input: SuppressionInput
): Promise<SuppressionResult> {
  validateSuppress(input);
  return db.transaction(async (tx) => {
    await assertDirectoryIdentitiesUnfenced(tx, [input.actorId]);
    await lockTown(tx, input.townId);
    const prior = await tx.query(
      'SELECT * FROM directory_listing_suppression WHERE id=$1',
      [input.suppressionId]
    );
    if (prior.length) {
      const p = prior[0];
      if (
        p.communityId !== input.townId ||
        p.listingId !== input.listingId ||
        p.reasonCode !== input.reasonCode ||
        (p.note ?? null) !== (input.note ?? null) ||
        (p.actorId ?? null) !== input.actorId
      )
        throw Error(SUPPRESSION_CONFLICT);
      return {
        replayed: true,
        suppressionId: p.id,
        reasonCode: p.reasonCode,
        sentToReview: 0,
      };
    }
    const target = await resolveRow(tx, input.townId, input.listingId);
    const open = await tx.query(
      'SELECT 1 FROM directory_listing_suppression WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "liftedAt" IS NULL',
      [target.scanId, target.row]
    );
    if (open.length) throw Error(SUPPRESSION_CONFLICT);
    await tx.query(
      `INSERT INTO directory_listing_suppression (id,"communityId","listingId","scanId","sourceFileRowNumber","businessId","reasonCode",note,"actorId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        input.suppressionId,
        input.townId,
        input.listingId,
        target.scanId,
        target.row,
        target.businessId,
        input.reasonCode,
        input.note ?? null,
        input.actorId,
      ]
    );
    const sentToReview =
      input.reasonCode === 'incorrect-details'
        ? await sendToReview(tx, input.townId, target.scanId, target.row)
        : 0;
    return {
      replayed: false,
      suppressionId: input.suppressionId,
      reasonCode: input.reasonCode,
      sentToReview,
    };
  });
}

/** Marks a suppression a report opened by itself (owner decision D17); a decline of that report lifts exactly these. */
export const PROVISIONAL_NOTE_PREFIX = 'D17 provisional hide: report ';

/**
 * Owner decision D17: a safety or privacy report hides its listing at once, until a reviewer decides. This reuses the
 * ordinary suppression row (so every public read, the map and the export already exclude it) with no actor, and runs
 * inside the caller's transaction. Returns the suppression id, or null when the listing cannot be resolved or is
 * already suppressed (nothing more to hide).
 */
export async function provisionallyHideListing(
  tx: Q,
  input: {
    townId: string;
    listingId: string;
    reasonCode: SuppressionReason;
    reportId: string;
  }
): Promise<string | null> {
  if (
    !UUID.test(input?.townId ?? '') ||
    !UUID.test(input.listingId ?? '') ||
    !UUID.test(input.reportId ?? '') ||
    !(SUPPRESSION_REASONS as readonly string[]).includes(input.reasonCode)
  )
    throw Error(SUPPRESSION_CONFLICT);
  await lockTown(tx, input.townId);
  let target: Awaited<ReturnType<typeof resolveRow>>;
  try {
    target = await resolveRow(tx, input.townId, input.listingId);
  } catch (error) {
    if (error instanceof Error && error.message === SUPPRESSION_NOT_FOUND)
      return null;
    throw error;
  }
  const open = await tx.query(
    'SELECT 1 FROM directory_listing_suppression WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "liftedAt" IS NULL',
    [target.scanId, target.row]
  );
  if (open.length) return null;
  const id = randomUUID();
  await tx.query(
    `INSERT INTO directory_listing_suppression (id,"communityId","listingId","scanId","sourceFileRowNumber","businessId","reasonCode",note,"actorId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL)`,
    [
      id,
      input.townId,
      input.listingId,
      target.scanId,
      target.row,
      target.businessId,
      input.reasonCode,
      `${PROVISIONAL_NOTE_PREFIX}${input.reportId}`,
    ]
  );
  return id;
}

export async function liftSuppression(
  db: Db,
  input: LiftInput
): Promise<LiftResult> {
  validateLift(input);
  return db.transaction(async (tx) => {
    await assertDirectoryIdentitiesUnfenced(tx, [input.actorId]);
    await lockTown(tx, input.townId);
    const found = await tx.query(
      'SELECT * FROM directory_listing_suppression WHERE id=$1 AND "communityId"=$2 FOR UPDATE',
      [input.suppressionId, input.townId]
    );
    if (found.length !== 1) throw Error(SUPPRESSION_NOT_FOUND);
    const p = found[0];
    if (p.liftedAt) {
      if (
        p.liftReasonCode !== input.reasonCode ||
        (p.liftedById ?? null) !== input.actorId
      )
        throw Error(SUPPRESSION_CONFLICT);
      return {
        replayed: true,
        suppressionId: p.id,
        liftReasonCode: p.liftReasonCode,
      };
    }
    await tx.query(
      `UPDATE directory_listing_suppression SET "liftedAt"=CURRENT_TIMESTAMP,"liftReasonCode"=$2,"liftedById"=$3 WHERE id=$1 AND "liftedAt" IS NULL`,
      [input.suppressionId, input.reasonCode, input.actorId]
    );
    return {
      replayed: false,
      suppressionId: p.id,
      liftReasonCode: input.reasonCode,
    };
  });
}

const LIST_LIMIT = 200;

/** Reviewer-only: current (un-lifted) suppressions first, then recent lifts, with the listing name read live. */
export async function listSuppressions(
  q: Q,
  town: string
): Promise<{ suppressions: SuppressionRecord[] }> {
  if (!UUID.test(town)) throw Error(SUPPRESSION_CONFLICT);
  const rows = await q.query(
    `SELECT s.id,s."listingId",s."reasonCode",s.note,s."actorId",s."createdAt",s."liftedAt",s."liftReasonCode",s."liftedById",
            (SELECT r.listing->>'name' FROM directory_overture_private_row r WHERE r."scanId"=s."scanId" AND r."sourceFileRowNumber"=s."sourceFileRowNumber" AND r."regionId"=s."communityId"::text) AS name
       FROM directory_listing_suppression s
      WHERE s."communityId"=$1
      ORDER BY (s."liftedAt" IS NULL) DESC, s."createdAt" DESC, s.id
      LIMIT ${LIST_LIMIT}`,
    [town]
  );
  const iso = (d: unknown) =>
    d === null || d === undefined ? null : new Date(d as string).toISOString();
  return {
    suppressions: rows.map((r) => ({
      suppressionId: r.id,
      listingId: r.listingId,
      listingName: typeof r.name === 'string' ? r.name : null,
      reasonCode: r.reasonCode,
      note: r.note ?? null,
      actorId: r.actorId ?? null,
      createdAt: iso(r.createdAt) as string,
      liftedAt: iso(r.liftedAt),
      liftReasonCode: r.liftReasonCode ?? null,
      liftedById: r.liftedById ?? null,
    })),
  };
}
