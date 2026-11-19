import { assertDirectoryIdentitiesUnfenced } from './account-lifecycle-fence';
import { distanceMeters, normalizeName } from './alltheplaces';
import { getOrCreateListingIdentities } from './listing-identity';
import { SERVED_ROW_FROM, servedRowWhere } from './town-coverage';

/**
 * Owner decision D13 (2026-11-18): when two listings are an uncertain duplicate (not a certain match, not certainly
 * distinct), hide the weaker listing and queue the pair for review. A reviewer can restore it.
 *
 * Hiding reuses the reviewer suppression (`directory_listing_suppression`, reason `duplicate`), so every public read
 * and the public export already exclude the row and source provenance is never touched. The pair is a
 * `directory_duplicate_case`; every change to it writes a `directory_duplicate_case_event`.
 *
 *  - keep separate: lifts the suppression (the listing returns) and records the pair as `kept_separate`, so the
 *    pass never queues that pair again.
 *  - merge: the weaker listing stays hidden and the case is `merged`.
 *  - undo: puts a decided case back to `queued` and hides the weaker listing again.
 *  - Lifting the suppression through the ordinary suppression route is also a keep-separate; the next pass records it.
 *
 * Classification (pure, no database):
 *  - certain distinct: more than 500 m apart, or names that share no meaningful tokens;
 *  - certain match: the same normalised name within 150 m (the radius the AllThePlaces dedupe already uses). The
 *    acquisition dedupe handles these; this pass leaves them alone;
 *  - uncertain: the same name 150 to 500 m apart, or, within 150 m, names with a token overlap of at least 0.6
 *    (Jaccard) or where the shorter name's tokens (two or more) are all in the longer name.
 *
 * The weaker listing is the one with, in order: fewer distinct source datasets; lower assertion confidence
 * (origin < carried < corroborated < confirmed); fewer populated public fields (address, website, phone, category);
 * an older scan completion; then the lower (scanId, row). The rule is total, so the same pair always names the
 * same listing.
 */
export type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
export type Db = Q & {
  transaction<T>(work: (manager: Q) => Promise<T>): Promise<T>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const CERTAIN_RADIUS_METERS = 150;
export const UNCERTAIN_RADIUS_METERS = 500;
export const SIMILAR_NAME_JACCARD = 0.6;
export const DUPLICATE_CASE_INVALID = 'Invalid duplicate case';
export const DUPLICATE_CASE_NOT_FOUND = 'Duplicate case unavailable';
/** The case is no longer in the state the reviewer saw (stale decision). */
export const DUPLICATE_CASE_STALE = 'Duplicate case changed';
export const DUPLICATE_POLICY = 'D13 uncertain duplicate (owner 2026-11-18)';
const MAX_ROWS = 20_000;
const FILLER = new Set(['the', 'and', 'of', 'inc', 'llc', 'co', 'company']);
const CONFIDENCE_RANK: Readonly<Record<string, number>> = {
  origin: 0,
  carried: 1,
  corroborated: 2,
  confirmed: 3,
};

export type PairClass = 'certain_match' | 'uncertain' | 'certain_distinct';
export type UncertainRule = 'same_name_near' | 'similar_name';
export type WeakerBasis =
  | 'sources'
  | 'confidence'
  | 'fields'
  | 'updated'
  | 'order';

export interface PairListing {
  readonly scanId: string;
  readonly row: string;
  readonly name: string;
  readonly category?: string | null;
  readonly coordinates: readonly [number, number];
  readonly sources?: readonly { dataset?: string }[];
  readonly addresses?: readonly unknown[];
  readonly websites?: readonly unknown[];
  readonly phones?: readonly unknown[];
  readonly confidence?: string | null;
  readonly updatedAt?: number;
}

const tokens = (name: string): Set<string> =>
  new Set(
    normalizeName(name)
      .split(' ')
      .filter((t) => t && !FILLER.has(t))
  );

export interface PairVerdict {
  readonly kind: PairClass;
  readonly rule?: UncertainRule;
  readonly distanceMeters: number;
}

export function classifyPair(a: PairListing, b: PairListing): PairVerdict {
  const distance = distanceMeters(
    [a.coordinates[0], a.coordinates[1]],
    [b.coordinates[0], b.coordinates[1]]
  );
  const verdict = (kind: PairClass, rule?: UncertainRule): PairVerdict => ({
    kind,
    ...(rule ? { rule } : {}),
    distanceMeters: distance,
  });
  if (distance > UNCERTAIN_RADIUS_METERS) return verdict('certain_distinct');
  const na = normalizeName(a.name);
  const nb = normalizeName(b.name);
  if (!na || !nb) return verdict('certain_distinct');
  if (na === nb)
    return distance <= CERTAIN_RADIUS_METERS
      ? verdict('certain_match')
      : verdict('uncertain', 'same_name_near');
  if (distance > CERTAIN_RADIUS_METERS) return verdict('certain_distinct');
  const ta = tokens(a.name);
  const tb = tokens(b.name);
  const shared = [...ta].filter((t) => tb.has(t)).length;
  if (!shared) return verdict('certain_distinct');
  const union = ta.size + tb.size - shared;
  const smaller = ta.size <= tb.size ? ta : tb;
  const contained = smaller.size >= 2 && shared === smaller.size;
  return shared / union >= SIMILAR_NAME_JACCARD || contained
    ? verdict('uncertain', 'similar_name')
    : verdict('certain_distinct');
}

const populated = (l: PairListing): number =>
  [l.addresses, l.websites, l.phones].filter(
    (v) => Array.isArray(v) && v.length > 0
  ).length + (l.category && l.category.trim() ? 1 : 0);
const sourceCount = (l: PairListing): number =>
  new Set((l.sources ?? []).map((s) => s?.dataset ?? '')).size;
const rank = (l: PairListing): number =>
  CONFIDENCE_RANK[l.confidence ?? ''] ?? 0;

/** The weaker of an uncertain pair, and which step of the rule decided it. */
export function weakerListing(
  a: PairListing,
  b: PairListing
): { weaker: PairListing; kept: PairListing; basis: WeakerBasis } {
  const steps: [WeakerBasis, number, number][] = [
    ['sources', sourceCount(a), sourceCount(b)],
    ['confidence', rank(a), rank(b)],
    ['fields', populated(a), populated(b)],
    ['updated', a.updatedAt ?? 0, b.updatedAt ?? 0],
  ];
  for (const [basis, x, y] of steps)
    if (x !== y)
      return x < y
        ? { weaker: a, kept: b, basis }
        : { weaker: b, kept: a, basis };
  const aFirst =
    a.scanId !== b.scanId ? a.scanId < b.scanId : BigInt(a.row) < BigInt(b.row);
  return aFirst
    ? { weaker: a, kept: b, basis: 'order' }
    : { weaker: b, kept: a, basis: 'order' };
}

export interface QueueResult {
  readonly examined: number;
  readonly queued: number;
  readonly keptSeparateRecorded: number;
}

export const lockTown = (tx: Q, town: string) =>
  tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))', [
    `directory-listing-suppression:${town}`,
  ]);

async function servedListings(
  q: Q,
  town: string,
  changeToken: string
): Promise<PairListing[]> {
  const rows = await q.query(
    `SELECT DISTINCT ON (r."scanId", r."sourceFileRowNumber") r."scanId", r."sourceFileRowNumber"::text AS n, r.listing,
        (SELECT a.confidence FROM directory_business_assertion a WHERE a."scanId"=r."scanId" AND a."sourceFileRowNumber"=r."sourceFileRowNumber" AND a.state='current' LIMIT 1) AS confidence,
        (SELECT extract(epoch FROM t."completedAt")*1000 FROM directory_town_scan_target t WHERE t."communityId"=$1::uuid AND t."scanId"=r."scanId") AS updated
       FROM ${SERVED_ROW_FROM}
      WHERE ${servedRowWhere('$2', '$3')} AND r.listing IS NOT NULL
        AND (NOT (r.listing ? 'adult') OR r.listing->'adult'='false'::jsonb)
      ORDER BY r."scanId", r."sourceFileRowNumber" LIMIT ${MAX_ROWS}`,
    [town, town, changeToken]
  );
  const out: PairListing[] = [];
  for (const r of rows) {
    const l = r.listing ?? {};
    const c = l.location?.coordinates;
    if (
      typeof l.name !== 'string' ||
      !Array.isArray(c) ||
      !Number.isFinite(c[0]) ||
      !Number.isFinite(c[1])
    )
      continue;
    out.push({
      scanId: r.scanId,
      row: r.n,
      name: l.name,
      category: l.category,
      coordinates: [c[0], c[1]],
      sources: Array.isArray(l.sources) ? l.sources : [],
      addresses: l.addresses,
      websites: l.websites,
      phones: l.phones,
      confidence: r.confidence,
      updatedAt: r.updated === null ? 0 : Number(r.updated),
    });
  }
  return out;
}

/** Candidate pairs on a 0.005 degree grid (over 500 m), so a town is never compared all-against-all. */
function candidatePairs(
  listings: readonly PairListing[]
): [PairListing, PairListing][] {
  const cell = (v: number) => Math.floor(v / 0.005);
  const grid = new Map<string, PairListing[]>();
  for (const l of listings) {
    const k = `${cell(l.coordinates[0])}:${cell(l.coordinates[1])}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(l);
  }
  const pairs: [PairListing, PairListing][] = [];
  for (const l of listings)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const o of grid.get(
          `${cell(l.coordinates[0]) + dx}:${cell(l.coordinates[1]) + dy}`
        ) ?? [])
          if (
            o.scanId > l.scanId ||
            (o.scanId === l.scanId && BigInt(o.row) > BigInt(l.row))
          )
            pairs.push([l, o]);
  return pairs;
}

export const audit = (
  q: Q,
  caseId: string,
  kind: string,
  actorId: string | null,
  note: string | null,
  actor: { kind?: 'reviewer' | 'auto' | 'system'; ruleId?: string } = {}
) =>
  q.query(
    `INSERT INTO directory_duplicate_case_event ("caseId",kind,"actorId",note,"actorKind","ruleId") VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      caseId,
      kind,
      actorId,
      note,
      actor.kind ?? (actorId ? 'reviewer' : 'system'),
      actor.ruleId ?? null,
    ]
  );

export async function hideRow(
  tx: Q,
  town: string,
  row: { scanId: string; row: string },
  caseId: string
): Promise<string> {
  const [identity] = await getOrCreateListingIdentities(tx, town, [row]);
  const [business] = await tx.query(
    `SELECT a."businessId" FROM directory_business_assertion a
       JOIN directory_business b ON b.id=a."businessId" AND b."communityId"=$3 AND b.state='active'
      WHERE a."scanId"=$1 AND a."sourceFileRowNumber"=$2 AND a."communityId"=$3 AND a.state='current'`,
    [row.scanId, row.row, town]
  );
  const [created] = await tx.query(
    `INSERT INTO directory_listing_suppression (id,"communityId","listingId","scanId","sourceFileRowNumber","businessId","reasonCode",note,"actorId")
     VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,'duplicate',$6,NULL) RETURNING id`,
    [
      town,
      identity.id,
      row.scanId,
      row.row,
      business?.businessId ?? null,
      `${DUPLICATE_POLICY}; case ${caseId}`,
    ]
  );
  return created.id;
}

/**
 * Finds uncertain pairs among the town's served listings, hides the weaker listing of each and queues the pair.
 * Idempotent: a pair with a case (queued or decided) is never queued again. Also records a keep-separate for a case
 * whose suppression a reviewer lifted through the ordinary suppression route.
 */
export async function queueUncertainDuplicates(
  db: Db,
  input: { townId: string; changeToken: string }
): Promise<QueueResult> {
  if (!UUID.test(input?.townId ?? '') || !input.changeToken)
    throw Error(DUPLICATE_CASE_INVALID);
  const town = input.townId;
  return db.transaction(async (tx) => {
    await lockTown(tx, town);
    const lifted = await tx.query(
      `WITH u AS (UPDATE directory_duplicate_case c SET state='kept_separate',"decidedAt"=CURRENT_TIMESTAMP,"decidedBy"='reviewer',"autoRule"=NULL
         FROM directory_listing_suppression s
        WHERE c."communityId"=$1 AND c.state='queued' AND s.id=c."suppressionId" AND s."liftedAt" IS NOT NULL
        RETURNING c.id,s."liftedById" AS "actorId") SELECT id,"actorId" FROM u`,
      [town]
    );
    for (const c of lifted)
      await audit(
        tx,
        c.id,
        'kept_separate',
        c.actorId ?? null,
        'suppression lifted'
      );
    const listings = await servedListings(tx, town, input.changeToken);
    let queued = 0;
    const hidden = new Set<PairListing>();
    for (const [a, b] of candidatePairs(listings)) {
      // A listing hidden earlier in this run takes no part in a second pair.
      if (hidden.has(a) || hidden.has(b)) continue;
      const verdict = classifyPair(a, b);
      if (verdict.kind !== 'uncertain') continue;
      const { weaker, kept, basis } = weakerListing(a, b);
      const known = await tx.query(
        `SELECT 1 FROM directory_duplicate_case WHERE "communityId"=$1
            AND (("keptScanId"=$2 AND "keptRow"=$3 AND "hiddenScanId"=$4 AND "hiddenRow"=$5)
              OR ("keptScanId"=$4 AND "keptRow"=$5 AND "hiddenScanId"=$2 AND "hiddenRow"=$3)) LIMIT 1`,
        [town, kept.scanId, kept.row, weaker.scanId, weaker.row]
      );
      if (known.length) continue;
      const [created] = await tx.query(
        `INSERT INTO directory_duplicate_case ("communityId","keptScanId","keptRow","hiddenScanId","hiddenRow",rule,"weakerBasis","distanceMeters")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          town,
          kept.scanId,
          kept.row,
          weaker.scanId,
          weaker.row,
          verdict.rule,
          basis,
          Math.round(verdict.distanceMeters),
        ]
      );
      const suppressionId = await hideRow(tx, town, weaker, created.id);
      await tx.query(
        'UPDATE directory_duplicate_case SET "suppressionId"=$2 WHERE id=$1',
        [created.id, suppressionId]
      );
      await audit(
        tx,
        created.id,
        'queued',
        null,
        `${DUPLICATE_POLICY}: ${verdict.rule}, weaker by ${basis}`
      );
      queued += 1;
      hidden.add(weaker);
    }
    return {
      examined: listings.length,
      queued,
      keptSeparateRecorded: lifted.length,
    };
  });
}

export const DUPLICATE_ACTIONS = [
  'keep_separate',
  'merge',
  'undo',
  'swap_kept',
] as const;
export const DUPLICATE_STATES: readonly string[] = [
  'queued',
  'kept_separate',
  'merged',
  'stale',
];
/** Reviewer-facing groups of cases: open (queued), auto-resolved, stale (closed by cleanup) and reviewed. */
export const DUPLICATE_STATUSES: readonly string[] = [
  'open',
  'auto_resolved',
  'stale',
  'reviewed',
];
export const DUPLICATE_RULES: readonly string[] = [
  'same_name_near',
  'similar_name',
];
export const DUPLICATE_PAGE_MAX = 100;
export type DuplicateAction = (typeof DUPLICATE_ACTIONS)[number];
export interface DuplicateDecisionInput {
  readonly caseId: string;
  readonly townId: string;
  readonly action: DuplicateAction;
  readonly actorId: string;
  readonly reason: string;
  /** The state the reviewer saw. A decision on a case that has since moved is refused as stale. */
  readonly expectedState?: string;
  /** For `swap_kept`: the listing the reviewer saw as kept. A swap that was already applied is a replay, not a swap back. */
  readonly expectedKept?: { scanId: string; sourceFileRowNumber: string };
}
export interface DuplicateDecisionResult {
  readonly replayed: boolean;
  readonly state: string;
}

/** A reviewer's decision. Keep separate restores the hidden listing; merge keeps it hidden; undo re-opens the case. */
export async function decideDuplicateCase(
  db: Db,
  input: DuplicateDecisionInput
): Promise<DuplicateDecisionResult> {
  if (
    !input ||
    !UUID.test(input.caseId ?? '') ||
    !UUID.test(input.townId ?? '') ||
    !UUID.test(input.actorId ?? '') ||
    !(DUPLICATE_ACTIONS as readonly string[]).includes(input.action) ||
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.length > 1024 ||
    (input.expectedState !== undefined &&
      !DUPLICATE_STATES.includes(input.expectedState)) ||
    (input.expectedKept !== undefined &&
      (typeof input.expectedKept?.scanId !== 'string' ||
        !/^[0-9]{1,18}$/.test(String(input.expectedKept?.sourceFileRowNumber))))
  )
    throw Error(DUPLICATE_CASE_INVALID);
  return db.transaction(async (tx) => {
    await assertDirectoryIdentitiesUnfenced(tx, [input.actorId]);
    await lockTown(tx, input.townId);
    const [c] = await tx.query(
      'SELECT * FROM directory_duplicate_case WHERE id=$1 AND "communityId"=$2 FOR UPDATE',
      [input.caseId, input.townId]
    );
    if (!c) throw Error(DUPLICATE_CASE_NOT_FOUND);
    if (c.state === 'stale') throw Error(DUPLICATE_CASE_STALE);
    if (input.action === 'swap_kept') return swapKept(tx, c, input);
    const target =
      input.action === 'keep_separate'
        ? 'kept_separate'
        : input.action === 'merge'
        ? 'merged'
        : 'queued';
    // A reviewer confirming an automatic resolution takes it over: it counts as reviewed from then on.
    const confirmsAuto =
      input.action === 'merge' &&
      c.state === 'merged' &&
      c.decidedBy === 'auto';
    if (c.state === target && input.action !== 'undo' && !confirmsAuto)
      return { replayed: true, state: c.state };
    if (input.expectedState !== undefined && input.expectedState !== c.state)
      throw Error(DUPLICATE_CASE_STALE);
    if (input.action === 'undo' && c.state === 'queued')
      throw Error(DUPLICATE_CASE_INVALID);
    const liftOpen = () =>
      tx.query(
        `UPDATE directory_listing_suppression SET "liftedAt"=CURRENT_TIMESTAMP,"liftReasonCode"='resolved',"liftedById"=$2
          WHERE id=$1 AND "liftedAt" IS NULL`,
        [c.suppressionId, input.actorId]
      );
    let suppressionId: string = c.suppressionId;
    if (input.action === 'keep_separate') {
      await liftOpen();
    } else if (input.action === 'undo') {
      const [open] = await tx.query(
        'SELECT 1 FROM directory_listing_suppression WHERE id=$1 AND "liftedAt" IS NULL',
        [c.suppressionId]
      );
      if (!open)
        suppressionId = await hideRow(
          tx,
          input.townId,
          { scanId: c.hiddenScanId, row: String(c.hiddenRow) },
          c.id
        );
    } else if (c.state === 'kept_separate') {
      suppressionId = await hideRow(
        tx,
        input.townId,
        { scanId: c.hiddenScanId, row: String(c.hiddenRow) },
        c.id
      );
    }
    await tx.query(
      `UPDATE directory_duplicate_case SET state=$2::varchar,"suppressionId"=$3,"decidedAt"=CASE WHEN $2::varchar='queued' THEN NULL ELSE CURRENT_TIMESTAMP END,
        "decidedBy"=CASE WHEN $2::varchar='queued' THEN NULL ELSE 'reviewer' END,"autoRule"=NULL WHERE id=$1`,
      [c.id, target, suppressionId]
    );
    await audit(
      tx,
      c.id,
      input.action === 'undo' ? 'undone' : target,
      input.actorId,
      input.reason
    );
    return { replayed: false, state: target };
  });
}

/**
 * Swap which listing of a hidden pair is kept: the hidden listing returns and the kept one is hidden instead. Allowed
 * while the pair is open or resolved (hidden). The case keeps its state, except that a swapped automatic resolution
 * becomes a reviewer decision. Recorded as a `swapped` event.
 */
async function swapKept(
  tx: Q,
  c: any,
  input: DuplicateDecisionInput
): Promise<DuplicateDecisionResult> {
  if (c.state !== 'queued' && c.state !== 'merged')
    throw Error(DUPLICATE_CASE_INVALID);
  const seen = input.expectedKept;
  if (seen) {
    const is = (scan: string, row: unknown) =>
      seen.scanId === scan && String(seen.sourceFileRowNumber) === String(row);
    if (is(c.hiddenScanId, c.hiddenRow))
      return { replayed: true, state: c.state };
    if (!is(c.keptScanId, c.keptRow)) throw Error(DUPLICATE_CASE_STALE);
  }
  if (input.expectedState !== undefined && input.expectedState !== c.state)
    throw Error(DUPLICATE_CASE_STALE);
  await tx.query(
    `UPDATE directory_listing_suppression SET "liftedAt"=CURRENT_TIMESTAMP,"liftReasonCode"='resolved',"liftedById"=$2
      WHERE id=$1 AND "liftedAt" IS NULL`,
    [c.suppressionId, input.actorId]
  );
  const suppressionId = await hideRow(
    tx,
    input.townId,
    { scanId: c.keptScanId, row: String(c.keptRow) },
    c.id
  );
  await tx.query(
    `UPDATE directory_duplicate_case SET "keptScanId"=$2,"keptRow"=$3,"hiddenScanId"=$4,"hiddenRow"=$5,"suppressionId"=$6,
        "decidedBy"=CASE WHEN state='queued' THEN NULL ELSE 'reviewer' END,"autoRule"=NULL,
        "decidedAt"=CASE WHEN state='queued' THEN NULL ELSE CURRENT_TIMESTAMP END WHERE id=$1`,
    [c.id, c.hiddenScanId, c.hiddenRow, c.keptScanId, c.keptRow, suppressionId]
  );
  await audit(tx, c.id, 'swapped', input.actorId, input.reason);
  return { replayed: false, state: c.state };
}

export interface DuplicateCaseRecord {
  readonly caseId: string;
  readonly state: string;
  /** open, auto_resolved, stale or reviewed. */
  readonly status: string;
  /** The automatic rule that resolved the case, when it was resolved automatically. */
  readonly autoRule: string | null;
  readonly rule: string;
  readonly weakerBasis: string;
  readonly distanceMeters: number;
  readonly kept: { scanId: string; sourceFileRowNumber: string };
  readonly hidden: { scanId: string; sourceFileRowNumber: string };
  readonly keptName: string | null;
  readonly hiddenName: string | null;
  readonly createdAt: string;
}

export interface DuplicateListQuery {
  readonly state?: string;
  readonly status?: string;
  readonly rule?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Reviewer queue for one town, paged on the server: queued cases first, then newest. Optional `state` and `rule`
 * filters. `total` counts every case matching the filters, not just the page.
 */
export async function listDuplicateCases(
  q: Q,
  town: string,
  query: DuplicateListQuery = {}
): Promise<{
  cases: DuplicateCaseRecord[];
  total: number;
  limit: number;
  offset: number;
  counts: DuplicateStatusCounts;
}> {
  const limit = query.limit ?? 25;
  const offset = query.offset ?? 0;
  if (
    !UUID.test(town) ||
    (query.state !== undefined && !DUPLICATE_STATES.includes(query.state)) ||
    (query.rule !== undefined && !DUPLICATE_RULES.includes(query.rule)) ||
    (query.status !== undefined &&
      !DUPLICATE_STATUSES.includes(query.status)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > DUPLICATE_PAGE_MAX ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 10_000_000
  )
    throw Error(DUPLICATE_CASE_INVALID);
  const params: unknown[] = [town];
  let where = 'c."communityId"=$1';
  if (query.state !== undefined) {
    params.push(query.state);
    where += ` AND c.state=$${params.length}`;
  }
  if (query.rule !== undefined) {
    params.push(query.rule);
    where += ` AND c.rule=$${params.length}`;
  }
  if (query.status !== undefined) where += ` AND ${STATUS_SQL[query.status]}`;
  const [count] = await q.query(
    `SELECT count(*)::int AS n FROM directory_duplicate_case c WHERE ${where}`,
    params
  );
  const rows = await q.query(
    `SELECT c.id,c.state,c."decidedBy",c."autoRule",c.rule,c."weakerBasis",c."distanceMeters",c."keptScanId",c."keptRow"::text AS "keptRow",c."hiddenScanId",c."hiddenRow"::text AS "hiddenRow",c."createdAt",
        (SELECT r.listing->>'name' FROM directory_overture_private_row r WHERE r."scanId"=c."keptScanId" AND r."sourceFileRowNumber"=c."keptRow") AS "keptName",
        (SELECT r.listing->>'name' FROM directory_overture_private_row r WHERE r."scanId"=c."hiddenScanId" AND r."sourceFileRowNumber"=c."hiddenRow") AS "hiddenName"
       FROM directory_duplicate_case c WHERE ${where}
      ORDER BY (c.state='queued') DESC, c."createdAt" DESC, c.id LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  return {
    cases: rows.map(toRecord),
    total: count?.n ?? 0,
    limit,
    offset,
    counts: await duplicateStatusCounts(q, town),
  };
}

export interface DuplicateStatusCounts {
  readonly open: number;
  readonly autoResolved: number;
  readonly stale: number;
  readonly reviewed: number;
}

const STATUS_SQL: Record<string, string> = {
  open: `c.state='queued'`,
  auto_resolved: `(c.state='merged' AND c."decidedBy"='auto')`,
  stale: `c.state='stale'`,
  reviewed: `(c.state IN ('merged','kept_separate') AND COALESCE(c."decidedBy",'reviewer')<>'auto')`,
};

/** Every case of the town counted by status, so a reviewer sees the whole queue whatever the page filter. */
export async function duplicateStatusCounts(
  q: Q,
  town: string
): Promise<DuplicateStatusCounts> {
  const [r] = await q.query(
    `SELECT count(*) FILTER (WHERE ${STATUS_SQL['open']})::int AS open,
            count(*) FILTER (WHERE ${STATUS_SQL['auto_resolved']})::int AS "autoResolved",
            count(*) FILTER (WHERE ${STATUS_SQL['stale']})::int AS stale,
            count(*) FILTER (WHERE ${STATUS_SQL['reviewed']})::int AS reviewed
       FROM directory_duplicate_case c WHERE c."communityId"=$1`,
    [town]
  );
  return {
    open: r?.open ?? 0,
    autoResolved: r?.autoResolved ?? 0,
    stale: r?.stale ?? 0,
    reviewed: r?.reviewed ?? 0,
  };
}

const statusOf = (r: any): string =>
  r.state === 'queued'
    ? 'open'
    : r.state === 'stale'
    ? 'stale'
    : r.decidedBy === 'auto'
    ? 'auto_resolved'
    : 'reviewed';

const toRecord = (r: any): DuplicateCaseRecord => ({
  caseId: r.id,
  state: r.state,
  status: statusOf(r),
  autoRule: r.decidedBy === 'auto' ? r.autoRule ?? null : null,
  rule: r.rule,
  weakerBasis: r.weakerBasis,
  distanceMeters: r.distanceMeters,
  kept: { scanId: r.keptScanId, sourceFileRowNumber: r.keptRow },
  hidden: { scanId: r.hiddenScanId, sourceFileRowNumber: r.hiddenRow },
  keptName: r.keptName ?? null,
  hiddenName: r.hiddenName ?? null,
  createdAt: new Date(r.createdAt).toISOString(),
});

export interface DuplicateListingView {
  readonly scanId: string;
  readonly sourceFileRowNumber: string;
  readonly name: string | null;
  readonly category: string | null;
  readonly addresses: string[];
  readonly phones: string[];
  readonly websites: string[];
  /** Distinct source datasets that assert the listing (provenance). */
  readonly sources: string[];
  readonly coordinates: [number, number] | null;
  /** True for the weaker listing the case hid. */
  readonly hidden: boolean;
}
export interface DuplicateCaseHistoryEntry {
  readonly eventId: string;
  readonly kind: string;
  readonly actorId: string | null;
  readonly actorKind: string;
  readonly ruleId: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}
export interface DuplicateCaseDetail extends DuplicateCaseRecord {
  readonly decidedAt: string | null;
  readonly keptListing: DuplicateListingView;
  readonly hiddenListing: DuplicateListingView;
  readonly history: DuplicateCaseHistoryEntry[];
}

const strings = (v: unknown, max = 10): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === 'string')
        .slice(0, max)
        .map((x) => x.slice(0, 300))
    : [];

function listingView(
  scanId: string,
  row: string,
  listing: any,
  hidden: boolean
): DuplicateListingView {
  const l = listing ?? {};
  const c = l.location?.coordinates;
  const datasets = new Set<string>();
  for (const s of Array.isArray(l.sources) ? l.sources : [])
    if (typeof s?.dataset === 'string') datasets.add(s.dataset.slice(0, 64));
  return {
    scanId,
    sourceFileRowNumber: row,
    name: typeof l.name === 'string' ? l.name.slice(0, 300) : null,
    category: typeof l.category === 'string' ? l.category.slice(0, 120) : null,
    addresses: strings(l.addresses),
    phones: strings(l.phones),
    websites: strings(l.websites),
    sources: [...datasets].sort(),
    coordinates:
      Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])
        ? [c[0], c[1]]
        : null,
    hidden,
  };
}

/** One case with both listings side by side and its decision history. Reviewer-only. */
export async function getDuplicateCase(
  q: Q,
  town: string,
  caseId: string
): Promise<DuplicateCaseDetail> {
  if (!UUID.test(town) || !UUID.test(caseId))
    throw Error(DUPLICATE_CASE_INVALID);
  const [c] = await q.query(
    `SELECT c.id,c.state,c."decidedBy",c."autoRule",c.rule,c."weakerBasis",c."distanceMeters",c."keptScanId",c."keptRow"::text AS "keptRow",c."hiddenScanId",c."hiddenRow"::text AS "hiddenRow",c."createdAt",c."decidedAt"
       FROM directory_duplicate_case c WHERE c.id=$1 AND c."communityId"=$2`,
    [caseId, town]
  );
  if (!c) throw Error(DUPLICATE_CASE_NOT_FOUND);
  const row = async (scanId: string, n: string) =>
    (
      await q.query(
        'SELECT r.listing FROM directory_overture_private_row r WHERE r."scanId"=$1 AND r."sourceFileRowNumber"=$2',
        [scanId, n]
      )
    )[0]?.listing;
  const kept = await row(c.keptScanId, c.keptRow);
  const hidden = await row(c.hiddenScanId, c.hiddenRow);
  const events = await q.query(
    `SELECT id,kind,"actorId","actorKind","ruleId",note,"createdAt" FROM directory_duplicate_case_event WHERE "caseId"=$1 ORDER BY "createdAt" ASC, id LIMIT 200`,
    [caseId]
  );
  return {
    ...toRecord({
      ...c,
      keptName: kept?.name,
      hiddenName: hidden?.name,
    }),
    decidedAt: c.decidedAt ? new Date(c.decidedAt).toISOString() : null,
    keptListing: listingView(c.keptScanId, c.keptRow, kept, false),
    hiddenListing: listingView(
      c.hiddenScanId,
      c.hiddenRow,
      hidden,
      c.state !== 'kept_separate' && c.state !== 'stale'
    ),
    history: events.map((e) => ({
      eventId: e.id,
      kind: e.kind,
      actorId: e.actorId ?? null,
      actorKind: e.actorId ? 'reviewer' : e.actorKind ?? 'system',
      ruleId: e.ruleId ?? null,
      note: e.note ?? null,
      createdAt: new Date(e.createdAt).toISOString(),
    })),
  };
}
