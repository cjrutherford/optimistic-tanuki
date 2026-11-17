import { createHash } from 'node:crypto';
import {
  assertFreshToken,
  IDEMPOTENCY_CONFLICT,
  NOT_LATEST,
  ReviewConflictError,
  versionToken,
} from './review-version';
import {
  evaluateOvertureFieldRights,
  type OvertureRightsOperation,
  type OvertureRightsPolicy,
} from './overture-rights';

/**
 * Rights cases (S7c). A case is one unresolved field/source lineage (or release or policy) that the rights
 * evaluation could not approve. An operator holding `directory.rights` records evidence and a decision.
 *
 * A decision NEVER grants public display. `confirm_terms` records the terms URL and SHA-256 an operator relied on;
 * `exclude_field` records that the field will not be used. Publication stays governed by the approved policy files
 * and signed provider grants (`provider-policy-authority.ts`), which this module neither reads for authority nor
 * writes. Nothing here touches the private rows, projections or served reads.
 *
 * Decisions follow the S7b contract: a version token the decider saw (`stale_decision`), an idempotent client
 * decision id (`decision_conflict` when reused with different input), an append-only history and an undo of the
 * latest effective decision (`not_latest`). `invalid_state` covers a decision the case cannot take (confirming terms
 * for an ambiguous source pointer, excluding a non-field case, and so on).
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const INVALID = 'Invalid rights decision';

export const RIGHTS_STATUSES = [
  'review',
  'excluded',
  'resolved',
  'withdrawn',
] as const;
export const RIGHTS_ACTIONS = [
  'exclude_field',
  'confirm_terms',
  'defer',
  'reopen',
] as const;
export type RightsAction = (typeof RIGHTS_ACTIONS)[number];
const UNDOABLE = new Set<string>(RIGHTS_ACTIONS);

export interface RightsHistoryEntry {
  readonly decisionId: string;
  readonly action: string;
  readonly actorId: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly statusBefore: string;
  readonly statusAfter: string;
  readonly evidence: { termsUrl: string; termsSha256: string } | null;
  readonly undoOf: string | null;
  readonly undoneBy: string | null;
  readonly reversible: boolean;
}

const CASE_COLUMNS = `c.id, c.scope, c."subjectKey", c.provider, c."releaseId", c.field, c.dataset, c.license,
  c."sourcePointer", c.ambiguous, c.reasons, c."observedRows", c.status, c."createdAt", c."updatedAt"`;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

function tokenOf(
  c: { id: string; status: string },
  events: readonly { id: string }[]
): string {
  return versionToken([
    'rights-case',
    c.id,
    c.status,
    events.length ? events[events.length - 1].id : null,
    events.length,
  ]);
}

/** Effective stack: an undo removes the decision it names. The top is the only reversible entry. */
function effective(events: readonly any[]): any[] {
  const stack: any[] = [];
  for (const e of events) {
    if (e.action === 'undo') {
      const i = stack.findIndex((x) => x.id === e.undoOf);
      if (i >= 0) stack.splice(i, 1);
    } else stack.push(e);
  }
  return stack;
}

function history(events: readonly any[]): RightsHistoryEntry[] {
  const undoneBy = new Map<string, string>();
  for (const e of events) if (e.action === 'undo') undoneBy.set(e.undoOf, e.id);
  const top = effective(events).at(-1);
  return events.map((e) => ({
    decisionId: e.id,
    action: e.action,
    actorId: e.actorId,
    reason: e.reason,
    createdAt: iso(e.createdAt),
    statusBefore: e.statusBefore,
    statusAfter: e.statusAfter,
    evidence: e.termsUrl
      ? { termsUrl: e.termsUrl, termsSha256: e.termsSha256 }
      : null,
    undoOf: e.undoOf ?? null,
    undoneBy: undoneBy.get(e.id) ?? null,
    reversible: !!top && top.id === e.id && UNDOABLE.has(e.action),
  }));
}

const EVENT_COLUMNS = `id,"caseId",action,"actorId",reason,"termsUrl","termsSha256","statusBefore","statusAfter","undoOf","createdAt"`;

async function readEvents(q: Q, caseId: string): Promise<any[]> {
  return q.query(
    `SELECT ${EVENT_COLUMNS} FROM directory_rights_event WHERE "caseId"=$1 ORDER BY "createdAt","id"`,
    [caseId]
  );
}

export interface RightsCaseSummary {
  id: string;
  scope: string;
  subjectKey: string;
  provider: string;
  releaseId: string | null;
  field: string | null;
  dataset: string | null;
  license: string | null;
  sourcePointer: string | null;
  ambiguous: boolean;
  reasons: string[];
  observedRows: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  versionToken: string;
}

const summary = (c: any, events: readonly any[]): RightsCaseSummary => ({
  id: c.id,
  scope: c.scope,
  subjectKey: c.subjectKey,
  provider: c.provider,
  releaseId: c.releaseId,
  field: c.field,
  dataset: c.dataset,
  license: c.license,
  sourcePointer: c.sourcePointer,
  ambiguous: c.ambiguous === true,
  reasons: Array.isArray(c.reasons) ? c.reasons : [],
  observedRows: Number(c.observedRows ?? 0),
  status: c.status,
  createdAt: iso(c.createdAt),
  updatedAt: iso(c.updatedAt),
  versionToken: tokenOf(c, events),
});

export async function listRightsCases(
  db: Q,
  options: { status?: string; limit?: number; offset?: number } = {}
): Promise<{ cases: RightsCaseSummary[] }> {
  const status = options.status;
  if (
    status !== undefined &&
    !(RIGHTS_STATUSES as readonly string[]).includes(status)
  )
    throw Error('Invalid status');
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw Error('Invalid limit');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
    throw Error('Invalid offset');
  const rows = await db.query(
    `SELECT ${CASE_COLUMNS},
       (SELECT e.id FROM directory_rights_event e WHERE e."caseId"=c.id ORDER BY e."createdAt" DESC, e.id DESC LIMIT 1) AS "latestEvent",
       (SELECT count(*)::int FROM directory_rights_event e WHERE e."caseId"=c.id) AS "eventCount"
     FROM directory_rights_case c WHERE ($1::text IS NULL OR c.status=$1)
     ORDER BY c."updatedAt" DESC, c.id LIMIT $2 OFFSET $3`,
    [status ?? null, limit, offset]
  );
  return {
    // The list token is built from the same facts as the detail token, so a list row's token decides directly.
    cases: rows.map((c: any) => ({
      ...summary(c, []),
      versionToken: versionToken([
        'rights-case',
        c.id,
        c.status,
        c.latestEvent ?? null,
        Number(c.eventCount),
      ]),
    })),
  };
}

export async function getRightsCase(
  db: Q,
  id: string
): Promise<(RightsCaseSummary & { history: RightsHistoryEntry[] }) | null> {
  if (!UUID.test(id)) throw Error('Invalid case');
  const [c] = await db.query(
    `SELECT ${CASE_COLUMNS} FROM directory_rights_case c WHERE c.id=$1`,
    [id]
  );
  if (!c) return null;
  const events = await readEvents(db, id);
  return { ...summary(c, events), history: history(events) };
}

/** Deterministic uuid-shaped id, so a replayed sync derives the same event ids. */
function derivedId(...parts: string[]): string {
  const h = createHash('sha256').update(parts.join('\u0000')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(
    17,
    20
  )}-${h.slice(20, 32)}`;
}

export interface SyncInput {
  readonly syncId: string;
  readonly actorId: string;
  readonly releaseId: string;
  readonly operation?: OvertureRightsOperation;
  /** Trusted, operator-loaded policy for the release; when absent every observed lineage needs review. */
  readonly policy?: OvertureRightsPolicy;
}
export interface SyncResult {
  readonly created: number;
  readonly existing: number;
  readonly lineages: number;
}

interface Lineage {
  readonly dataset: string;
  readonly license: string;
  readonly property: string | null;
  readonly rows: number;
}

/** Distinct source lineages retained in served private rows. Read-only; no network. */
async function observedLineages(q: Q): Promise<Lineage[]> {
  const rows = await q.query(
    `SELECT s->>'dataset' AS dataset, s->>'license' AS license, s->>'property' AS property, count(*)::int AS rows
     FROM directory_overture_private_row r
     JOIN directory_overture_private_membership m ON m."scanId"=r."scanId"
     JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false
     JOIN directory_overture_private_completion c ON c."scanId"=r."scanId",
     LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.listing->'sources')='array' THEN r.listing->'sources' ELSE '[]'::jsonb END) s
     WHERE NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=r."scanId")
       AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")
       AND jsonb_typeof(s)='object' AND s ? 'dataset' AND s ? 'license'
     GROUP BY 1,2,3 ORDER BY 1,2,3 LIMIT 2000`
  );
  return rows.map((r: any) => ({
    dataset: r.dataset,
    license: r.license,
    property: typeof r.property === 'string' ? r.property : null,
    rows: Number(r.rows),
  }));
}

interface Wanted {
  subjectKey: string;
  scope: string;
  field: string | null;
  dataset: string | null;
  license: string | null;
  sourcePointer: string | null;
  ambiguous: boolean;
  reasons: string[];
  observedRows: number;
}

/** Pure: the cases the current evaluation reports for the observed lineages. */
export function wantedCases(
  releaseId: string,
  lineages: readonly Lineage[],
  operation: OvertureRightsOperation,
  policy?: OvertureRightsPolicy
): Wanted[] {
  const wanted = new Map<string, Wanted>();
  const add = (w: Wanted) => {
    const prior = wanted.get(w.subjectKey);
    if (prior) {
      prior.observedRows += w.observedRows;
      for (const r of w.reasons)
        if (!prior.reasons.includes(r)) prior.reasons.push(r);
    } else wanted.set(w.subjectKey, w);
  };
  const approved =
    policy?.releaseId === releaseId &&
    policy.operations?.[operation] === true &&
    Array.isArray(policy.terms);
  if (!approved)
    add({
      subjectKey: `release|${releaseId}|${operation}`,
      scope: 'release',
      field: null,
      dataset: null,
      license: null,
      sourcePointer: null,
      ambiguous: false,
      reasons: ['operation_not_approved'],
      observedRows: lineages.reduce((n, l) => n + l.rows, 0),
    });
  for (const lineage of lineages) {
    const source = {
      dataset: lineage.dataset,
      license: lineage.license,
      ...(lineage.property === null ? {} : { property: lineage.property }),
    };
    const evaluation = evaluateOvertureFieldRights(
      { releaseId, sources: [source] },
      operation,
      policy
    );
    const whole = lineage.property === null || lineage.property === '';
    if (whole) {
      // A whole-record source overlaps every field, so it cannot be tied to one: a source-scope, ambiguous case.
      const reasons = Object.values(evaluation.fields).flatMap((f) =>
        f.reviewRequired ? [...f.reasons] : []
      );
      if (reasons.length)
        add({
          subjectKey: `source|${releaseId}|${lineage.dataset}|${lineage.license}|*`,
          scope: 'source',
          field: null,
          dataset: lineage.dataset,
          license: lineage.license,
          sourcePointer: lineage.property,
          ambiguous: true,
          reasons: [...new Set(reasons)],
          observedRows: lineage.rows,
        });
      continue;
    }
    for (const [field, decision] of Object.entries(evaluation.fields)) {
      if (!decision.reviewRequired || !decision.sources.length) continue;
      add({
        subjectKey: `field|${releaseId}|${field}|${lineage.dataset}|${lineage.license}`,
        scope: 'field',
        field,
        dataset: lineage.dataset,
        license: lineage.license,
        sourcePointer: lineage.property,
        ambiguous: false,
        reasons: [...decision.reasons],
        observedRows: lineage.rows,
      });
    }
  }
  return [...wanted.values()];
}

/**
 * Operator-triggered, idempotent, offline: opens a review case for every unresolved lineage the current
 * evaluation reports. Existing cases (any status) are left alone, so a decision is never reset by a re-sync.
 */
export async function syncRightsCases(
  db: Db,
  input: SyncInput
): Promise<SyncResult> {
  if (
    !UUID.test(input.syncId) ||
    !UUID.test(input.actorId) ||
    typeof input.releaseId !== 'string' ||
    !/^[A-Za-z0-9._-]{1,100}$/.test(input.releaseId)
  )
    throw Error('Invalid rights sync');
  const operation = input.operation ?? 'publicDisplay';
  return db.transaction(async (q) => {
    await q.query(
      `SELECT pg_advisory_xact_lock(hashtext('directory_rights_sync'))`
    );
    const lineages = await observedLineages(q);
    const wanted = wantedCases(
      input.releaseId,
      lineages,
      operation,
      input.policy
    );
    let created = 0;
    for (const w of wanted) {
      const inserted = await q.query(
        `INSERT INTO directory_rights_case (scope,"subjectKey",provider,"releaseId",field,dataset,license,"sourcePointer",ambiguous,reasons,"observedRows")
         VALUES ($1,$2,'overture',$3,$4,$5,$6,$7,$8,$9::jsonb,$10) ON CONFLICT ("subjectKey") DO NOTHING RETURNING id`,
        [
          w.scope,
          w.subjectKey,
          input.releaseId,
          w.field,
          w.dataset,
          w.license,
          w.sourcePointer,
          w.ambiguous,
          JSON.stringify(w.reasons),
          w.observedRows,
        ]
      );
      if (!inserted.length) continue;
      created++;
      await q.query(
        `INSERT INTO directory_rights_event (id,"caseId",action,"actorId",reason,"statusBefore","statusAfter","createdAt")
         VALUES ($1,$2,'open',$3,$4,'review','review',clock_timestamp())`,
        [
          derivedId(input.syncId, inserted[0].id),
          inserted[0].id,
          input.actorId,
          `Opened by rights sync ${input.syncId}`,
        ]
      );
    }
    return {
      created,
      existing: wanted.length - created,
      lineages: lineages.length,
    };
  });
}

export interface RightsDecisionInput {
  readonly decisionId: string;
  readonly caseId: string;
  readonly action: RightsAction;
  readonly actorId: string;
  readonly reason: string;
  readonly expectedVersionToken: string;
  readonly termsUrl?: string;
  readonly termsSha256?: string;
}

function httpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' && !!u.hostname && !u.username && !u.password
    );
  } catch {
    return false;
  }
}

function validateDecision(d: RightsDecisionInput): void {
  if (
    !UUID.test(d.decisionId) ||
    !UUID.test(d.caseId) ||
    !UUID.test(d.actorId) ||
    !(RIGHTS_ACTIONS as readonly string[]).includes(d.action) ||
    typeof d.reason !== 'string' ||
    !d.reason.trim() ||
    d.reason.length > 1024
  )
    throw Error(INVALID);
  const evidence = d.termsUrl !== undefined || d.termsSha256 !== undefined;
  if (d.action === 'confirm_terms') {
    if (!httpsUrl(d.termsUrl) || !HEX64.test(d.termsSha256 ?? ''))
      throw Error(INVALID);
  } else if (evidence) throw Error(INVALID);
}

export interface RightsDecisionResult {
  readonly replayed: boolean;
  readonly status: string;
}

/** Status a decision moves a case to, or an `invalid_state` conflict when the case cannot take it. */
function nextStatus(c: any, action: RightsAction): string {
  switch (action) {
    case 'exclude_field':
      // Excluding a field applies to a field lineage; a source, release or policy case has no single field to drop.
      if (c.scope !== 'field' || c.status !== 'review')
        throw new ReviewConflictError('invalid_state');
      return 'excluded';
    case 'confirm_terms':
      // Terms can be confirmed only for a source whose pointer maps to a field.
      if (c.ambiguous === true || c.status !== 'review')
        throw new ReviewConflictError('invalid_state');
      return 'resolved';
    case 'defer':
      if (c.status !== 'review') throw new ReviewConflictError('invalid_state');
      return 'review';
    case 'reopen':
      // Withdrawal is one-way; a withdrawn case stays withdrawn.
      if (c.status === 'review' || c.status === 'withdrawn')
        throw new ReviewConflictError('invalid_state');
      return 'review';
  }
}

async function lockCase(q: Q, id: string): Promise<any> {
  const [c] = await q.query(
    `SELECT ${CASE_COLUMNS} FROM directory_rights_case c WHERE c.id=$1 FOR UPDATE`,
    [id]
  );
  return c;
}

async function applyEvent(
  q: Q,
  c: any,
  e: {
    id: string;
    action: string;
    actorId: string;
    reason: string;
    termsUrl?: string | null;
    termsSha256?: string | null;
    statusAfter: string;
    undoOf?: string | null;
  }
): Promise<void> {
  await q.query(
    `INSERT INTO directory_rights_event (id,"caseId",action,"actorId",reason,"termsUrl","termsSha256","statusBefore","statusAfter","undoOf","createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,clock_timestamp())`,
    [
      e.id,
      c.id,
      e.action,
      e.actorId,
      e.reason,
      e.termsUrl ?? null,
      e.termsSha256 ?? null,
      c.status,
      e.statusAfter,
      e.undoOf ?? null,
    ]
  );
  await q.query(
    `UPDATE directory_rights_case SET status=$2,"updatedAt"=clock_timestamp() WHERE id=$1`,
    [c.id, e.statusAfter]
  );
}

export async function decideRightsCase(
  db: Db,
  input: RightsDecisionInput
): Promise<RightsDecisionResult> {
  validateDecision(input);
  return db.transaction(async (q) => {
    const c = await lockCase(q, input.caseId);
    if (!c) throw Error('Case not found');
    const [prior] = await q.query(
      `SELECT ${EVENT_COLUMNS} FROM directory_rights_event WHERE id=$1`,
      [input.decisionId]
    );
    if (prior) {
      if (
        prior.caseId !== input.caseId ||
        prior.action !== input.action ||
        prior.actorId !== input.actorId ||
        prior.reason !== input.reason ||
        (prior.termsUrl ?? undefined) !== input.termsUrl ||
        (prior.termsSha256 ?? undefined) !== input.termsSha256
      )
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return { replayed: true, status: prior.statusAfter };
    }
    const events = await readEvents(q, c.id);
    assertFreshToken(input.expectedVersionToken, tokenOf(c, events));
    const statusAfter = nextStatus(c, input.action);
    await applyEvent(q, c, {
      id: input.decisionId,
      action: input.action,
      actorId: input.actorId,
      reason: input.reason,
      termsUrl: input.termsUrl,
      termsSha256: input.termsSha256,
      statusAfter,
    });
    return { replayed: false, status: statusAfter };
  });
}

export interface RightsUndoInput {
  readonly decisionId: string;
  readonly caseId: string;
  readonly undoOf: string;
  readonly actorId: string;
  readonly reason: string;
  readonly expectedVersionToken: string;
}

/** Reverses the latest effective decision: the case returns to the status it held before that decision. */
export async function undoRightsDecision(
  db: Db,
  input: RightsUndoInput
): Promise<RightsDecisionResult> {
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
      `SELECT ${EVENT_COLUMNS} FROM directory_rights_event WHERE id=$1`,
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
    assertFreshToken(input.expectedVersionToken, tokenOf(c, events));
    const top = effective(events).at(-1);
    if (!top || top.id !== input.undoOf || !UNDOABLE.has(top.action))
      throw new ReviewConflictError(NOT_LATEST);
    await applyEvent(q, c, {
      id: input.decisionId,
      action: 'undo',
      actorId: input.actorId,
      reason: input.reason,
      statusAfter: top.statusBefore,
      undoOf: input.undoOf,
    });
    return { replayed: false, status: top.statusBefore };
  });
}

/** Called by the withdrawal worker in the completing transaction: a case tied to a withdrawal moves to `withdrawn`. */
export async function markRightsCaseWithdrawn(
  q: Q,
  input: { caseId: string; requestId: string; actorId: string; reason: string }
): Promise<void> {
  const c = await lockCase(q, input.caseId);
  if (!c || c.status === 'withdrawn') return;
  const [done] = await q.query(
    'SELECT 1 FROM directory_rights_event WHERE id=$1',
    [input.requestId]
  );
  if (done) return;
  await applyEvent(q, c, {
    id: input.requestId,
    action: 'withdraw',
    actorId: input.actorId,
    reason: input.reason,
    statusAfter: 'withdrawn',
  });
}
