import { createHash, randomBytes } from 'node:crypto';
import { assertDirectoryIdentitiesUnfenced } from './account-lifecycle-fence';

/**
 * Owner decision D18: the 2% wrong-merge limit is measured on a fixed random sample of duplicate pairs for each
 * review round, not on every merge.
 *
 * The population is the town's duplicate cases that hide a listing (`queued` proposals and `merged` decisions).
 * The draw is a seeded shuffle with no stored generator state: every case is scored by SHA-256(seed, caseId) and the
 * lowest scores win, so the same seed over the same population gives the same sample on any machine. The sample is
 * stored with its seed and population size, one per town and round, so it does not move when the queue does.
 *
 * A reviewer judges each sampled pair: `duplicate` (the merge is right) or `distinct` (two businesses: a wrong
 * merge). The observed wrong-merge rate is distinct / judged; it is reported with a 95% Wilson upper bound, and
 * "within limit" requires the upper bound, not just the point estimate, to be at or below the limit.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ROUND = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SEED = /^[A-Za-z0-9._-]{1,64}$/;
export const WRONG_MERGE_LIMIT = 0.02;
export const SAMPLE_DEFAULT_SIZE = 200;
export const SAMPLE_MAX_SIZE = 1000;
export const SAMPLE_INVALID = 'Invalid duplicate sample';
export const SAMPLE_NOT_FOUND = 'Duplicate sample unavailable';
export const SAMPLE_VERDICTS = ['duplicate', 'distinct'] as const;
export type SampleVerdict = (typeof SAMPLE_VERDICTS)[number];

/** The seeded, order-independent draw. Pure: the same seed and ids always give the same sample, in the same order. */
export function drawSample(
  caseIds: readonly string[],
  seed: string,
  size: number
): string[] {
  const scored = [...new Set(caseIds)].map((id) => ({
    id,
    score: createHash('sha256').update(`${seed}\u0000${id}`).digest('hex'),
  }));
  scored.sort((a, b) =>
    a.score < b.score ? -1 : a.score > b.score ? 1 : a.id < b.id ? -1 : 1
  );
  return scored.slice(0, size).map((s) => s.id);
}

export interface WrongMergeReport {
  readonly sampleSize: number;
  readonly judged: number;
  readonly unjudged: number;
  readonly wrong: number;
  /** wrong / judged, or null before anything is judged. */
  readonly rate: number | null;
  /** 95% Wilson upper bound on the rate, or null before anything is judged. */
  readonly upperBound95: number | null;
  readonly limit: number;
  /** True only when the sample is fully judged and the upper bound is at or below the limit. */
  readonly withinLimit: boolean;
  /** True when every sampled pair is judged: the rate is final for the round. */
  readonly complete: boolean;
}

export function wrongMergeReport(
  sampleSize: number,
  judged: number,
  wrong: number,
  limit = WRONG_MERGE_LIMIT
): WrongMergeReport {
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  let rate: number | null = null;
  let upper: number | null = null;
  if (judged > 0) {
    const z = 1.959964;
    const p = wrong / judged;
    const n = judged;
    const denom = 1 + (z * z) / n;
    const centre = p + (z * z) / (2 * n);
    const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    rate = round(p);
    upper = round(Math.min(1, (centre + margin) / denom));
  }
  const complete = sampleSize > 0 && judged === sampleSize;
  return {
    sampleSize,
    judged,
    unjudged: sampleSize - judged,
    wrong,
    rate,
    upperBound95: upper,
    limit,
    complete,
    withinLimit: complete && upper !== null && upper <= limit,
  };
}

export interface SampleSummary {
  readonly sampleId: string;
  readonly round: string;
  readonly seed: string;
  readonly populationSize: number;
  readonly createdAt: string;
  readonly createdById: string | null;
  readonly report: WrongMergeReport;
}
export interface SampleItem {
  readonly caseId: string;
  readonly state: string;
  readonly rule: string;
  readonly distanceMeters: number;
  readonly keptName: string | null;
  readonly hiddenName: string | null;
  readonly verdict: SampleVerdict | null;
  readonly judgedById: string | null;
  readonly judgedAt: string | null;
}

const iso = (d: unknown) =>
  d === null || d === undefined ? null : new Date(d as string).toISOString();

const summary = (s: any, judged: number, wrong: number): SampleSummary => ({
  sampleId: s.id,
  round: s.round,
  seed: s.seed,
  populationSize: s.populationSize,
  createdAt: iso(s.createdAt) as string,
  createdById: s.createdById,
  report: wrongMergeReport(s.sampleSize, judged, wrong),
});

const tally = (q: Q, sampleId: string) =>
  q.query(
    `SELECT count(verdict)::int AS judged, (count(*) FILTER (WHERE verdict='distinct'))::int AS wrong
       FROM directory_duplicate_sample_item WHERE "sampleId"=$1`,
    [sampleId]
  );

export interface DrawInput {
  readonly townId: string;
  readonly round: string;
  readonly actorId: string;
  readonly size?: number;
  readonly seed?: string;
}

/**
 * Draws and stores the round's sample. Idempotent per town and round: a repeat returns the stored sample
 * (`replayed`) whatever its size or seed arguments.
 */
export async function drawDuplicateSample(
  db: Db,
  input: DrawInput
): Promise<{ replayed: boolean; sample: SampleSummary }> {
  const size = input?.size ?? SAMPLE_DEFAULT_SIZE;
  if (
    !input ||
    !UUID.test(input.townId ?? '') ||
    !UUID.test(input.actorId ?? '') ||
    typeof input.round !== 'string' ||
    !ROUND.test(input.round) ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > SAMPLE_MAX_SIZE ||
    (input.seed !== undefined &&
      (typeof input.seed !== 'string' || !SEED.test(input.seed)))
  )
    throw Error(SAMPLE_INVALID);
  return db.transaction(async (tx) => {
    await assertDirectoryIdentitiesUnfenced(tx, [input.actorId]);
    await tx.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',
      [`directory-duplicate-sample:${input.townId}`]
    );
    const [existing] = await tx.query(
      'SELECT * FROM directory_duplicate_sample WHERE "communityId"=$1 AND round=$2',
      [input.townId, input.round]
    );
    if (existing) {
      const [t] = await tally(tx, existing.id);
      return { replayed: true, sample: summary(existing, t.judged, t.wrong) };
    }
    const population = await tx.query(
      `SELECT id FROM directory_duplicate_case WHERE "communityId"=$1 AND state IN ('queued','merged') ORDER BY id`,
      [input.townId]
    );
    const seed = input.seed ?? randomBytes(8).toString('hex');
    const ids = drawSample(
      population.map((r) => r.id as string),
      seed,
      size
    );
    if (!ids.length) throw Error(SAMPLE_INVALID);
    const [created] = await tx.query(
      `INSERT INTO directory_duplicate_sample ("communityId",round,seed,"sampleSize","populationSize","createdById")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        input.townId,
        input.round,
        seed,
        ids.length,
        population.length,
        input.actorId,
      ]
    );
    await tx.query(
      `INSERT INTO directory_duplicate_sample_item ("sampleId","caseId") SELECT $1, unnest($2::uuid[])`,
      [created.id, ids]
    );
    return { replayed: false, sample: summary(created, 0, 0) };
  });
}

/** Every sample for the town with its observed wrong-merge rate, newest first. */
export async function listDuplicateSamples(
  q: Q,
  town: string
): Promise<{ samples: SampleSummary[] }> {
  if (!UUID.test(town ?? '')) throw Error(SAMPLE_INVALID);
  const rows = await q.query(
    `SELECT s.*, (SELECT count(i.verdict)::int FROM directory_duplicate_sample_item i WHERE i."sampleId"=s.id) AS judged,
            (SELECT count(*)::int FROM directory_duplicate_sample_item i WHERE i."sampleId"=s.id AND i.verdict='distinct') AS wrong
       FROM directory_duplicate_sample s WHERE s."communityId"=$1 ORDER BY s."createdAt" DESC, s.id LIMIT 50`,
    [town]
  );
  return { samples: rows.map((r) => summary(r, r.judged, r.wrong)) };
}

/** One sample with its pairs (name and current state read live) and the report. */
export async function getDuplicateSample(
  q: Q,
  town: string,
  sampleId: string
): Promise<{ sample: SampleSummary; items: SampleItem[] }> {
  if (!UUID.test(town ?? '') || !UUID.test(sampleId ?? ''))
    throw Error(SAMPLE_INVALID);
  const [s] = await q.query(
    'SELECT * FROM directory_duplicate_sample WHERE id=$1 AND "communityId"=$2',
    [sampleId, town]
  );
  if (!s) throw Error(SAMPLE_NOT_FOUND);
  const rows = await q.query(
    `SELECT i."caseId",i.verdict,i."judgedById",i."judgedAt",c.state,c.rule,c."distanceMeters",
        (SELECT r.listing->>'name' FROM directory_overture_private_row r WHERE r."scanId"=c."keptScanId" AND r."sourceFileRowNumber"=c."keptRow") AS "keptName",
        (SELECT r.listing->>'name' FROM directory_overture_private_row r WHERE r."scanId"=c."hiddenScanId" AND r."sourceFileRowNumber"=c."hiddenRow") AS "hiddenName"
       FROM directory_duplicate_sample_item i JOIN directory_duplicate_case c ON c.id=i."caseId"
      WHERE i."sampleId"=$1 ORDER BY (i.verdict IS NULL) DESC, i."caseId"`,
    [sampleId]
  );
  const [t] = await tally(q, sampleId);
  return {
    sample: summary(s, t.judged, t.wrong),
    items: rows.map((r) => ({
      caseId: r.caseId,
      state: r.state,
      rule: r.rule,
      distanceMeters: r.distanceMeters,
      keptName: r.keptName ?? null,
      hiddenName: r.hiddenName ?? null,
      verdict: r.verdict ?? null,
      judgedById: r.judgedById ?? null,
      judgedAt: iso(r.judgedAt),
    })),
  };
}

/** Records (or changes) the judgement of one sampled pair. Idempotent: the same verdict again changes nothing. */
export async function judgeSampleItem(
  db: Db,
  input: {
    townId: string;
    sampleId: string;
    caseId: string;
    verdict: string;
    actorId: string;
  }
): Promise<{ replayed: boolean; report: WrongMergeReport }> {
  if (
    !input ||
    !UUID.test(input.townId ?? '') ||
    !UUID.test(input.sampleId ?? '') ||
    !UUID.test(input.caseId ?? '') ||
    !UUID.test(input.actorId ?? '') ||
    !(SAMPLE_VERDICTS as readonly string[]).includes(input.verdict)
  )
    throw Error(SAMPLE_INVALID);
  return db.transaction(async (tx) => {
    await assertDirectoryIdentitiesUnfenced(tx, [input.actorId]);
    const [s] = await tx.query(
      'SELECT * FROM directory_duplicate_sample WHERE id=$1 AND "communityId"=$2',
      [input.sampleId, input.townId]
    );
    if (!s) throw Error(SAMPLE_NOT_FOUND);
    const [item] = await tx.query(
      'SELECT verdict FROM directory_duplicate_sample_item WHERE "sampleId"=$1 AND "caseId"=$2 FOR UPDATE',
      [input.sampleId, input.caseId]
    );
    if (!item) throw Error(SAMPLE_NOT_FOUND);
    const replayed = item.verdict === input.verdict;
    if (!replayed)
      await tx.query(
        `UPDATE directory_duplicate_sample_item SET verdict=$3,"judgedById"=$4,"judgedAt"=CURRENT_TIMESTAMP WHERE "sampleId"=$1 AND "caseId"=$2`,
        [input.sampleId, input.caseId, input.verdict, input.actorId]
      );
    const [t] = await tally(tx, input.sampleId);
    return {
      replayed,
      report: wrongMergeReport(s.sampleSize, t.judged, t.wrong),
    };
  });
}
