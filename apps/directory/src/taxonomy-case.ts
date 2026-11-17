import { createHash } from 'node:crypto';
import {
  DIRECTORY_TAXONOMY_CATEGORIES,
  isTaxonomyPlaceTypeForCategory,
  type TaxonomyCaseDetail,
  type TaxonomyCaseStatus,
  type TaxonomyCaseSummary,
  type TaxonomyDecisionResult,
  type TaxonomyHistoryEntry,
  type TaxonomyRaiseCaseResult,
} from '../../../libs/social/contracts/src/lib/directory';
import { resolveBusinessId } from './business-identity-read';
import { findListingIdentity } from './listing-identity';
import {
  assertFreshToken,
  IDEMPOTENCY_CONFLICT,
  NOT_LATEST,
  ReviewConflictError,
  versionToken,
} from './review-version';
import { CLASSIFICATION_JOINS } from './taxonomy-served';
import { effectiveClassification, loadActiveMapping } from './taxonomy-mapping';

/**
 * Taxonomy classification cases (S7d). A case is one listing whose category an operator decides. An `assign`
 * writes a per-listing override keyed by the listing's STABLE identity (the business id once the row has one, else
 * the row-scoped listing id), so a rescan that carries the business keeps the operator's choice. Decisions follow
 * the S7b contract: a version token (`stale_decision`), an idempotent client decision id (`decision_conflict`),
 * an append-only history and an undo of the latest effective decision (`not_latest`); `invalid_state` covers a
 * decision the case cannot take.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INVALID = 'Invalid taxonomy decision';
const STATUSES = ['open', 'assigned', 'rejected', 'deferred'] as const;
export const TAXONOMY_ACTIONS = [
  'assign',
  'reject',
  'defer',
  'reopen',
] as const;
type Action = (typeof TAXONOMY_ACTIONS)[number];
const UNDOABLE = new Set<string>(TAXONOMY_ACTIONS);

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

function derivedId(...parts: string[]): string {
  const h = createHash('sha256').update(parts.join('\u0000')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(
    17,
    20
  )}-${h.slice(20, 32)}`;
}

const CASE_COLUMNS = `c.id,c."communityId",c."listingKey",c."scanId",c."sourceFileRowNumber",c.reason,c.name,c."observedCategory",c.status,c."createdAt",c."updatedAt",
  (SELECT o."categoryId" FROM directory_listing_category_override o WHERE o."communityId"=c."communityId" AND o."listingKey"=c."listingKey" AND o.active AND o."caseId"=c.id) AS "assignedCategoryId",
  (SELECT o."placeTypeId" FROM directory_listing_category_override o WHERE o."communityId"=c."communityId" AND o."listingKey"=c."listingKey" AND o.active AND o."caseId"=c.id) AS "assignedPlaceTypeId"`;
const EVENT_COLUMNS = `id,"caseId",action,"actorId",reason,"categoryId","placeTypeId","statusBefore","statusAfter","overrideBefore","undoOf","createdAt"`;

function tokenOf(
  c: { id: string; status: string },
  latest: string | null,
  count: number
): string {
  return versionToken(['taxonomy-case', c.id, c.status, latest, count]);
}

function summary(
  c: any,
  latest: string | null,
  count: number
): TaxonomyCaseSummary {
  return {
    id: c.id,
    townId: c.communityId,
    listingId: c.listingKey,
    reason: c.reason,
    name: c.name,
    observedCategory: c.observedCategory,
    status: c.status,
    assignedCategoryId: c.assignedCategoryId ?? null,
    assignedPlaceTypeId: c.assignedPlaceTypeId ?? null,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
    versionToken: tokenOf(c, latest, count),
  };
}

/** Effective stack: an undo removes the decision it names. The top is the only reversible entry. */
function effective(events: readonly any[]): any[] {
  const stack: any[] = [];
  for (const e of events) {
    if (e.action === 'undo') {
      const i = stack.findIndex((x) => x.id === e.undoOf);
      if (i >= 0) stack.splice(i, 1);
    } else if (e.action !== 'open') stack.push(e);
  }
  return stack;
}

function history(events: readonly any[]): TaxonomyHistoryEntry[] {
  const undoneBy = new Map<string, string>();
  for (const e of events) if (e.action === 'undo') undoneBy.set(e.undoOf, e.id);
  const top = effective(events).at(-1);
  return events.map((e) => ({
    decisionId: e.id,
    action: e.action,
    actorId: e.actorId,
    reason: e.reason,
    createdAt: iso(e.createdAt),
    undoOf: e.undoOf ?? null,
    undoneBy: undoneBy.get(e.id) ?? null,
    reversible: !!top && top.id === e.id && UNDOABLE.has(e.action),
    categoryId: e.categoryId ?? null,
    placeTypeId: e.placeTypeId ?? null,
    statusBefore: e.statusBefore,
    statusAfter: e.statusAfter,
  }));
}

async function readEvents(q: Q, caseId: string): Promise<any[]> {
  return q.query(
    `SELECT ${EVENT_COLUMNS} FROM directory_taxonomy_event WHERE "caseId"=$1 ORDER BY "createdAt","id"`,
    [caseId]
  );
}

export async function listTaxonomyCases(
  db: Q,
  options: {
    status?: string;
    townId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ cases: TaxonomyCaseSummary[] }> {
  const { status, townId } = options;
  if (status !== undefined && !(STATUSES as readonly string[]).includes(status))
    throw Error('Invalid status');
  if (townId !== undefined && !UUID.test(townId)) throw Error('Invalid town');
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw Error('Invalid limit');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
    throw Error('Invalid offset');
  const rows = await db.query(
    `SELECT ${CASE_COLUMNS},
       (SELECT e.id FROM directory_taxonomy_event e WHERE e."caseId"=c.id ORDER BY e."createdAt" DESC, e.id DESC LIMIT 1) AS "latestEvent",
       (SELECT count(*)::int FROM directory_taxonomy_event e WHERE e."caseId"=c.id) AS "eventCount"
     FROM directory_taxonomy_case c WHERE ($1::text IS NULL OR c.status=$1) AND ($2::uuid IS NULL OR c."communityId"=$2)
     ORDER BY c."updatedAt" DESC, c.id LIMIT $3 OFFSET $4`,
    [status ?? null, townId ?? null, limit, offset]
  );
  return {
    cases: rows.map((c: any) =>
      summary(c, c.latestEvent ?? null, Number(c.eventCount))
    ),
  };
}

export async function getTaxonomyCase(
  db: Q,
  id: string
): Promise<TaxonomyCaseDetail | null> {
  if (!UUID.test(id)) throw Error('Invalid case');
  const [c] = await db.query(
    `SELECT ${CASE_COLUMNS} FROM directory_taxonomy_case c WHERE c.id=$1`,
    [id]
  );
  if (!c) return null;
  const events = await readEvents(db, id);
  return {
    ...summary(c, events.at(-1)?.id ?? null, events.length),
    history: history(events),
  };
}

async function lockCase(q: Q, id: string): Promise<any> {
  const [c] = await q.query(
    `SELECT ${CASE_COLUMNS} FROM directory_taxonomy_case c WHERE c.id=$1 FOR UPDATE OF c`,
    [id]
  );
  return c;
}

/**
 * Re-derives one source row's projection from the active mapping and the listing's current override. With neither
 * a mapping nor an override there is nothing to persist, so the row's projection is removed and reads fall back to
 * the stored category.
 */
export async function refreshRowProjection(
  q: Q,
  scanId: string,
  row: string
): Promise<void> {
  const [r] = await q.query(
    `SELECT r.listing, ov."categoryId" AS "overrideCategoryId", ov."placeTypeId" AS "overridePlaceTypeId"
     FROM directory_overture_private_row r ${CLASSIFICATION_JOINS}
     WHERE r."scanId"=$1 AND r."sourceFileRowNumber"=$2`,
    [scanId, row]
  );
  if (!r) return;
  const mapping = await loadActiveMapping(q);
  const e = effectiveClassification(
    mapping,
    r.overrideCategoryId
      ? {
          categoryId: r.overrideCategoryId,
          placeTypeId: r.overridePlaceTypeId ?? null,
        }
      : null,
    r.listing
  );
  if (!mapping && e.basis !== 'override') {
    await q.query(
      `DELETE FROM directory_listing_classification WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`,
      [scanId, row]
    );
    return;
  }
  await q.query(
    `INSERT INTO directory_listing_classification ("scanId","sourceFileRowNumber","mappingVersion","categoryId","placeTypeId",basis,excluded,"exclusionReason","runId","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,clock_timestamp())
     ON CONFLICT ("scanId","sourceFileRowNumber") DO UPDATE SET "mappingVersion"=EXCLUDED."mappingVersion","categoryId"=EXCLUDED."categoryId","placeTypeId"=EXCLUDED."placeTypeId",
       basis=EXCLUDED.basis,excluded=EXCLUDED.excluded,"exclusionReason"=EXCLUDED."exclusionReason","runId"=NULL,"updatedAt"=EXCLUDED."updatedAt"`,
    [
      scanId,
      row,
      mapping?.id ?? 'override',
      e.categoryId,
      e.placeTypeId,
      e.basis,
      e.excluded,
      e.exclusionReason,
    ]
  );
}

/** The stable key and current source row of a listing the operator names (a business id, an old id, or a row id). */
async function resolveListing(
  q: Q,
  town: string,
  listingId: string
): Promise<{ key: string; scanId: string; row: string } | null> {
  const resolved = await resolveBusinessId(q, town, listingId);
  if (resolved.kind === 'row')
    return {
      key: resolved.businessId,
      scanId: resolved.position.scanId,
      row: resolved.position.row,
    };
  if (resolved.kind === 'dead') return null;
  const identity = await findListingIdentity(q, town, listingId);
  return identity
    ? { key: listingId, scanId: identity.scanId, row: identity.row }
    : null;
}

export async function raiseTaxonomyCase(
  db: Db,
  input: {
    caseId: string;
    townId: string;
    listingId: string;
    actorId: string;
    reason: string;
  }
): Promise<TaxonomyRaiseCaseResult> {
  if (
    !UUID.test(input.caseId) ||
    !UUID.test(input.townId) ||
    !UUID.test(input.listingId) ||
    !UUID.test(input.actorId) ||
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.length > 1024
  )
    throw Error('Invalid taxonomy case');
  return db.transaction(async (q) => {
    const read = async (id: string) => {
      const [c] = await q.query(
        `SELECT ${CASE_COLUMNS} FROM directory_taxonomy_case c WHERE c.id=$1`,
        [id]
      );
      const events = await readEvents(q, id);
      return summary(c, events.at(-1)?.id ?? null, events.length);
    };
    const [same] = await q.query(
      `SELECT id,"communityId","listingKey" FROM directory_taxonomy_case WHERE id=$1`,
      [input.caseId]
    );
    const target = await resolveListing(q, input.townId, input.listingId);
    if (!target) throw Error('Listing unavailable');
    if (same) {
      if (same.communityId !== input.townId || same.listingKey !== target.key)
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return { replayed: true, case: await read(same.id) };
    }
    await q.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `taxonomy-case:${input.townId}:${target.key}`,
    ]);
    const [open] = await q.query(
      `SELECT id FROM directory_taxonomy_case WHERE "communityId"=$1 AND "listingKey"=$2 AND status IN ('open','deferred')`,
      [input.townId, target.key]
    );
    if (open) return { replayed: true, case: await read(open.id) };
    const [row] = await q.query(
      `SELECT listing->>'name' AS name, listing->>'category' AS category FROM directory_overture_private_row
       WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "regionId"=$3`,
      [target.scanId, target.row, input.townId]
    );
    if (!row || typeof row.name !== 'string')
      throw Error('Listing unavailable');
    await q.query(
      `INSERT INTO directory_taxonomy_case (id,"communityId","listingKey","scanId","sourceFileRowNumber",reason,name,"observedCategory",status,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'operator_raised',$6,$7,'open',clock_timestamp(),clock_timestamp())`,
      [
        input.caseId,
        input.townId,
        target.key,
        target.scanId,
        target.row,
        row.name.slice(0, 2000),
        (row.category ?? '').slice(0, 200),
      ]
    );
    await q.query(
      `INSERT INTO directory_taxonomy_event (id,"caseId",action,"actorId",reason,"statusBefore","statusAfter","createdAt")
       VALUES ($1,$2,'open',$3,$4,'open','open',clock_timestamp())`,
      [
        derivedId('open', input.caseId),
        input.caseId,
        input.actorId,
        input.reason,
      ]
    );
    return { replayed: false, case: await read(input.caseId) };
  });
}

export interface TaxonomyDecisionInput {
  readonly decisionId: string;
  readonly caseId: string;
  readonly actorId: string;
  readonly action: Action;
  readonly reason: string;
  readonly expectedVersionToken: string;
  readonly categoryId?: string;
  readonly placeTypeId?: string;
}

function nextStatus(c: any, input: TaxonomyDecisionInput): TaxonomyCaseStatus {
  switch (input.action) {
    case 'assign':
      if (!['open', 'deferred', 'assigned'].includes(c.status))
        throw new ReviewConflictError('invalid_state');
      return 'assigned';
    case 'reject':
      if (!['open', 'deferred'].includes(c.status))
        throw new ReviewConflictError('invalid_state');
      return 'rejected';
    case 'defer':
      if (c.status !== 'open') throw new ReviewConflictError('invalid_state');
      return 'deferred';
    case 'reopen':
      // An assigned case is changed by assigning again or by undo; reopening would orphan its override.
      if (!['rejected', 'deferred'].includes(c.status))
        throw new ReviewConflictError('invalid_state');
      return 'open';
  }
}

function validateDecision(i: TaxonomyDecisionInput): void {
  if (
    !UUID.test(i.decisionId) ||
    !UUID.test(i.caseId) ||
    !UUID.test(i.actorId) ||
    !(TAXONOMY_ACTIONS as readonly string[]).includes(i.action) ||
    typeof i.reason !== 'string' ||
    !i.reason.trim() ||
    i.reason.length > 1024
  )
    throw Error(INVALID);
  if (i.action === 'assign') {
    // Operators cannot assign `adult`: adult listings are classified by the source data and the opt-in rule.
    const known = DIRECTORY_TAXONOMY_CATEGORIES.some(
      (c) => c.id === i.categoryId && c.id !== 'adult'
    );
    if (!known) throw Error(INVALID);
    if (
      i.placeTypeId !== undefined &&
      !isTaxonomyPlaceTypeForCategory(i.placeTypeId, i.categoryId as string)
    )
      throw Error(INVALID);
  } else if (i.categoryId !== undefined || i.placeTypeId !== undefined)
    throw Error(INVALID);
}

async function applyEvent(
  q: Q,
  c: any,
  e: {
    id: string;
    action: string;
    actorId: string;
    reason: string;
    categoryId?: string | null;
    placeTypeId?: string | null;
    statusAfter: string;
    overrideBefore?: object | null;
    undoOf?: string | null;
  }
): Promise<void> {
  await q.query(
    `INSERT INTO directory_taxonomy_event (id,"caseId",action,"actorId",reason,"categoryId","placeTypeId","statusBefore","statusAfter","overrideBefore","undoOf","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,clock_timestamp())`,
    [
      e.id,
      c.id,
      e.action,
      e.actorId,
      e.reason,
      e.categoryId ?? null,
      e.placeTypeId ?? null,
      c.status,
      e.statusAfter,
      e.overrideBefore === undefined || e.overrideBefore === null
        ? null
        : JSON.stringify(e.overrideBefore),
      e.undoOf ?? null,
    ]
  );
  try {
    await q.query(
      `UPDATE directory_taxonomy_case SET status=$2,"updatedAt"=clock_timestamp() WHERE id=$1`,
      [c.id, e.statusAfter]
    );
  } catch (error) {
    // The one-open-case-per-listing index: reopening into a listing that already has an open case.
    if ((error as { code?: string })?.code === '23505')
      throw new ReviewConflictError('invalid_state');
    throw error;
  }
}

const readOverride = async (q: Q, c: any): Promise<any | null> => {
  const [o] = await q.query(
    `SELECT "categoryId","placeTypeId",active,"caseId","eventId" FROM directory_listing_category_override
     WHERE "communityId"=$1 AND "listingKey"=$2 FOR UPDATE`,
    [c.communityId, c.listingKey]
  );
  return o ?? null;
};

export async function decideTaxonomyCase(
  db: Db,
  input: TaxonomyDecisionInput
): Promise<TaxonomyDecisionResult> {
  validateDecision(input);
  return db.transaction(async (q) => {
    const c = await lockCase(q, input.caseId);
    if (!c) throw Error('Case not found');
    const [prior] = await q.query(
      `SELECT ${EVENT_COLUMNS} FROM directory_taxonomy_event WHERE id=$1`,
      [input.decisionId]
    );
    if (prior) {
      if (
        prior.caseId !== input.caseId ||
        prior.action !== input.action ||
        prior.actorId !== input.actorId ||
        prior.reason !== input.reason ||
        (prior.categoryId ?? undefined) !== input.categoryId ||
        (prior.placeTypeId ?? undefined) !== input.placeTypeId
      )
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return { replayed: true, status: prior.statusAfter };
    }
    const events = await readEvents(q, c.id);
    assertFreshToken(
      input.expectedVersionToken,
      tokenOf(c, events.at(-1)?.id ?? null, events.length)
    );
    const statusAfter = nextStatus(c, input);
    let overrideBefore: object | null = null;
    if (input.action === 'assign') {
      overrideBefore = await readOverride(q, c);
      await q.query(
        `INSERT INTO directory_listing_category_override ("communityId","listingKey","categoryId","placeTypeId",active,"caseId","eventId","updatedAt")
         VALUES ($1,$2,$3,$4,true,$5,$6,clock_timestamp())
         ON CONFLICT ("communityId","listingKey") DO UPDATE SET "categoryId"=EXCLUDED."categoryId","placeTypeId"=EXCLUDED."placeTypeId",active=true,
           "caseId"=EXCLUDED."caseId","eventId"=EXCLUDED."eventId","updatedAt"=EXCLUDED."updatedAt"`,
        [
          c.communityId,
          c.listingKey,
          input.categoryId,
          input.placeTypeId ?? null,
          c.id,
          input.decisionId,
        ]
      );
    }
    await applyEvent(q, c, {
      id: input.decisionId,
      action: input.action,
      actorId: input.actorId,
      reason: input.reason,
      categoryId: input.categoryId ?? null,
      placeTypeId: input.placeTypeId ?? null,
      statusAfter,
      overrideBefore,
    });
    if (input.action === 'assign')
      await refreshRowProjection(q, c.scanId, String(c.sourceFileRowNumber));
    return { replayed: false, status: statusAfter };
  });
}

export interface TaxonomyUndoInput {
  readonly decisionId: string;
  readonly caseId: string;
  readonly undoOf: string;
  readonly actorId: string;
  readonly reason: string;
  readonly expectedVersionToken: string;
}

/** Reverses the latest effective decision: the case returns to its prior status and an assign restores the prior override. */
export async function undoTaxonomyDecision(
  db: Db,
  input: TaxonomyUndoInput
): Promise<TaxonomyDecisionResult> {
  if (
    !UUID.test(input.decisionId) ||
    !UUID.test(input.caseId) ||
    !UUID.test(input.undoOf) ||
    !UUID.test(input.actorId) ||
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.length > 1024
  )
    throw Error(INVALID);
  return db.transaction(async (q) => {
    const c = await lockCase(q, input.caseId);
    if (!c) throw Error('Case not found');
    const [prior] = await q.query(
      `SELECT ${EVENT_COLUMNS} FROM directory_taxonomy_event WHERE id=$1`,
      [input.decisionId]
    );
    if (prior) {
      if (
        prior.caseId !== input.caseId ||
        prior.action !== 'undo' ||
        prior.undoOf !== input.undoOf ||
        prior.actorId !== input.actorId ||
        prior.reason !== input.reason
      )
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return { replayed: true, status: prior.statusAfter };
    }
    const events = await readEvents(q, c.id);
    assertFreshToken(
      input.expectedVersionToken,
      tokenOf(c, events.at(-1)?.id ?? null, events.length)
    );
    const top = effective(events).at(-1);
    if (!top || top.id !== input.undoOf || !UNDOABLE.has(top.action))
      throw new ReviewConflictError(NOT_LATEST);
    if (top.action === 'assign') {
      const current = await readOverride(q, c);
      // Another case may have replaced this listing's override since; restoring over it would erase that decision.
      if (!current || current.eventId !== top.id)
        throw new ReviewConflictError('invalid_state');
      const before = top.overrideBefore as any;
      if (before)
        await q.query(
          `UPDATE directory_listing_category_override SET "categoryId"=$3,"placeTypeId"=$4,active=$5,"caseId"=$6,"eventId"=$7,"updatedAt"=clock_timestamp()
           WHERE "communityId"=$1 AND "listingKey"=$2`,
          [
            c.communityId,
            c.listingKey,
            before.categoryId,
            before.placeTypeId ?? null,
            before.active === true,
            before.caseId ?? null,
            before.eventId ?? null,
          ]
        );
      else
        await q.query(
          `DELETE FROM directory_listing_category_override WHERE "communityId"=$1 AND "listingKey"=$2`,
          [c.communityId, c.listingKey]
        );
    }
    await applyEvent(q, c, {
      id: input.decisionId,
      action: 'undo',
      actorId: input.actorId,
      reason: input.reason,
      statusAfter: top.statusBefore,
      undoOf: input.undoOf,
    });
    if (top.action === 'assign')
      await refreshRowProjection(q, c.scanId, String(c.sourceFileRowNumber));
    return { replayed: false, status: top.statusBefore };
  });
}
