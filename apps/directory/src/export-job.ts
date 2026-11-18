import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { join } from 'node:path';
import {
  evaluateOvertureFieldRights,
  OvertureRightsEvaluation,
  OvertureRightsPolicy,
} from './overture-rights';
import { isPaused } from './operating-controls';

/**
 * Operator export (S8). A job is a durable row; the Directory's own worker reads the served private rows, applies
 * the independent `export` rights grant, and writes one JSONL artifact outside the database. Nothing here reads a
 * `publicDisplay` or `privateDisplay` approval: only `operations.export` and per-field `export` permissions count.
 * Errors that leave this module carry only machine codes, never a filesystem path or a message from a dependency.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RELEASE = /^[A-Za-z0-9._-]{1,100}$/;
export const EXPORT_SCHEMA = 'town-square-directory-export/v1';
export const EXPORT_STATUSES = [
  'queued',
  'running',
  'complete',
  'failed',
  'expired',
  'withdrawn',
  'revoked',
] as const;
export const EXPORT_MAX_ATTEMPTS = 3;
export const EXPORT_LEASE_MS = 120_000;
const DEFAULT_RETENTION_HOURS = 24;
const INVALID = 'Invalid export request';

export class ExportConflictError extends Error {
  constructor(readonly code: 'idempotency_mismatch' | 'invalid_state') {
    super(code);
    this.name = 'ExportConflictError';
  }
}
/** The runtime has no export directory configured; routes answer 503. */
export class ExportUnavailableError extends Error {
  constructor() {
    super('Export unavailable');
    this.name = 'ExportUnavailableError';
  }
}
class ExportError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) {
    super(code);
  }
}

export interface ExportJobRecord {
  id: string;
  actorId: string;
  releaseId: string;
  scope: { communityId?: string };
  format: string;
  status: string;
  attempts: number;
  errorCode: string | null;
  rowCount: number;
  excludedRows: number;
  byteCount: number;
  sha256: string | null;
  schemaVersion: string;
  scanCount: number;
  expiresAt: string | null;
  completedAt: string | null;
  withdrawnAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const isoOrNull = (v: unknown) => (v ? iso(v) : null);
const COLUMNS = `id,"actorId","releaseId",scope,format,"requestHash",status,attempts,"leaseToken","leaseExpiresAt","errorCode","rowCount","excludedRows","byteCount",sha256,"artifactName","schemaVersion","scanIds","exportedSources","expiresAt","completedAt","withdrawnAt","revokedAt","createdAt","updatedAt"`;
const record = (r: any): ExportJobRecord => ({
  id: r.id,
  actorId: r.actorId,
  releaseId: r.releaseId,
  scope: r.scope && typeof r.scope === 'object' ? r.scope : {},
  format: r.format,
  status: r.status,
  attempts: Number(r.attempts),
  errorCode: r.errorCode ?? null,
  rowCount: Number(r.rowCount),
  excludedRows: Number(r.excludedRows),
  byteCount: Number(r.byteCount),
  sha256: r.sha256 ?? null,
  schemaVersion: r.schemaVersion,
  scanCount: Array.isArray(r.scanIds) ? r.scanIds.length : 0,
  expiresAt: isoOrNull(r.expiresAt),
  completedAt: isoOrNull(r.completedAt),
  withdrawnAt: isoOrNull(r.withdrawnAt),
  revokedAt: isoOrNull(r.revokedAt),
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
});
/** TypeORM returns `[rows, affected]` for UPDATE ... RETURNING; a plain driver returns rows. */
const rowsOf = (result: any): any[] =>
  Array.isArray(result?.[0]) ? result[0] : result ?? [];

// ---------------------------------------------------------------------------------------------------------------
// Pure projection
// ---------------------------------------------------------------------------------------------------------------

type RightsField = keyof OvertureRightsEvaluation['fields'] & string;
/** Export key -> the listing key it copies and the rights fields that must ALL be eligible. */
export const EXPORT_FIELDS: ReadonlyArray<{
  readonly key:
    | 'name'
    | 'category'
    | 'location'
    | 'address'
    | 'phone'
    | 'website';
  readonly required: boolean;
  readonly rights: readonly RightsField[];
}> = [
  { key: 'name', required: true, rights: ['name'] },
  {
    key: 'category',
    required: true,
    rights: ['basic_category', 'primary', 'hierarchy'],
  },
  { key: 'location', required: true, rights: ['geometry'] },
  { key: 'address', required: false, rights: ['address'] },
  { key: 'phone', required: false, rights: ['phone'] },
  { key: 'website', required: false, rights: ['website'] },
];
const NON_EXPORTABLE = /geoapify/i;
const nonExportable = (source: { provider?: unknown; dataset?: unknown }) =>
  (typeof source?.provider === 'string' &&
    NON_EXPORTABLE.test(source.provider)) ||
  (typeof source?.dataset === 'string' && NON_EXPORTABLE.test(source.dataset));

export interface ExportFieldProvenance {
  datasets: Array<{ dataset: string; license: string }>;
  attributions: string[];
  termsUrls: string[];
  notices: string[];
}
export type ExportProjection =
  | { included: false; reason: 'adult' | 'required_fields' }
  | {
      included: true;
      fields: Record<string, unknown>;
      provenance: Record<string, ExportFieldProvenance>;
    };

/**
 * Applies the field allowlist, the non-exportable provider denial, adult exclusion and per-field provenance to one
 * listing. `evaluationFor` returns the `export` rights evaluation of the listing's own sources. No key outside the
 * allowlist is ever copied, so `assignmentChangeToken`, raw `sources` and ids cannot leak.
 */
export function projectExportRow(
  listing: Record<string, unknown>,
  evaluationFor: (listing: Record<string, unknown>) => OvertureRightsEvaluation
): ExportProjection {
  if (!listing || typeof listing !== 'object' || listing['adult'] === true)
    return { included: false, reason: 'adult' };
  const evaluation = evaluationFor(listing);
  const fields: Record<string, unknown> = {};
  const provenance: Record<string, ExportFieldProvenance> = {};
  for (const { key, required, rights } of EXPORT_FIELDS) {
    const decisions = rights.map((r) => evaluation.fields[r]);
    const ok =
      listing[key] !== undefined &&
      listing[key] !== null &&
      decisions.every(
        (d) =>
          d?.status === 'eligible' &&
          !(d.sources as ReadonlyArray<any>).some(nonExportable)
      );
    if (!ok) {
      if (required) return { included: false, reason: 'required_fields' };
      continue;
    }
    const seen = new Set<string>();
    const datasets: ExportFieldProvenance['datasets'] = [];
    for (const d of decisions)
      for (const s of d.sources as ReadonlyArray<any>) {
        if (typeof s?.dataset !== 'string' || typeof s?.license !== 'string')
          continue;
        const id = JSON.stringify([s.dataset, s.license]);
        if (seen.has(id)) continue;
        seen.add(id);
        datasets.push({ dataset: s.dataset, license: s.license });
      }
    const union = (
      pick: (d: (typeof decisions)[number]) => readonly string[]
    ) => [...new Set(decisions.flatMap(pick))];
    fields[key] = listing[key];
    provenance[key] = {
      datasets,
      attributions: union((d) => d.attributions),
      termsUrls: union((d) => d.termsUrls),
      notices: union((d) => d.notices),
    };
  }
  return { included: true, fields, provenance };
}

// ---------------------------------------------------------------------------------------------------------------
// Rights exclusions and revocation
// ---------------------------------------------------------------------------------------------------------------

export interface FieldExclusion {
  readonly field: string;
  readonly dataset: string;
  readonly license: string;
}
/** What an artifact carries, per source term: the export keys that source's data supplied. */
export interface ExportedSource {
  dataset: string;
  license: string;
  fields: string[];
}
export const EXPORT_REVOKE_FIELD_EXCLUDED = 'rights_field_excluded';
export const EXPORT_REVOKE_POLICY = 'policy_revoked';

/** The export keys a rights field feeds. `alternate` and `id` are never exported. */
export function exportKeysForRightsField(field: string): string[] {
  return EXPORT_FIELDS.filter((f) =>
    (f.rights as readonly string[]).includes(field)
  ).map((f) => f.key);
}

/** Open `exclude_field` rights decisions for a release. An undone or reopened case is no longer excluded. */
export async function loadFieldExclusions(
  q: Q,
  releaseId: string
): Promise<FieldExclusion[]> {
  return rowsOf(
    await q.query(
      `SELECT field,dataset,license FROM directory_rights_case WHERE status='excluded' AND scope='field' AND "releaseId"=$1`,
      [releaseId]
    )
  ).filter(
    (r) =>
      typeof r?.field === 'string' &&
      typeof r?.dataset === 'string' &&
      typeof r?.license === 'string'
  );
}

/**
 * Denies a field wherever one of its sources is the excluded dataset/license, so a later export or public download
 * cannot bring back what an operator decided not to use.
 */
export function applyFieldExclusions(
  evaluation: OvertureRightsEvaluation,
  exclusions: readonly FieldExclusion[]
): OvertureRightsEvaluation {
  if (!exclusions.length) return evaluation;
  const fields = { ...evaluation.fields };
  for (const ex of exclusions) {
    const d = fields[ex.field];
    if (
      d &&
      d.status === 'eligible' &&
      (d.sources as ReadonlyArray<any>).some(
        (s) => s?.dataset === ex.dataset && s?.license === ex.license
      )
    )
      fields[ex.field] = {
        ...d,
        status: 'omitted',
        reviewRequired: true,
        impact: 'omit_field',
        reasons: ['operation_not_approved'],
        attributions: [],
        termsUrls: [],
        notices: [],
      };
  }
  return { ...evaluation, eligible: false, fields };
}

function sourcesOf(job: { exportedSources?: unknown }): ExportedSource[] {
  return Array.isArray(job.exportedSources)
    ? (job.exportedSources as ExportedSource[]).filter(
        (s) => s && typeof s.dataset === 'string' && Array.isArray(s.fields)
      )
    : [];
}

/** Marks the given jobs `revoked`; their files are deleted now when `dir` is given, otherwise by the next sweep. */
async function revokeJobs(
  q: Q,
  ids: readonly string[],
  reason: string,
  dir?: string
): Promise<number> {
  if (!ids.length) return 0;
  const rows = rowsOf(
    await q.query(
      `UPDATE directory_export_job SET status='revoked',"revokedAt"=clock_timestamp(),"errorCode"=$2,"updatedAt"=clock_timestamp(),"leaseToken"=NULL
       WHERE status='complete' AND id = ANY($1::uuid[]) RETURNING "artifactName"`,
      [[...ids], reason]
    )
  );
  const names = rows
    .map((r) => r.artifactName)
    .filter((n): n is string => typeof n === 'string');
  if (dir && names.length) {
    await removeExportFiles(dir, names);
    await q.query(
      `UPDATE directory_export_job SET "artifactName"=NULL WHERE status='revoked' AND "artifactName" = ANY($1::text[])`,
      [names]
    );
  }
  return rows.length;
}

/**
 * Revokes every complete artifact of `releaseId` that carries the excluded field from the excluded source, the same
 * way a completed withdrawal does. An artifact with no recorded sources (written before they were recorded) is
 * treated as carrying everything. Idempotent: only `complete` jobs change.
 */
export async function revokeExportsForExclusion(
  q: Q,
  input: FieldExclusion & { releaseId: string; dir?: string }
): Promise<number> {
  const keys = exportKeysForRightsField(input.field);
  if (!keys.length || !input.releaseId) return 0;
  const jobs = rowsOf(
    await q.query(
      `SELECT id,"exportedSources" FROM directory_export_job WHERE status='complete' AND "releaseId"=$1`,
      [input.releaseId]
    )
  );
  const hit = jobs.filter((j) => {
    const sources = sourcesOf(j);
    return (
      !sources.length ||
      sources.some(
        (s) =>
          s.dataset === input.dataset &&
          s.license === input.license &&
          s.fields.some((f) => keys.includes(f))
      )
    );
  });
  return revokeJobs(
    q,
    hit.map((j) => j.id),
    EXPORT_REVOKE_FIELD_EXCLUDED,
    input.dir
  );
}

/**
 * Re-checks every complete artifact against the current policy and exclusions: a policy that is gone, no longer
 * grants `export`, or whose source term no longer lists a field the artifact carries revokes it, and so does an
 * open `exclude_field` decision for a field and source it carries. Idempotent; the worker runs it every tick.
 */
export async function revokeStaleExports(
  q: Q,
  input: {
    policyFor: (releaseId: string) => OvertureRightsPolicy | undefined;
    dir?: string;
  }
): Promise<{ policy: number; excluded: number }> {
  const jobs = rowsOf(
    await q.query(
      `SELECT id,"releaseId","exportedSources" FROM directory_export_job WHERE status='complete'`
    )
  );
  const exclusions = new Map<string, FieldExclusion[]>();
  const policyIds: string[] = [];
  const excludedIds: string[] = [];
  for (const job of jobs) {
    const policy = input.policyFor(job.releaseId);
    const sources = sourcesOf(job);
    const everything = EXPORT_FIELDS.map((f) => f.key as string);
    let permitted = !!policy && policy.operations?.export === true;
    if (permitted)
      for (const s of sources.length
        ? sources
        : [{ dataset: '', license: '', fields: everything }]) {
        const terms = (policy!.terms ?? []).filter(
          (t) =>
            !sources.length ||
            (t.dataset === s.dataset && t.license === s.license)
        );
        for (const key of s.fields) {
          const rights = EXPORT_FIELDS.find((f) => f.key === key)?.rights ?? [];
          const ok = terms.some((t) =>
            rights.every((r) =>
              (
                t.permissions?.export as readonly string[] | undefined
              )?.includes(r)
            )
          );
          if (!ok) permitted = false;
        }
      }
    if (!permitted) {
      policyIds.push(job.id);
      continue;
    }
    if (!exclusions.has(job.releaseId))
      exclusions.set(
        job.releaseId,
        await loadFieldExclusions(q, job.releaseId)
      );
    const hit = exclusions.get(job.releaseId)!.some((ex) => {
      const keys = exportKeysForRightsField(ex.field);
      return (
        !sources.length ||
        sources.some(
          (s) =>
            s.dataset === ex.dataset &&
            s.license === ex.license &&
            s.fields.some((f) => keys.includes(f))
        )
      );
    });
    if (hit) excludedIds.push(job.id);
  }
  return {
    policy: await revokeJobs(q, policyIds, EXPORT_REVOKE_POLICY, input.dir),
    excluded: await revokeJobs(
      q,
      excludedIds,
      EXPORT_REVOKE_FIELD_EXCLUDED,
      input.dir
    ),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Job lifecycle
// ---------------------------------------------------------------------------------------------------------------

export interface ExportCreateInput {
  readonly id: string;
  readonly actorId: string;
  readonly releaseId: string;
  readonly communityId?: string;
}

const requestHash = (releaseId: string, scope: { communityId?: string }) =>
  createHash('sha256')
    .update(JSON.stringify({ format: 'jsonl', releaseId, scope }))
    .digest('hex');

/** Idempotent on `id`: the same request replays the stored job; a different request is `idempotency_mismatch`. */
export async function createExportJob(
  db: Db,
  input: ExportCreateInput
): Promise<{ replayed: boolean; job: ExportJobRecord }> {
  if (
    !input ||
    !UUID.test(input.id) ||
    !UUID.test(input.actorId) ||
    typeof input.releaseId !== 'string' ||
    !RELEASE.test(input.releaseId) ||
    (input.communityId !== undefined && !UUID.test(input.communityId))
  )
    throw Error(INVALID);
  const scope = input.communityId ? { communityId: input.communityId } : {};
  const hash = requestHash(input.releaseId, scope);
  return db.transaction(async (q) => {
    const inserted = rowsOf(
      await q.query(
        `INSERT INTO directory_export_job (id,"actorId","releaseId",scope,format,"requestHash","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4::jsonb,'jsonl',$5,clock_timestamp(),clock_timestamp()) ON CONFLICT (id) DO NOTHING RETURNING ${COLUMNS}`,
        [input.id, input.actorId, input.releaseId, JSON.stringify(scope), hash]
      )
    );
    if (inserted.length) return { replayed: false, job: record(inserted[0]) };
    const [prior] = rowsOf(
      await q.query(`SELECT ${COLUMNS} FROM directory_export_job WHERE id=$1`, [
        input.id,
      ])
    );
    if (prior.requestHash !== hash)
      throw new ExportConflictError('idempotency_mismatch');
    return { replayed: true, job: record(prior) };
  });
}

export async function listExportJobs(
  db: Q,
  options: { status?: string; limit?: number; offset?: number } = {}
): Promise<{ items: ExportJobRecord[]; total: number }> {
  if (
    options.status !== undefined &&
    !(EXPORT_STATUSES as readonly string[]).includes(options.status)
  )
    throw Error('Invalid status');
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw Error('Invalid limit');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
    throw Error('Invalid offset');
  const rows = rowsOf(
    await db.query(
      `SELECT ${COLUMNS} FROM directory_export_job WHERE ($1::text IS NULL OR status=$1)
       ORDER BY "createdAt" DESC, id LIMIT $2 OFFSET $3`,
      [options.status ?? null, limit, offset]
    )
  );
  const [{ n }] = rowsOf(
    await db.query(
      `SELECT count(*)::int AS n FROM directory_export_job WHERE ($1::text IS NULL OR status=$1)`,
      [options.status ?? null]
    )
  );
  return { items: rows.map(record), total: Number(n) };
}

export async function getExportJob(
  db: Q,
  id: string
): Promise<ExportJobRecord | null> {
  if (!UUID.test(id)) throw Error(INVALID);
  const [row] = rowsOf(
    await db.query(`SELECT ${COLUMNS} FROM directory_export_job WHERE id=$1`, [
      id,
    ])
  );
  return row ? record(row) : null;
}

/** `failed` becomes `queued` with attempts reset; any other status is `invalid_state`. Unknown id returns null. */
export async function retryExportJob(
  db: Q,
  input: { id: string; actorId: string }
): Promise<ExportJobRecord | null> {
  if (!UUID.test(input?.id) || !UUID.test(input?.actorId)) throw Error(INVALID);
  const updated = rowsOf(
    await db.query(
      `UPDATE directory_export_job SET status='queued',attempts=0,"errorCode"=NULL,"leaseToken"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp()
       WHERE id=$1 AND status='failed' RETURNING ${COLUMNS}`,
      [input.id]
    )
  );
  if (updated.length) return record(updated[0]);
  const [exists] = rowsOf(
    await db.query('SELECT 1 FROM directory_export_job WHERE id=$1', [input.id])
  );
  if (!exists) return null;
  throw new ExportConflictError('invalid_state');
}

// ---------------------------------------------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------------------------------------------

export interface ExportPassOptions {
  readonly dir: string;
  readonly pageSize?: number;
  readonly policyFor: (releaseId: string) => OvertureRightsPolicy | undefined;
  readonly now?: () => Date;
  readonly retentionHours?: number;
  /** Most jobs one pass may run. */
  readonly maxJobs?: number;
}

const artifactNameFor = (id: string) => `${id}.jsonl`;
const removeFile = async (path: string) => {
  try {
    await unlink(path);
  } catch {
    // Already gone, or unreadable: the sweep retries while artifactName is set.
  }
};

/** Deletes the named artifacts (names are `<uuid>.jsonl`; anything else is ignored). */
export async function removeExportFiles(
  dir: string,
  names: readonly string[]
): Promise<void> {
  for (const name of names)
    if (/^[0-9a-f-]{36}\.jsonl$/.test(name)) await removeFile(join(dir, name));
}

/**
 * Marks every `complete` job whose scans intersect `scanIds` as `withdrawn`. Files are deleted here only when `dir`
 * is given; the withdrawal worker marks inside its transaction and deletes after commit.
 */
export async function withdrawExportArtifacts(
  q: Q,
  input: { scanIds: readonly string[]; dir?: string }
): Promise<{ withdrawn: number; artifactNames: string[] }> {
  if (!input.scanIds.length) return { withdrawn: 0, artifactNames: [] };
  const rows = rowsOf(
    await q.query(
      `UPDATE directory_export_job SET status='withdrawn',"withdrawnAt"=clock_timestamp(),"updatedAt"=clock_timestamp(),"leaseToken"=NULL
       WHERE status='complete' AND "scanIds" ?| $1::text[] RETURNING "artifactName"`,
      [[...input.scanIds]]
    )
  );
  const artifactNames = rows
    .map((r) => r.artifactName)
    .filter((n): n is string => typeof n === 'string');
  if (input.dir) {
    await removeExportFiles(input.dir, artifactNames);
    await q.query(
      `UPDATE directory_export_job SET "artifactName"=NULL WHERE status='withdrawn' AND "artifactName" = ANY($1::text[])`,
      [artifactNames]
    );
  }
  return { withdrawn: rows.length, artifactNames };
}

/** The scan ids a completed withdrawal request makes unservable. */
export async function withdrawalScanIds(
  q: Q,
  request: { kind: string; target: string }
): Promise<string[]> {
  if (request.kind === 'scan') return [request.target];
  if (request.kind === 'policy')
    return rowsOf(
      await q.query(
        `SELECT "scanId" FROM directory_overture_private_membership WHERE "policyId"=$1`,
        [request.target]
      )
    ).map((r) => r.scanId);
  const scanId = request.target.split(':')[0];
  return /^[0-9a-f]{64}$/.test(scanId) ? [scanId] : [];
}

async function servedScans(q: Q, communityId?: string): Promise<string[]> {
  const rows = rowsOf(
    await q.query(
      `SELECT DISTINCT m."scanId"
       FROM directory_overture_private_membership m
       JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false
       JOIN directory_overture_private_completion c ON c."scanId"=m."scanId"
       WHERE NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=m."scanId")
         AND ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM directory_town_scan_target t WHERE t."scanId"=m."scanId" AND t."communityId"=$1))
       ORDER BY 1`,
      [communityId ?? null]
    )
  );
  return rows.map((r) => r.scanId);
}

const rowKey = (scanId: string, row: string) =>
  createHash('sha256').update(`${scanId}|${row}`).digest('hex').slice(0, 32);

function classify(error: unknown): ExportError {
  if (error instanceof ExportError) return error;
  const code = (error as { code?: unknown })?.code;
  const message = error instanceof Error ? error.message : '';
  if (typeof code === 'string' && /^E[A-Z]+$/.test(code))
    return new ExportError('io_error', true);
  if (/timeout|timed out|canceling statement/i.test(message))
    return new ExportError('db_timeout', true);
  return new ExportError('export_failed', true);
}

async function renewLease(
  q: Q,
  job: { id: string; leaseToken: string },
  now: Date
): Promise<void> {
  const rows = rowsOf(
    await q.query(
      `UPDATE directory_export_job SET "leaseExpiresAt"=$3,"updatedAt"=clock_timestamp()
       WHERE id=$1 AND "leaseToken"=$2 AND status='running' RETURNING id`,
      [job.id, job.leaseToken, new Date(now.getTime() + EXPORT_LEASE_MS)]
    )
  );
  if (!rows.length) throw new ExportError('lease_lost', false);
}

async function runJob(
  db: Db,
  job: any,
  options: ExportPassOptions,
  clock: () => Date
): Promise<void> {
  const policy = options.policyFor(job.releaseId);
  if (!policy || policy.operations?.export !== true)
    throw new ExportError('export_not_granted', false);
  const pageSize = Math.max(1, options.pageSize ?? 1000);
  const scope = job.scope as { communityId?: string };
  const scans = await servedScans(db, scope.communityId);
  const name = artifactNameFor(job.id);
  const finalPath = join(options.dir, name);
  const bodyPath = `${finalPath}.body.partial`;
  const partialPath = `${finalPath}.partial`;
  const attributions = new Set<string>();
  const termsUrls = new Set<string>();
  const notices = new Set<string>();
  let rowCount = 0;
  let excluded = 0;
  const exclusions = await loadFieldExclusions(db, job.releaseId);
  const carried = new Map<string, ExportedSource>();
  const evaluationFor = (listing: Record<string, unknown>) =>
    applyFieldExclusions(
      evaluateOvertureFieldRights(
        { releaseId: job.releaseId, sources: listing['sources'] as never },
        'export',
        policy
      ),
      exclusions
    );
  try {
    await mkdir(options.dir, { recursive: true });
    const body = await open(bodyPath, 'w');
    try {
      for (const scanId of scans) {
        let after = '-1';
        for (;;) {
          const page = rowsOf(
            await db.query(
              `SELECT r."sourceFileRowNumber"::text AS n, r.listing
               FROM directory_overture_private_row r
               WHERE r."scanId"=$1 AND r."sourceFileRowNumber" > $2::bigint AND r.listing IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")
               ORDER BY r."sourceFileRowNumber" LIMIT $3`,
              [scanId, after, pageSize]
            )
          );
          await renewLease(db, job, clock());
          let lines = '';
          for (const r of page) {
            after = r.n;
            const projection = projectExportRow(r.listing, evaluationFor);
            if (!projection.included) {
              excluded++;
              continue;
            }
            for (const [key, p] of Object.entries(projection.provenance)) {
              for (const d of p.datasets) {
                const id = JSON.stringify([d.dataset, d.license]);
                const entry = carried.get(id) ?? {
                  dataset: d.dataset,
                  license: d.license,
                  fields: [],
                };
                if (!entry.fields.includes(key)) entry.fields.push(key);
                carried.set(id, entry);
              }
              p.attributions.forEach((v) => attributions.add(v));
              p.termsUrls.forEach((v) => termsUrls.add(v));
              p.notices.forEach((v) => notices.add(v));
            }
            try {
              lines +=
                JSON.stringify({
                  type: 'row',
                  key: rowKey(scanId, r.n),
                  ...projection.fields,
                  provenance: projection.provenance,
                }) + '\n';
            } catch {
              throw new ExportError('serialization_failed', false);
            }
            rowCount++;
          }
          if (lines) await body.write(lines);
          if (page.length < pageSize) break;
        }
      }
      await body.sync();
    } finally {
      await body.close();
    }
    if (rowCount === 0) throw new ExportError('no_eligible_rows', false);

    const hash = createHash('sha256');
    let bytes = 0;
    const out = await open(partialPath, 'w');
    try {
      const put = async (chunk: string | Buffer) => {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        hash.update(buf);
        bytes += buf.length;
        await out.write(buf);
      };
      const header = {
        type: 'header',
        schema: EXPORT_SCHEMA,
        jobId: job.id,
        releaseId: job.releaseId,
        generatedAt: clock().toISOString(),
        policyVersion: evaluationFor({ sources: [] }).policyVersion,
        fields: EXPORT_FIELDS.map((f) => f.key),
        attributions: [...attributions].sort(),
        termsUrls: [...termsUrls].sort(),
        notices: [...notices].sort(),
      };
      await put(JSON.stringify(header) + '\n');
      for await (const chunk of createReadStream(bodyPath))
        await put(chunk as Buffer);
      await put(
        JSON.stringify({ type: 'trailer', rowCount, excludedRows: excluded }) +
          '\n'
      );
      await out.sync();
    } finally {
      await out.close();
    }
    await rename(partialPath, finalPath);
    await removeFile(bodyPath);
    try {
      const dirHandle = await open(options.dir, 'r');
      try {
        await dirHandle.sync();
      } finally {
        await dirHandle.close();
      }
    } catch {
      // Directory fsync is best effort; the file itself was fsynced.
    }

    const now = clock();
    const retention = options.retentionHours ?? DEFAULT_RETENTION_HOURS;
    const done = await db.transaction(async (q) => {
      // A withdrawal that completed while this job ran may have removed rows we already read: read again.
      const [moved] = rowsOf(
        await q.query(
          `SELECT EXISTS (SELECT 1 FROM directory_withdrawal_request WHERE status='complete' AND "completedAt" >= $1) AS moved`,
          [job.updatedAt]
        )
      );
      const still = await servedScans(q, scope.communityId);
      if (moved.moved || scans.some((s) => !still.includes(s))) return 'moved';
      const updated = rowsOf(
        await q.query(
          `UPDATE directory_export_job SET status='complete',"rowCount"=$3,"excludedRows"=$4,"byteCount"=$5,sha256=$6,"artifactName"=$7,
             "scanIds"=$8::jsonb,"completedAt"=$9,"expiresAt"=$10,"exportedSources"=$11::jsonb,"leaseToken"=NULL,"leaseExpiresAt"=NULL,"errorCode"=NULL,"updatedAt"=clock_timestamp()
           WHERE id=$1 AND "leaseToken"=$2 AND status='running' RETURNING id`,
          [
            job.id,
            job.leaseToken,
            rowCount,
            excluded,
            bytes,
            hash.digest('hex'),
            name,
            JSON.stringify(scans),
            now,
            new Date(now.getTime() + retention * 3_600_000),
            JSON.stringify([...carried.values()]),
          ]
        )
      );
      return updated.length ? 'done' : 'lost';
    });
    if (done === 'moved') {
      await removeFile(finalPath);
      throw new ExportError('source_changed', true);
    }
    if (done === 'lost') {
      await removeFile(finalPath);
      throw new ExportError('lease_lost', false);
    }
  } catch (error) {
    await removeFile(bodyPath);
    await removeFile(partialPath);
    throw error;
  }
}

async function sweep(db: Q, options: ExportPassOptions, now: Date) {
  // Rights changes apply before anything else: a revoked artifact is unreadable from this point.
  await revokeStaleExports(db, {
    policyFor: options.policyFor,
    dir: options.dir,
  });
  await db.query(
    `UPDATE directory_export_job SET status='expired',"updatedAt"=clock_timestamp()
     WHERE status='complete' AND "expiresAt" IS NOT NULL AND "expiresAt" <= $1`,
    [now]
  );
  const stale = rowsOf(
    await db.query(
      `SELECT id,"artifactName" FROM directory_export_job WHERE status IN ('expired','withdrawn','revoked') AND "artifactName" IS NOT NULL LIMIT 100`
    )
  );
  for (const row of stale) {
    await removeExportFiles(options.dir, [row.artifactName]);
    await db.query(
      `UPDATE directory_export_job SET "artifactName"=NULL WHERE id=$1 AND status IN ('expired','withdrawn','revoked')`,
      [row.id]
    );
  }
}

/**
 * One pass: sweep expired artifacts, then claim and run queued jobs (and running jobs whose lease lapsed).
 * Returns how many jobs it ran.
 */
export async function runExportPass(
  db: Db,
  options: ExportPassOptions
): Promise<number> {
  const clock = options.now ?? (() => new Date());
  await sweep(db, options, clock());
  const max = options.maxJobs ?? 5;
  // Paused: claim nothing new (a job already running finishes under its own lease). The sweep above still runs.
  if (await isPaused(db, 'export_worker')) return 0;
  const seen = new Set<string>();
  let ran = 0;
  while (ran < max) {
    const now = clock();
    const token = randomUUID();
    const claimed = rowsOf(
      await db.query(
        `UPDATE directory_export_job SET status='running',attempts=attempts+1,"leaseToken"=$1,"leaseExpiresAt"=$2,"updatedAt"=clock_timestamp()
         WHERE id=(SELECT id FROM directory_export_job
                   WHERE (status='queued' OR (status='running' AND "leaseExpiresAt" < $3)) AND id <> ALL($4::uuid[])
                   ORDER BY "createdAt",id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING ${COLUMNS}`,
        [token, new Date(now.getTime() + EXPORT_LEASE_MS), now, [...seen]]
      )
    )[0];
    if (!claimed) break;
    seen.add(claimed.id);
    ran++;
    try {
      if (Number(claimed.attempts) > EXPORT_MAX_ATTEMPTS)
        throw new ExportError('attempts_exhausted', false);
      await runJob(db, claimed, options, clock);
    } catch (raw) {
      const error = classify(raw);
      if (error.code === 'lease_lost') continue;
      const terminal =
        !error.retryable || Number(claimed.attempts) >= EXPORT_MAX_ATTEMPTS;
      await db.query(
        `UPDATE directory_export_job SET status=$3,"errorCode"=$4,"leaseToken"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp()
         WHERE id=$1 AND "leaseToken"=$2 AND status='running'`,
        [claimed.id, token, terminal ? 'failed' : 'queued', error.code]
      );
    }
  }
  return ran;
}

/** In-process loop for the Directory runtime, as `startWithdrawalWorker` is. */
export function startExportWorker(
  db: Db,
  options: ExportPassOptions & {
    intervalMs?: number;
    onError?: (error: unknown) => void;
  }
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    let busy = false;
    try {
      busy = (await runExportPass(db, options)) > 0;
    } catch (error) {
      options.onError?.(error);
    }
    if (!stopped)
      timer = setTimeout(tick, busy ? 1000 : options.intervalMs ?? 5000);
  };
  timer = setTimeout(tick, 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------------------------------------------

export type ExportArtifactResult =
  | { ok: false; code: 'not_found' }
  | {
      ok: false;
      code:
        | 'not_ready'
        | 'expired'
        | 'withdrawn'
        | 'revoked'
        | 'integrity_failed';
    }
  | {
      ok: true;
      stream: Readable;
      sha256: string;
      byteCount: number;
      filename: string;
    };

/**
 * Opens a complete artifact for download. The file's SHA-256 and size are checked against the job before a byte is
 * returned, and the stream reads the very descriptor that was verified. Every attempt on a known job is audited.
 */
export async function openExportArtifact(
  db: Q,
  input: { id: string; actorId: string; dir: string; now?: () => Date }
): Promise<ExportArtifactResult> {
  if (!UUID.test(input?.id) || !UUID.test(input?.actorId)) throw Error(INVALID);
  const [job] = rowsOf(
    await db.query(`SELECT ${COLUMNS} FROM directory_export_job WHERE id=$1`, [
      input.id,
    ])
  );
  if (!job) return { ok: false, code: 'not_found' };
  const audit = (outcome: string) =>
    db.query(
      `INSERT INTO directory_export_download (id,"jobId","actorId",outcome,"createdAt") VALUES ($1,$2,$3,$4,clock_timestamp())`,
      [randomUUID(), job.id, input.actorId, outcome]
    );
  const refuse = async (
    code: 'not_ready' | 'expired' | 'withdrawn' | 'revoked' | 'integrity_failed'
  ): Promise<ExportArtifactResult> => {
    await audit(code);
    return { ok: false, code };
  };
  const now = (input.now ?? (() => new Date()))();
  if (job.status === 'withdrawn') return refuse('withdrawn');
  if (job.status === 'revoked') return refuse('revoked');
  if (job.status === 'expired') return refuse('expired');
  if (job.status !== 'complete') return refuse('not_ready');
  if (job.expiresAt && new Date(job.expiresAt) <= now) return refuse('expired');
  if (
    typeof job.artifactName !== 'string' ||
    !/^[0-9a-f-]{36}\.jsonl$/.test(job.artifactName) ||
    !job.sha256
  )
    return refuse('integrity_failed');
  let handle;
  try {
    handle = await open(join(input.dir, job.artifactName), 'r');
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const chunk of handle.createReadStream({
      start: 0,
      autoClose: false,
    })) {
      hash.update(chunk as Buffer);
      bytes += (chunk as Buffer).length;
    }
    if (hash.digest('hex') !== job.sha256 || bytes !== Number(job.byteCount)) {
      await handle.close();
      return refuse('integrity_failed');
    }
  } catch {
    await handle?.close().catch(() => undefined);
    return refuse('integrity_failed');
  }
  await audit('served');
  return {
    ok: true,
    stream: handle.createReadStream({ start: 0 }),
    sha256: job.sha256,
    byteCount: Number(job.byteCount),
    filename: `directory-export-${job.id}.jsonl`,
  };
}
