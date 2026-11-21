import type { DataSource } from 'typeorm';
import type { AcquisitionRunStatus } from '../../../libs/social/contracts/src/lib/directory';
import { finishRun } from './acquisition-run';
import { NORMALIZER_VERSION } from './normalize';

type Db = Pick<DataSource, 'query' | 'transaction'>;

/**
 * The acquisition run quality scorecard and gate (owner decision D28).
 *
 * Every acquisition run gets a scorecard computed from the rows it staged for its town, persisted on the run. A run that
 * is past a limit is marked `failed_permanent` with the reason `quality_limit` and its own scans are retired, so it never
 * replaces the town's current live scan (the refresh-then-swap only follows a `succeeded` run). Limits are numbers
 * between 0 and 1; rate limits apply only once a run has `minRowsForRates` rows, so a three-listing town is not failed by
 * one odd row.
 */
export const QUALITY_VERSION = 'quality-v1';
export const QUALITY_FAILURE_REASON = 'quality_limit';
export const QUALITY_GATE_ACTOR = 'system:quality-gate';

export interface QualityLimits {
  /** Smallest share of rows with each field (completeness). Contact fields default to 0: report only. */
  minNameCompleteness: number;
  minCategoryCompleteness: number;
  minAddressCompleteness: number;
  minPhoneCompleteness: number;
  minWebsiteCompleteness: number;
  minHoursCompleteness: number;
  /** Largest share of present values that are invalid after normalisation. */
  maxInvalidAddressRate: number;
  maxInvalidPhoneRate: number;
  /** Largest share of rows whose point lies outside the town's installed geometry. */
  maxOutOfBoundaryRate: number;
  /** Largest share of rows that repeat an earlier row of the run (same name key within about 100 m). */
  maxDuplicateRate: number;
  minRowsForRates: number;
}

/**
 * Chosen from the live distributions on 2026-11-18 (207 eligible towns with a live scan): out-of-boundary share p50 0,
 * p90 0, p99 0.43 (four towns whose newest rows came from an older boundary), duplicate share p50 0.003, p90 0.008,
 * p99 0.020, max 0.045, rows per town p50 626, p90 2606. Live rows keep no address, phone, website or hours, so the
 * contact limits cannot be derived from them: completeness minima are 0 (reported, not enforced) and the invalid-value
 * ceilings are deliberately loose until a run has measured them.
 */
export const DEFAULT_QUALITY_LIMITS: QualityLimits = Object.freeze({
  minNameCompleteness: 0.99,
  minCategoryCompleteness: 0.99,
  minAddressCompleteness: 0,
  minPhoneCompleteness: 0,
  minWebsiteCompleteness: 0,
  minHoursCompleteness: 0,
  maxInvalidAddressRate: 0.35,
  maxInvalidPhoneRate: 0.35,
  maxOutOfBoundaryRate: 0.05,
  maxDuplicateRate: 0.08,
  minRowsForRates: 25,
});

const KEYS = Object.keys(DEFAULT_QUALITY_LIMITS) as (keyof QualityLimits)[];

/** `DIRECTORY_QUALITY_LIMITS` is a JSON object of overrides; anything invalid is ignored, never half-applied. */
export function qualityLimitsFromEnv(
  env: Record<string, string | undefined> = process.env
): QualityLimits {
  const out: QualityLimits = { ...DEFAULT_QUALITY_LIMITS };
  const raw = env['DIRECTORY_QUALITY_LIMITS'];
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const k of KEYS) {
      const v = parsed[k];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (
        k === 'minRowsForRates'
          ? v >= 0 && Number.isInteger(v)
          : v >= 0 && v <= 1
      )
        out[k] = v;
    }
  } catch {
    // Keep the defaults.
  }
  return out;
}

export interface QualityScorecard {
  version: typeof QUALITY_VERSION;
  normalizerVersion: string;
  computedAt: string;
  rows: number;
  completeness: {
    name: number;
    address: number;
    phone: number;
    website: number;
    category: number;
    hours: number;
  };
  invalid: {
    address: number;
    phone: number;
    addressRate: number;
    phoneRate: number;
  };
  outOfBoundary: { count: number; rate: number };
  duplicates: { count: number; rate: number };
  limits: QualityLimits;
  /** Names of the limits the run is past, for example `maxOutOfBoundaryRate`. */
  breaches: string[];
  passed: boolean;
}

const ratio = (n: number, d: number) =>
  d > 0 ? Math.round((n / d) * 10000) / 10000 : 0;

export interface RawQualityCounts {
  rows: number;
  name: number;
  category: number;
  addressPresent: number;
  addressInvalid: number;
  phonePresent: number;
  phoneInvalid: number;
  websitePresent: number;
  hoursPresent: number;
  outOfBoundary: number;
  duplicates: number;
}

/** Pure scoring step, so limits and breaches are testable without a database. */
export function scoreQuality(
  c: RawQualityCounts,
  limits: QualityLimits,
  now: Date = new Date()
): QualityScorecard {
  const completeness = {
    name: ratio(c.name, c.rows),
    address: ratio(c.addressPresent, c.rows),
    phone: ratio(c.phonePresent, c.rows),
    website: ratio(c.websitePresent, c.rows),
    category: ratio(c.category, c.rows),
    hours: ratio(c.hoursPresent, c.rows),
  };
  const invalid = {
    address: c.addressInvalid,
    phone: c.phoneInvalid,
    addressRate: ratio(c.addressInvalid, c.addressPresent),
    phoneRate: ratio(c.phoneInvalid, c.phonePresent),
  };
  const oob = { count: c.outOfBoundary, rate: ratio(c.outOfBoundary, c.rows) };
  const dup = { count: c.duplicates, rate: ratio(c.duplicates, c.rows) };
  const breaches: string[] = [];
  // A run with no rows has nothing to judge; an empty town is `succeeded_empty`, not a quality failure.
  if (c.rows > 0 && c.rows >= limits.minRowsForRates) {
    const min: [keyof QualityLimits, number][] = [
      ['minNameCompleteness', completeness.name],
      ['minCategoryCompleteness', completeness.category],
      ['minAddressCompleteness', completeness.address],
      ['minPhoneCompleteness', completeness.phone],
      ['minWebsiteCompleteness', completeness.website],
      ['minHoursCompleteness', completeness.hours],
    ];
    for (const [k, v] of min) if (v < limits[k]) breaches.push(k);
    const max: [keyof QualityLimits, number][] = [
      ['maxInvalidAddressRate', invalid.addressRate],
      ['maxInvalidPhoneRate', invalid.phoneRate],
      ['maxOutOfBoundaryRate', oob.rate],
      ['maxDuplicateRate', dup.rate],
    ];
    for (const [k, v] of max) if (v > limits[k]) breaches.push(k);
  }
  return {
    version: QUALITY_VERSION,
    normalizerVersion: NORMALIZER_VERSION,
    computedAt: now.toISOString(),
    rows: c.rows,
    completeness,
    invalid,
    outOfBoundary: oob,
    duplicates: dup,
    limits,
    breaches,
    passed: breaches.length === 0,
  };
}

const SCANS_OF_RUN = `SELECT DISTINCT j."scanId" FROM directory_acquisition_run_job j WHERE j."runId"=$1 AND j."scanId" IS NOT NULL`;

/** The raw counts over the run's own staged rows for the town (revoked rows excluded). */
export async function countRunQuality(
  db: Pick<DataSource, 'query'>,
  runId: string,
  townId: string
): Promise<RawQualityCounts> {
  const [r] = await db.query(
    `WITH b AS (
       SELECT ST_CollectionExtract(g.boundary,3) AS boundary FROM directory_town t
         JOIN directory_town_geometry g ON g."communityId"=t."communityId" AND g.version=t."geometryVersion"
        WHERE t."communityId"=$2::uuid),
     rows AS (
       SELECT r.listing,
              ST_SetSRID(ST_MakePoint((r.listing#>>'{location,coordinates,0}')::float8,(r.listing#>>'{location,coordinates,1}')::float8),4326) AS p
         FROM directory_overture_private_row r
        WHERE r."scanId" IN (${SCANS_OF_RUN}) AND r."regionId"=$2::text AND r.listing IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation v
                           WHERE v."scanId"=r."scanId" AND v."sourceFileRowNumber"=r."sourceFileRowNumber"))
     SELECT count(*)::int AS rows,
       count(*) FILTER (WHERE nullif(btrim(listing->>'name'),'') IS NOT NULL)::int AS name,
       count(*) FILTER (WHERE nullif(btrim(listing->>'category'),'') IS NOT NULL)::int AS category,
       count(*) FILTER (WHERE listing#>>'{normalized,address}' IN ('valid','invalid'))::int AS "addressPresent",
       count(*) FILTER (WHERE listing#>>'{normalized,address}'='invalid')::int AS "addressInvalid",
       count(*) FILTER (WHERE listing#>>'{normalized,phone}' IN ('valid','invalid'))::int AS "phonePresent",
       count(*) FILTER (WHERE listing#>>'{normalized,phone}'='invalid')::int AS "phoneInvalid",
       count(*) FILTER (WHERE listing#>>'{normalized,website}' IN ('valid','invalid'))::int AS "websitePresent",
       count(*) FILTER (WHERE listing#>>'{normalized,hours}' IN ('valid','invalid'))::int AS "hoursPresent",
       COALESCE((SELECT count(*) FROM rows x, b WHERE NOT ST_Intersects(b.boundary, x.p)),0)::int AS "outOfBoundary",
       (count(*) - count(DISTINCT (COALESCE(listing#>>'{normalized,nameKey}', lower(listing->>'name')),
            round(ST_X(p)::numeric,3), round(ST_Y(p)::numeric,3))))::int AS duplicates
     FROM rows`,
    [runId, townId]
  );
  return Object.fromEntries(
    Object.entries(r ?? {}).map(([k, v]) => [k, Number(v)])
  ) as unknown as RawQualityCounts;
}

export async function computeRunQuality(
  db: Pick<DataSource, 'query'>,
  runId: string,
  townId: string,
  limits: QualityLimits
): Promise<QualityScorecard> {
  return scoreQuality(await countRunQuality(db, runId, townId), limits);
}

/** Retires the scans this run created, leaving any scan an earlier successful run also produced. Returns the scan ids. */
export async function retireQualityFailedScans(
  db: Db,
  runId: string,
  townId: string,
  breaches: readonly string[]
): Promise<string[]> {
  const reason = `${QUALITY_FAILURE_REASON}: ${breaches.join(', ')}`.slice(
    0,
    500
  );
  return db.transaction(async (tx: Pick<DataSource, 'query'>) => {
    const scans: { scanId: string }[] = await tx.query(
      `SELECT s."scanId" FROM directory_town_scan_target s
         JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
        WHERE s."communityId"=$2::uuid AND s."scanId" IN (${SCANS_OF_RUN})
          AND NOT EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."communityId"=s."communityId" AND z."scanId"=s."scanId")
          AND NOT EXISTS (SELECT 1 FROM directory_acquisition_run_job j2 JOIN directory_acquisition_run q2 ON q2.id=j2."runId"
                           WHERE j2."scanId"=s."scanId" AND q2.id<>$1::uuid AND q2.status IN ('succeeded','succeeded_empty'))
        ORDER BY s."scanId" FOR UPDATE OF s`,
      [runId, townId]
    );
    for (const { scanId } of scans) {
      const [{ n }] = await tx.query(
        `WITH revoked AS (
           INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber")
           SELECT r."scanId", r."sourceFileRowNumber" FROM directory_overture_private_row r
            WHERE r."scanId"=$1 AND r."regionId"=$2::text
           ON CONFLICT DO NOTHING RETURNING 1)
         SELECT count(*)::int AS n FROM revoked`,
        [scanId, townId]
      );
      await tx.query(
        `INSERT INTO directory_town_scan_retirement ("communityId","scanId",reason,actor,"rowsRevoked")
         VALUES ($1::uuid,$2,$3,$4,$5)`,
        [townId, scanId, reason, QUALITY_GATE_ACTOR, n]
      );
    }
    return scans.map((s) => s.scanId);
  });
}

/** Records the normalizer version each of the run's scans was staged with (rows were normalised in-line). */
export async function recordRunNormalization(
  db: Pick<DataSource, 'query'>,
  runId: string
): Promise<void> {
  await db.query(
    `INSERT INTO directory_scan_normalization ("scanId","normalizerVersion","rowCount")
     SELECT j."scanId", $2, (SELECT count(*) FROM directory_overture_private_row r WHERE r."scanId"=j."scanId")
       FROM directory_acquisition_run_job j WHERE j."runId"=$1 AND j."scanId" IS NOT NULL
      GROUP BY j."scanId"
     ON CONFLICT ("scanId") DO UPDATE SET "normalizerVersion"=EXCLUDED."normalizerVersion","rowCount"=EXCLUDED."rowCount","normalizedAt"=clock_timestamp()`,
    [runId, NORMALIZER_VERSION]
  );
}

export interface GateResult {
  scorecard: QualityScorecard;
  failed: boolean;
  retiredScans: string[];
}

/**
 * Called after a town's jobs have finished and before `finishRun`. Persists the scorecard on the run and, when it is
 * past a limit, retires the run's own scans. The caller then finishes the run `failed_permanent` with
 * `QUALITY_FAILURE_REASON`; without a failure the run finishes as it otherwise would.
 */
export async function gateRunQuality(
  db: Db,
  runId: string,
  townId: string,
  limits: QualityLimits = qualityLimitsFromEnv()
): Promise<GateResult> {
  await recordRunNormalization(db, runId);
  const scorecard = await computeRunQuality(db, runId, townId, limits);
  await db.query(
    `UPDATE directory_acquisition_run SET quality=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,
    [runId, JSON.stringify(scorecard)]
  );
  const retiredScans = scorecard.passed
    ? []
    : await retireQualityFailedScans(db, runId, townId, scorecard.breaches);
  return { scorecard, failed: !scorecard.passed, retiredScans };
}

/** The `lastError` text of a quality failure. */
export const qualityFailureMessage = (s: QualityScorecard): string =>
  `${QUALITY_FAILURE_REASON}: ${s.breaches.join(', ')}`;

/** Gate, then finish: a run past a limit ends `failed_permanent` (`quality_limit`), any other run ends as it would. */
export async function finishRunWithQuality(
  db: Db,
  runId: string,
  townId: string,
  limits?: QualityLimits
): Promise<AcquisitionRunStatus> {
  const gate = await gateRunQuality(db, runId, townId, limits);
  return gate.failed
    ? finishRun(db, runId, {
        status: 'failed_permanent',
        error: qualityFailureMessage(gate.scorecard),
      })
    : finishRun(db, runId);
}
