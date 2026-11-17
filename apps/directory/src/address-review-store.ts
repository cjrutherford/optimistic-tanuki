import { unprojectBinding } from './reviewed-spatial';
import { assertDirectoryIdentitiesUnfenced } from './account-lifecycle-fence';
import {
  assertFreshToken,
  IDEMPOTENCY_CONFLICT,
  NOT_LATEST,
  ReviewConflictError,
  versionToken,
} from './review-version';
import { DataSource, EntityManager } from 'typeorm';
import type {
  AddressReviewDecision,
  AddressReviewRights,
  GeocodeEvidence,
  OfficialEvidence,
} from './address-review';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCAN = /^[a-f0-9]{64}$/;
const HASH = /^[a-f0-9]{64}$/;
const HUMAN_DECISIONS = new Set(['approve', 'reject', 'needs_info', 'revoke']);
const STATUSES = new Set([
  'needs_human',
  'auto_approved',
  'approved',
  'published',
  'rejected',
  'revoked',
  'archived',
]);

export interface AddressReviewCandidateInput {
  communityId: string;
  scanId: string;
  sourceRow: number;
  name: string;
  category: string;
  point: { lat: number; lng: number };
  addresses: readonly string[];
  websites?: readonly string[];
  phones?: readonly string[];
  rights: AddressReviewRights;
  risk: {
    residential?: boolean;
    sensitive?: boolean;
    adult?: boolean;
  };
  geocode?: GeocodeEvidence | null;
  officialEvidence?: OfficialEvidence | null;
  decision: AddressReviewDecision;
}

export interface AddressReviewCandidateRow {
  versionToken?: string;
  id: string;
  communityId: string;
  scanId: string;
  sourceFileRowNumber: string;
  name: string;
  category: string;
  point: unknown;
  addresses: unknown;
  websites: unknown;
  phones: unknown;
  rights: string;
  risk: unknown;
  geocode: unknown;
  officialEvidence: unknown;
  verdict: string;
  reasons: unknown;
  checks: unknown;
  policyVersion: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddressReviewHumanDecision {
  /** The caller's idempotency key; it becomes the decision row's primary key. */
  decisionId: string;
  /** The candidate's version token as the reviewer saw it; a mismatch under the lock is `stale_decision`. */
  expectedVersionToken: string;
  candidateId: string;
  actorId: string;
  decision: 'approve' | 'reject' | 'needs_info' | 'revoke';
  evidenceUrl?: string;
  evidenceHash?: string;
  reason?: string;
  checks?: Record<string, unknown>;
  policyVersion?: string;
}

function controlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function text(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= max &&
    !controlCharacters(value)
  );
}

function stringArray(value: unknown, max = 50): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= max &&
    value.every((entry) => text(entry, 2048))
  );
}

function point(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { lat?: unknown; lng?: unknown };
  return (
    typeof candidate.lat === 'number' &&
    typeof candidate.lng === 'number' &&
    Number.isFinite(candidate.lat) &&
    Number.isFinite(candidate.lng) &&
    Math.abs(candidate.lat) <= 90 &&
    Math.abs(candidate.lng) <= 180
  );
}

function validEvidenceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      host.includes('.') &&
      !/(?:^|\.)(localhost|local|internal)$/.test(host)
    );
  } catch {
    return false;
  }
}

function validateCandidate(input: AddressReviewCandidateInput): void {
  if (!UUID.test(input.communityId)) throw Error('Invalid community');
  if (!SCAN.test(input.scanId)) throw Error('Invalid scan');
  if (
    !Number.isSafeInteger(input.sourceRow) ||
    input.sourceRow < 0 ||
    input.sourceRow > Number.MAX_SAFE_INTEGER
  ) {
    throw Error('Invalid source row');
  }
  if (!text(input.name, 2000)) throw Error('Invalid name');
  if (!text(input.category, 2000)) throw Error('Invalid category');
  if (!point(input.point)) throw Error('Invalid point');
  if (!stringArray(input.addresses) || input.addresses.length === 0) {
    throw Error('Invalid addresses');
  }
  if (input.websites !== undefined && !stringArray(input.websites)) {
    throw Error('Invalid websites');
  }
  if (input.phones !== undefined && !stringArray(input.phones)) {
    throw Error('Invalid phones');
  }
  if (!['eligible', 'review', 'denied'].includes(input.rights)) {
    throw Error('Invalid rights');
  }
  if (!input.risk || typeof input.risk !== 'object') {
    throw Error('Invalid risk');
  }
  const decision = input.decision;
  if (
    !decision ||
    !['auto_approve', 'needs_human', 'reject'].includes(decision.verdict) ||
    !text(decision.policyVersion, 64) ||
    !Array.isArray(decision.reasons) ||
    !decision.checks ||
    typeof decision.checks !== 'object'
  ) {
    throw Error('Invalid decision');
  }
}

function statusFor(verdict: AddressReviewDecision['verdict']): string {
  return verdict === 'auto_approve'
    ? 'auto_approved'
    : verdict === 'reject'
    ? 'rejected'
    : 'needs_human';
}

function decisionFor(verdict: AddressReviewDecision['verdict']): string {
  return verdict === 'auto_approve'
    ? 'approve'
    : verdict === 'reject'
    ? 'reject'
    : 'needs_info';
}

// The classifier may still score evidence for analysis, but approval stays
// manual until the documented precision and town-containment gates are met.
function pauseAutomaticApproval(
  decision: AddressReviewDecision
): AddressReviewDecision {
  return decision.verdict === 'auto_approve'
    ? {
        ...decision,
        verdict: 'needs_human',
        reasons: [...decision.reasons, 'auto_approval_paused'],
      }
    : decision;
}

export async function storeAddressReviewCandidate(
  db: DataSource,
  input: AddressReviewCandidateInput
): Promise<{ id: string; status: string; verdict: string }> {
  validateCandidate(input);
  input = { ...input, decision: pauseAutomaticApproval(input.decision) };
  const status = statusFor(input.decision.verdict);
  const decision = decisionFor(input.decision.verdict);
  const evidenceUrl = input.officialEvidence?.url ?? null;
  const evidenceHash = input.officialEvidence?.evidenceHash ?? null;

  return db.transaction(async (manager) => {
    const rows = await manager.query(
      `INSERT INTO "directory_address_review_candidate"
        ("communityId","scanId","sourceFileRowNumber","name","category","point","addresses","websites","phones","rights","risk","geocode","officialEvidence","verdict","reasons","checks","policyVersion","status")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15::jsonb,$16::jsonb,$17,$18)
       ON CONFLICT ("scanId","sourceFileRowNumber") DO UPDATE SET
        "communityId"=EXCLUDED."communityId",
        "name"=EXCLUDED."name",
        "category"=EXCLUDED."category",
        "point"=EXCLUDED."point",
        "addresses"=EXCLUDED."addresses",
        "websites"=EXCLUDED."websites",
        "phones"=EXCLUDED."phones",
        "rights"=EXCLUDED."rights",
        "risk"=EXCLUDED."risk",
        "geocode"=EXCLUDED."geocode",
        "officialEvidence"=EXCLUDED."officialEvidence",
        "verdict"=EXCLUDED."verdict",
        "reasons"=EXCLUDED."reasons",
        "checks"=EXCLUDED."checks",
        "policyVersion"=EXCLUDED."policyVersion",
        "status"=EXCLUDED."status",
        "updatedAt"=CURRENT_TIMESTAMP
       WHERE "directory_address_review_candidate"."status" IN ('needs_human','auto_approved')
       RETURNING "id"`,
      [
        input.communityId,
        input.scanId,
        String(input.sourceRow),
        input.name.trim(),
        input.category.trim(),
        JSON.stringify(input.point),
        JSON.stringify(input.addresses),
        JSON.stringify(input.websites ?? []),
        JSON.stringify(input.phones ?? []),
        input.rights,
        JSON.stringify(input.risk),
        input.geocode ? JSON.stringify(input.geocode) : null,
        input.officialEvidence ? JSON.stringify(input.officialEvidence) : null,
        input.decision.verdict,
        JSON.stringify(input.decision.reasons),
        JSON.stringify(input.decision.checks),
        input.decision.policyVersion,
        status,
      ]
    );
    if (rows.length !== 1) throw Error('Cannot overwrite a reviewed candidate');
    const id = rows[0].id as string;
    await manager.query(
      `INSERT INTO "directory_address_review_decision"
        ("candidateId","actorKind","actorId","decision","evidenceUrl","evidenceHash","reason","checks","policyVersion","appliedAt")
       VALUES ($1,'auto',NULL,$2,$3,$4,NULL,$5::jsonb,$6,NULL)`,
      [
        id,
        decision,
        evidenceUrl,
        evidenceHash,
        JSON.stringify(input.decision.checks),
        input.decision.policyVersion,
      ]
    );
    return { id, status, verdict: input.decision.verdict };
  });
}

export async function updateAddressReviewEvidence(
  db: DataSource,
  input: {
    candidateId: string;
    geocode?: GeocodeEvidence | null;
    officialEvidence?: OfficialEvidence | null;
    risk?: {
      residential?: boolean;
      sensitive?: boolean;
      adult?: boolean;
    };
    rights?: AddressReviewRights;
    decision: AddressReviewDecision;
  }
): Promise<{ id: string; status: string; verdict: string }> {
  if (!UUID.test(input.candidateId)) throw Error('Invalid candidate');
  if (
    !input.decision ||
    !['auto_approve', 'needs_human', 'reject'].includes(
      input.decision.verdict
    ) ||
    !text(input.decision.policyVersion, 64) ||
    !Array.isArray(input.decision.reasons) ||
    !input.decision.checks ||
    typeof input.decision.checks !== 'object'
  ) {
    throw Error('Invalid decision');
  }
  input = { ...input, decision: pauseAutomaticApproval(input.decision) };
  if (
    input.risk !== undefined &&
    (!input.risk || typeof input.risk !== 'object' || Array.isArray(input.risk))
  ) {
    throw Error('Invalid risk');
  }
  if (
    input.rights !== undefined &&
    !['eligible', 'review', 'denied'].includes(input.rights)
  ) {
    throw Error('Invalid rights');
  }
  const status = statusFor(input.decision.verdict);
  const decision = decisionFor(input.decision.verdict);
  const evidenceUrl = input.officialEvidence?.url ?? null;
  const evidenceHash = input.officialEvidence?.evidenceHash ?? null;

  return db.transaction(async (manager) => {
    const candidate = await manager.query(
      'SELECT "id","status","verdict","risk","rights" FROM "directory_address_review_candidate" WHERE "id"=$1 FOR UPDATE',
      [input.candidateId]
    );
    if (candidate.length !== 1) throw Error('Candidate not found');
    const current = candidate[0];
    if (!['needs_human', 'auto_approved'].includes(current.status)) {
      throw Error(`Cannot refresh evidence for ${current.status} candidate`);
    }
    await manager.query(
      `UPDATE "directory_address_review_candidate"
       SET "geocode"=$2::jsonb,"officialEvidence"=$3::jsonb,"verdict"=$4,"reasons"=$5::jsonb,"checks"=$6::jsonb,"policyVersion"=$7,"status"=$8,"risk"=$9::jsonb,"rights"=$10,"updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1`,
      [
        input.candidateId,
        input.geocode ? JSON.stringify(input.geocode) : null,
        input.officialEvidence ? JSON.stringify(input.officialEvidence) : null,
        input.decision.verdict,
        JSON.stringify(input.decision.reasons),
        JSON.stringify(input.decision.checks),
        input.decision.policyVersion,
        status,
        JSON.stringify(input.risk ?? current.risk ?? {}),
        input.rights ?? current.rights,
      ]
    );
    if (
      current.verdict !== input.decision.verdict ||
      current.status !== status
    ) {
      await manager.query(
        `INSERT INTO "directory_address_review_decision"
          ("candidateId","actorKind","actorId","decision","evidenceUrl","evidenceHash","reason","checks","policyVersion","appliedAt")
         VALUES ($1,'auto',NULL,$2,$3,$4,NULL,$5::jsonb,$6,NULL)`,
        [
          input.candidateId,
          decision,
          evidenceUrl,
          evidenceHash,
          JSON.stringify(input.decision.checks),
          input.decision.policyVersion,
        ]
      );
    }
    return {
      id: input.candidateId,
      status,
      verdict: input.decision.verdict,
    };
  });
}

export async function listAddressReviewCandidates(
  db: DataSource,
  options: {
    communityId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<AddressReviewCandidateRow[]> {
  const communityId = options.communityId ?? null;
  if (communityId !== null && !UUID.test(communityId)) {
    throw Error('Invalid community');
  }
  const status = options.status ?? '';
  if (status && !STATUSES.has(status)) throw Error('Invalid status');
  const limit = options.limit ?? 25;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw Error('Invalid limit');
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw Error('Invalid offset');
  }
  const rows: AddressReviewCandidateRow[] = await db.query(
    `SELECT "id","communityId","scanId","sourceFileRowNumber","name","category","point","addresses","websites","phones","rights","risk","geocode","officialEvidence","verdict","reasons","checks","policyVersion","status","createdAt","updatedAt"
     FROM "directory_address_review_candidate"
     WHERE ($1::uuid IS NULL OR "communityId"=$1) AND ($2='' OR "status"=$2)
     ORDER BY "createdAt" DESC, "id"
     LIMIT $3 OFFSET $4`,
    [communityId, status, limit, offset]
  );
  const tokens = await addressVersionTokens(
    db,
    rows.map((row) => row.id)
  );
  return rows.map((row) => ({ ...row, versionToken: tokens.get(row.id) }));
}

type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };

/** Tokens over status, last write time, latest decision and decision count, read under the caller's lock if any. */
export async function addressVersionTokens(
  q: Q,
  candidateIds: readonly string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(candidateIds)].filter((id) => UUID.test(id));
  if (!ids.length) return out;
  const rows = await q.query(
    `SELECT c.id,c.status,c."updatedAt"::text AS "updatedAt",
       (SELECT d.id FROM "directory_address_review_decision" d WHERE d."candidateId"=c.id ORDER BY d."createdAt" DESC, d.id DESC LIMIT 1) AS latest,
       (SELECT count(*)::int FROM "directory_address_review_decision" d WHERE d."candidateId"=c.id) AS decisions
     FROM "directory_address_review_candidate" c WHERE c.id=ANY($1::uuid[])`,
    [ids]
  );
  for (const r of rows)
    out.set(
      r.id,
      versionToken([
        'address',
        r.id,
        r.status,
        r.updatedAt,
        r.latest,
        r.decisions,
      ])
    );
  return out;
}

export interface AddressHistoryEntry {
  decisionId: string;
  actorKind: string;
  actorId: string | null;
  decision: string;
  reason: string | null;
  createdAt: string;
  undoOf: string | null;
  undoneBy: string | null;
  reversible: boolean;
}

/** The status each human decision leaves a candidate in; an undo applies only while the candidate is still there. */
const UNDOABLE_STATUS: Record<string, string[]> = {
  approve: ['approved', 'published'],
  reject: ['rejected'],
  needs_info: ['needs_human'],
  revoke: ['revoked'],
};

/** One candidate with its decision history, oldest first. Only the latest non-undone human decision is reversible. */
export async function getAddressReviewCandidate(
  db: Q,
  communityId: string,
  candidateId: string
): Promise<
  (AddressReviewCandidateRow & { history: AddressHistoryEntry[] }) | null
> {
  if (!UUID.test(communityId) || !UUID.test(candidateId)) return null;
  const [row] = await db.query(
    `SELECT "id","communityId","scanId","sourceFileRowNumber","name","category","point","addresses","websites","phones","rights","risk","geocode","officialEvidence","verdict","reasons","checks","policyVersion","status","createdAt","updatedAt"
     FROM "directory_address_review_candidate" WHERE "id"=$1 AND "communityId"=$2`,
    [candidateId, communityId]
  );
  if (!row) return null;
  const decisions = await db.query(
    `SELECT d.id,d."actorKind",d."actorId",d.decision,d.reason,d."createdAt"::text AS "createdAt",d."undoOf",
        (SELECT u.id FROM "directory_address_review_decision" u WHERE u."undoOf"=d.id) AS "undoneBy"
       FROM "directory_address_review_decision" d WHERE d."candidateId"=$1 ORDER BY d."createdAt", d.id`,
    [candidateId]
  );
  let latest: string | null = null;
  for (const d of decisions)
    if (
      d.actorKind === 'human' &&
      d.decision !== 'undo' &&
      !d.undoOf &&
      !d.undoneBy
    )
      latest = d.id;
  const token = (await addressVersionTokens(db, [candidateId])).get(
    candidateId
  );
  return {
    ...row,
    versionToken: token,
    history: decisions.map((d: any) => ({
      decisionId: d.id,
      actorKind: d.actorKind,
      actorId: d.actorId,
      decision: d.decision,
      reason: d.reason,
      createdAt: d.createdAt,
      undoOf: d.undoOf,
      undoneBy: d.undoneBy,
      reversible:
        d.id === latest &&
        (UNDOABLE_STATUS[d.decision]?.includes(row.status) ?? false),
    })),
  };
}

/** Preserve unresolved local review records without treating them as active work. */
export async function archiveUnanchoredAddressReviewCandidate(
  db: DataSource,
  candidateId: string,
  transactionManager?: EntityManager
): Promise<{ candidateId: string; status: 'archived' }> {
  if (!UUID.test(candidateId)) throw Error('Invalid candidate');
  const archive = async (manager: EntityManager) => {
    const rows = await manager.query(
      'SELECT "id","status","scanId","sourceFileRowNumber" FROM "directory_address_review_candidate" WHERE "id"=$1 FOR UPDATE',
      [candidateId]
    );
    if (rows.length !== 1) throw Error('Candidate not found');
    const candidate = rows[0];
    if (candidate.status === 'archived')
      return { candidateId, status: 'archived' as const };
    if (!['needs_human', 'rejected'].includes(candidate.status))
      throw Error('Only unresolved candidates can be archived');
    const source = await manager.query(
      'SELECT 1 FROM "directory_overture_private_row" WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
      [candidate.scanId, candidate.sourceFileRowNumber]
    );
    if (source.length) throw Error('Candidate has an anchored source row');
    await manager.query(
      'UPDATE "directory_address_review_candidate" SET "status"=\'archived\',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
      [candidateId]
    );
    await manager.query(
      `INSERT INTO "directory_address_review_decision" ("candidateId","actorKind","decision","reason","checks","policyVersion","appliedAt") VALUES ($1,'system','archive','User-authorized archival of unresolved source identity',$2::jsonb,'local-unresolved-archive-v1',CURRENT_TIMESTAMP)`,
      [
        candidateId,
        JSON.stringify({
          previousStatus: candidate.status,
          scanId: candidate.scanId,
          sourceFileRowNumber: candidate.sourceFileRowNumber,
        }),
      ]
    );
    return { candidateId, status: 'archived' as const };
  };
  return transactionManager
    ? archive(transactionManager)
    : db.transaction(archive);
}

export async function recordHumanAddressReviewDecision(
  db: DataSource,
  input: AddressReviewHumanDecision
): Promise<{ candidateId: string; status: string; replayed: boolean }> {
  if (!UUID.test(input.candidateId)) throw Error('Invalid candidate');
  if (!UUID.test(input.decisionId ?? '')) throw Error('Invalid decision id');
  if (!UUID.test(input.actorId)) throw Error('Invalid reviewer');
  if (!HUMAN_DECISIONS.has(input.decision)) throw Error('Invalid decision');
  if (input.evidenceHash && !HASH.test(input.evidenceHash)) {
    throw Error('Invalid evidence hash');
  }
  if (input.decision === 'approve' && !validEvidenceUrl(input.evidenceUrl)) {
    throw Error('Approval requires an HTTPS evidence URL');
  }
  if (
    input.evidenceUrl !== undefined &&
    input.evidenceUrl !== '' &&
    !validEvidenceUrl(input.evidenceUrl)
  ) {
    throw Error('Invalid evidence URL');
  }
  if (input.reason && input.reason.length > 2048) throw Error('Invalid reason');
  const checks = input.checks ?? {};
  const policyVersion = input.policyVersion ?? 'address-review-human-v1';
  if (!text(policyVersion, 64)) throw Error('Invalid policy version');
  const status =
    input.decision === 'approve'
      ? 'approved'
      : input.decision === 'reject'
      ? 'rejected'
      : input.decision === 'revoke'
      ? 'revoked'
      : 'needs_human';

  return db.transaction(async (manager) => {
    await assertDirectoryIdentitiesUnfenced(manager, [input.actorId]);
    const candidate = await manager.query(
      'SELECT "id","status","communityId","scanId","sourceFileRowNumber","name","category","point" FROM "directory_address_review_candidate" WHERE "id"=$1 FOR UPDATE',
      [input.candidateId]
    );
    if (candidate.length !== 1) throw Error('Candidate not found');
    const [prior] = await manager.query(
      'SELECT * FROM "directory_address_review_decision" WHERE "id"=$1',
      [input.decisionId]
    );
    if (prior) {
      if (
        prior.candidateId !== input.candidateId ||
        prior.actorKind !== 'human' ||
        prior.undoOf !== null ||
        prior.decision !== input.decision ||
        prior.actorId !== input.actorId ||
        (prior.reason ?? null) !== (input.reason || null) ||
        (prior.evidenceUrl ?? null) !== (input.evidenceUrl || null) ||
        (prior.evidenceHash ?? null) !== (input.evidenceHash || null)
      )
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return {
        candidateId: input.candidateId,
        status: candidate[0].status as string,
        replayed: true,
      };
    }
    assertFreshToken(
      input.expectedVersionToken,
      (await addressVersionTokens(manager, [input.candidateId])).get(
        input.candidateId
      ) as string
    );
    const current = candidate[0].status as string;
    const allowed =
      input.decision === 'revoke'
        ? current === 'approved' ||
          current === 'auto_approved' ||
          current === 'published'
        : current === 'needs_human';
    if (!allowed) {
      throw new ReviewConflictError(
        'invalid_state',
        'Invalid decision for current candidate status'
      );
    }
    if (input.decision === 'revoke' && current === 'published') {
      await withdrawPublication(manager, candidate[0]);
    }
    const [recorded] = await manager.query(
      `INSERT INTO "directory_address_review_decision"
        ("id","candidateId","actorKind","actorId","decision","evidenceUrl","evidenceHash","reason","checks","policyVersion","appliedAt","createdAt")
       VALUES ($10,$1,'human',$2,$3,$4,$5,$6,$7::jsonb,$8,CASE WHEN $9 THEN CURRENT_TIMESTAMP ELSE NULL END,clock_timestamp())
       RETURNING "id"`,
      [
        input.candidateId,
        input.actorId,
        input.decision,
        input.evidenceUrl || null,
        input.evidenceHash || null,
        input.reason || null,
        JSON.stringify(checks),
        policyVersion,
        input.decision === 'revoke' && current === 'published',
        input.decisionId,
      ]
    );
    if (input.decision === 'revoke' && current === 'published') {
      await retireBindings(
        manager,
        input.candidateId,
        recorded.id,
        'human_revoke'
      );
    }
    await manager.query(
      'UPDATE "directory_address_review_candidate" SET "status"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
      [input.candidateId, status]
    );
    return { candidateId: input.candidateId, status, replayed: false };
  });
}

type CandidateAnchor = {
  communityId: string;
  scanId: string;
  sourceFileRowNumber: string;
  name: string;
  category: string;
  point: { lat?: number; lng?: number } | null;
};

/** Takes the publication locks (fence -> candidate -> binding -> policy -> scan -> row) and strips reviewed fields. */
async function withdrawPublication(
  manager: EntityManager,
  row: CandidateAnchor
): Promise<void> {
  // Lock order: fence -> candidate -> binding -> policy -> scan -> row (publish takes the same order).
  await manager.query(
    `SELECT "id" FROM "directory_reviewed_binding" WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "state"<>'retired' FOR UPDATE`,
    [row.scanId, row.sourceFileRowNumber]
  );
  const [membership] = await manager.query(
    'SELECT "policyId" FROM "directory_overture_private_membership" WHERE "scanId"=$1',
    [row.scanId]
  );
  if (membership)
    await manager.query(
      'SELECT 1 FROM "directory_overture_private_policy" WHERE "policyId"=$1 FOR UPDATE',
      [membership.policyId]
    );
  await manager.query(
    'SELECT 1 FROM "directory_overture_private_scan_lock" WHERE "scanId"=$1 FOR UPDATE',
    [row.scanId]
  );
  const removed = await manager.query(
    `WITH removed AS (UPDATE "directory_overture_private_row" SET listing=listing-'reviewed'
     WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "regionId"=$3
       AND btrim(listing->>'name')=$4 AND listing->>'category'=$5
       AND abs((listing->'location'->'coordinates'->>0)::float8-$6)<0.000001
       AND abs((listing->'location'->'coordinates'->>1)::float8-$7)<0.000001
       AND listing ? 'reviewed' RETURNING 1) SELECT count(*)::int AS count FROM removed`,
    [
      row.scanId,
      row.sourceFileRowNumber,
      row.communityId,
      row.name,
      row.category,
      row.point?.lng,
      row.point?.lat,
    ]
  );
  if (removed[0]?.count !== 1)
    throw Error('Published candidate does not match its reviewed source row');
}

/** Retires the candidate's bindings and removes them from the spatial index; run after the decision row exists. */
async function retireBindings(
  manager: EntityManager,
  candidateId: string,
  decisionId: string,
  cause: 'human_revoke' | 'human_undo'
): Promise<void> {
  const retired = await manager.query(
    `WITH retired AS (UPDATE "directory_reviewed_binding" SET "state"='retired',"stateCause"=$2,"retiredAt"=CURRENT_TIMESTAMP
     WHERE "candidateId"=$1 AND "state"<>'retired' RETURNING "id") SELECT "id" FROM retired`,
    [candidateId, cause]
  );
  for (const binding of retired) {
    await unprojectBinding(manager, binding.id);
    await manager.query(
      `INSERT INTO "directory_reviewed_binding_event" ("bindingId","kind","cause","decisionId") VALUES ($1,'retired',$2,$3)`,
      [binding.id, cause, decisionId]
    );
  }
}

export interface AddressUndoInput {
  /** The undo's own idempotency key. */
  decisionId: string;
  candidateId: string;
  /** The human decision being reversed; it must be the latest non-undone one. */
  undoOf: string;
  expectedVersionToken: string;
  actorId: string;
  reason: string;
}

/**
 * Reverses the latest non-undone human decision on a candidate. The original row is never edited; the undo is a
 * new row naming it, so it reads as undone. Effects: reject/needs_info/revoke return the candidate to
 * `needs_human`; approve behaves as a revoke (a published binding is retired and unprojected through the same
 * path as `revoke`, leaving the candidate `revoked`, which is itself an undoable revoke back to `needs_human`).
 * Nothing here republishes: an undone revoke returns to review and publication stays paused.
 */
export async function undoAddressReviewDecision(
  db: DataSource,
  input: AddressUndoInput
): Promise<{ candidateId: string; status: string; replayed: boolean }> {
  if (
    !UUID.test(input.candidateId ?? '') ||
    !UUID.test(input.decisionId ?? '') ||
    !UUID.test(input.undoOf ?? '') ||
    !UUID.test(input.actorId ?? '') ||
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.length > 2048
  )
    throw Error('Invalid undo');
  return db.transaction(async (manager) => {
    await assertDirectoryIdentitiesUnfenced(manager, [input.actorId]);
    const candidate = await manager.query(
      'SELECT "id","status","communityId","scanId","sourceFileRowNumber","name","category","point" FROM "directory_address_review_candidate" WHERE "id"=$1 FOR UPDATE',
      [input.candidateId]
    );
    if (candidate.length !== 1) throw Error('Candidate not found');
    const [prior] = await manager.query(
      'SELECT * FROM "directory_address_review_decision" WHERE "id"=$1',
      [input.decisionId]
    );
    if (prior) {
      if (
        prior.candidateId !== input.candidateId ||
        prior.undoOf !== input.undoOf ||
        prior.actorId !== input.actorId ||
        prior.reason !== input.reason
      )
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return {
        candidateId: input.candidateId,
        status: candidate[0].status as string,
        replayed: true,
      };
    }
    assertFreshToken(
      input.expectedVersionToken,
      (await addressVersionTokens(manager, [input.candidateId])).get(
        input.candidateId
      ) as string
    );
    const [latest] = await manager.query(
      `SELECT d.* FROM "directory_address_review_decision" d
        WHERE d."candidateId"=$1 AND d."actorKind"='human' AND d.decision<>'undo' AND d."undoOf" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "directory_address_review_decision" u WHERE u."undoOf"=d.id)
        ORDER BY d."createdAt" DESC, d.id DESC LIMIT 1`,
      [input.candidateId]
    );
    if (!latest || latest.id !== input.undoOf)
      throw new ReviewConflictError(NOT_LATEST);
    const current = candidate[0].status as string;
    // The candidate must still be in the state the decision left it in, or something else has moved it.
    if (!UNDOABLE_STATUS[latest.decision]?.includes(current))
      throw new ReviewConflictError(NOT_LATEST);
    const unpublish = latest.decision === 'approve';
    const published = unpublish && current === 'published';
    if (published) await withdrawPublication(manager, candidate[0]);
    await manager.query(
      `INSERT INTO "directory_address_review_decision"
        ("id","candidateId","actorKind","actorId","decision","reason","checks","policyVersion","appliedAt","undoOf","createdAt")
       VALUES ($1,$2,'human',$3,$4,$5,$6::jsonb,'address-review-undo-v1',CASE WHEN $7 THEN CURRENT_TIMESTAMP ELSE NULL END,$8,clock_timestamp())`,
      [
        input.decisionId,
        input.candidateId,
        input.actorId,
        unpublish ? 'revoke' : 'undo',
        input.reason,
        JSON.stringify({ undoOf: latest.id, undid: latest.decision }),
        published,
        latest.id,
      ]
    );
    if (published)
      await retireBindings(
        manager,
        input.candidateId,
        input.decisionId,
        'human_undo'
      );
    const status = unpublish ? 'revoked' : 'needs_human';
    await manager.query(
      'UPDATE "directory_address_review_candidate" SET "status"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
      [input.candidateId, status]
    );
    return { candidateId: input.candidateId, status, replayed: false };
  });
}
