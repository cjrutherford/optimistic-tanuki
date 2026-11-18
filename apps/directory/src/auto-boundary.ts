import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { readCurrentBoundaryCandidate, SourceRead } from './boundary-review';
import { recordAutomaticBoundaryDecision } from './boundary-decision';
import { censusArchiveUrl } from './census-tiger-pins';
import { isPaused } from './operating-controls';
import { installReviewedBoundary } from './reviewed-boundary-install';
import { DirectoryRecoveryIdentity } from './register-recovery-authority';

/** Decision reason recorded on every automatic installation. */
export const AUTO_BOUNDARY_REASON = 'auto: unambiguous TIGER match';
/** Public label of an automatically installed geometry (source and rights as the owner specified). */
export const AUTO_BOUNDARY_PROMOTE = {
  source: 'census-tiger',
  rights: 'public domain',
} as const;

/**
 * Version of the name and location matching rules in scripts/census-boundary-reader.mjs. It is part of the reason
 * recorded for an unmatched town, so a town last tried under an older rule set is due again at once instead of
 * waiting out the review backoff. Bump it when the rules gain a way to match.
 */
export const TIGER_MATCH_RULES_VERSION = 2;
export const UNMATCHED_REASON = `no_tiger_match:v${TIGER_MATCH_RULES_VERSION}`;

export type TigerCandidate = {
  geoid: string;
  layer: 'place' | 'cousub';
  vintage: string;
  stateFips: string;
  sourceSha256: string;
  /** Which matching tier found it (name and location rule), recorded with the decision candidates. */
  rule?: string;
  distanceMeters?: number;
};
/** What the Census search found for one town; the verdict is recomputed here with place-first precedence. */
export interface AutoDiscovery {
  status: string;
  reason?: string;
  changeToken?: string;
  candidates?: TigerCandidate[];
}
export type TigerChoice =
  | { kind: 'single'; candidate: TigerCandidate }
  | { kind: 'ambiguous'; reason: string; candidates: TigerCandidate[] }
  | { kind: 'missing' };

/** Place layer first, county subdivision only when the place layer has no match. More than one match is ambiguous. */
export function chooseTigerMatch(candidates: TigerCandidate[]): TigerChoice {
  const place = candidates.filter((c) => c.layer === 'place'),
    cousub = candidates.filter((c) => c.layer === 'cousub');
  if (place.length === 1) return { kind: 'single', candidate: place[0] };
  if (place.length > 1)
    return {
      kind: 'ambiguous',
      reason: 'multiple_place_matches',
      candidates: place,
    };
  if (cousub.length === 1) return { kind: 'single', candidate: cousub[0] };
  if (cousub.length > 1)
    return {
      kind: 'ambiguous',
      reason: 'multiple_cousub_matches',
      candidates: cousub,
    };
  return { kind: 'missing' };
}

export type AutoOutcome =
  | 'installed'
  | 'ambiguous'
  | 'unmatched'
  | 'unsupported'
  | 'locked'
  | 'error';

export interface AutoBoundaryDeps {
  db: DataSource;
  identity: DirectoryRecoveryIdentity;
  /** Searches the pinned TIGER archives for the town. Must not write. */
  discover(communityId: string): Promise<AutoDiscovery>;
  /** Stores the single candidate for the town (the existing private candidate store). */
  storeCandidate(
    communityId: string,
    discovery: AutoDiscovery,
    candidate: TigerCandidate
  ): Promise<void>;
  /** The live Social geography read for one town. */
  read(communityId: string): SourceRead;
  /** Extracts the pinned archive geometry for a decision; the install primitive checks it against the decision. */
  load: Parameters<typeof installReviewedBoundary>[4];
}

export interface AutoSelectOptions {
  limit: number;
  retryErrorMs: number;
  retryReviewMs: number;
}

const ATTEMPT = `INSERT INTO directory_boundary_auto_attempt ("communityId",status,reason,"changeToken","requestId",candidates,attempts,"attemptedAt")
  VALUES ($1,$2,$3,$4,$5,$6::jsonb,1,now())
  ON CONFLICT ("communityId") DO UPDATE SET status=EXCLUDED.status,reason=EXCLUDED.reason,"changeToken"=EXCLUDED."changeToken",
    "requestId"=EXCLUDED."requestId",candidates=EXCLUDED.candidates,attempts=directory_boundary_auto_attempt.attempts+1,"attemptedAt"=now()`;

async function record(
  deps: AutoBoundaryDeps,
  communityId: string,
  status: AutoOutcome,
  reason: string,
  extra: {
    changeToken?: string | null;
    requestId?: string | null;
    candidates?: unknown;
  } = {}
): Promise<void> {
  await deps.db.query(ATTEMPT, [
    communityId,
    status,
    reason.slice(0, 120),
    extra.changeToken ?? null,
    extra.requestId ?? null,
    JSON.stringify(extra.candidates ?? []),
  ]);
}

const summarize = (cs: TigerCandidate[]) =>
  cs.map(({ geoid, layer, vintage, rule, distanceMeters }) => ({
    geoid,
    layer,
    vintage,
    ...(rule ? { rule, distanceMeters } : {}),
  }));

/**
 * Installs the town's TIGER boundary when exactly one candidate applies, otherwise leaves it pending and records
 * why for the review queue. Never throws: a failure is recorded as a retryable `error`.
 */
export async function autoInstallTown(
  deps: AutoBoundaryDeps,
  communityId: string
): Promise<{ outcome: AutoOutcome; reason: string }> {
  try {
    // An owner-locked boundary is never replaced or re-searched by an automatic path.
    const locked = await deps.db.query(
      'SELECT 1 FROM directory_boundary_lock WHERE "communityId"=$1',
      [communityId]
    );
    if (locked.length) return { outcome: 'locked', reason: 'boundary_locked' };
    const found = await deps.discover(communityId);
    if (found.status === 'unavailable' || found.status === 'superseded') {
      await record(deps, communityId, 'error', `social_${found.status}`);
      return { outcome: 'error', reason: `social_${found.status}` };
    }
    const changeToken = found.changeToken ?? null;
    if (found.reason) {
      await record(deps, communityId, 'unsupported', found.reason, {
        changeToken,
      });
      return { outcome: 'unsupported', reason: found.reason };
    }
    const choice = chooseTigerMatch(found.candidates ?? []);
    if (choice.kind === 'missing') {
      await record(deps, communityId, 'unmatched', UNMATCHED_REASON, {
        changeToken,
      });
      return { outcome: 'unmatched', reason: UNMATCHED_REASON };
    }
    if (choice.kind === 'ambiguous') {
      await record(deps, communityId, 'ambiguous', choice.reason, {
        changeToken,
        candidates: summarize(choice.candidates),
      });
      return { outcome: 'ambiguous', reason: choice.reason };
    }
    const c = choice.candidate,
      read = deps.read(communityId);
    await deps.storeCandidate(communityId, found, c);
    const stored = await readCurrentBoundaryCandidate(
      deps.db,
      deps.identity,
      communityId,
      read
    );
    if (!stored || stored.geoid !== c.geoid || stored.layer !== c.layer)
      throw Error('candidate_not_stored');
    const requestId = randomUUID();
    await recordAutomaticBoundaryDecision(
      deps.db,
      deps.identity,
      {
        requestId,
        reason: AUTO_BOUNDARY_REASON,
        sourceUrl: censusArchiveUrl(c.stateFips, c.layer, c.vintage),
        candidate: stored,
      },
      read
    );
    await installReviewedBoundary(
      deps.db,
      deps.identity,
      { communityId, requestId },
      read,
      deps.load,
      { promote: { ...AUTO_BOUNDARY_PROMOTE } }
    );
    await record(deps, communityId, 'installed', AUTO_BOUNDARY_REASON, {
      changeToken: stored.changeToken,
      requestId,
      candidates: summarize([c]),
    });
    return { outcome: 'installed', reason: AUTO_BOUNDARY_REASON };
  } catch (error) {
    if (error instanceof Error && error.message === 'Boundary is locked')
      return { outcome: 'locked', reason: 'boundary_locked' };
    const reason = `error: ${
      error instanceof Error ? error.message : 'unknown'
    }`.slice(0, 120);
    try {
      await record(deps, communityId, 'error', reason);
    } catch {
      /* the next sweep retries */
    }
    return { outcome: 'error', reason };
  }
}

const rowCount = (result: unknown): number => {
  const r = result as unknown[];
  return Array.isArray(r?.[0]) ? (r[0] as unknown[]).length : r.length;
};

/**
 * Brings the ledger in line with reality before selecting work. An installed town whose decision was invalidated
 * while its candidate remains was undone through review: it stays pending and is not reinstalled. An installed town
 * that lost its candidate (Social geography changed) or its current-authority geometry (recovery) is retried.
 */
export async function reconcileAutoBoundary(
  db: DataSource,
  identity: DirectoryRecoveryIdentity
): Promise<{ undone: number; retried: number; promoted: number }> {
  const active = `EXISTS (SELECT 1 FROM directory_reviewed_geometry g JOIN directory_boundary_decision d ON d."requestId"=g."requestId" AND d."communityId"=g."communityId" AND d."invalidatedAt" IS NULL WHERE g."communityId"=a."communityId" AND g."recoveryEpoch"=$1 AND g."directoryGeneration"=$2)`;
  const params = [identity.recoveryEpoch, identity.directoryGeneration];
  const undone = await db.query(
    `UPDATE directory_boundary_auto_attempt a SET status='undone',reason='undone after automatic install'
     WHERE a.status='installed' AND NOT ${active}
       AND EXISTS (SELECT 1 FROM directory_boundary_decision d WHERE d."requestId"=a."requestId" AND d."invalidatedAt" IS NOT NULL)
       AND EXISTS (SELECT 1 FROM directory_boundary_candidate c WHERE c."communityId"=a."communityId")
     RETURNING a."communityId"`,
    params
  );
  const retried = await db.query(
    `DELETE FROM directory_boundary_auto_attempt a WHERE a.status='installed' AND NOT ${active} RETURNING a."communityId"`,
    params
  );
  await db.transaction(async (manager) => {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))"
    );
    await manager.query(
      `UPDATE directory_town t SET "geometryStatus"='pending' WHERE t."geometryStatus"='ready'
         AND NOT EXISTS (SELECT 1 FROM directory_boundary_lock l WHERE l."communityId"=t."communityId")
         AND EXISTS (SELECT 1 FROM directory_boundary_decision d WHERE d."communityId"=t."communityId" AND d.automatic AND d."invalidatedAt" IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM directory_reviewed_geometry g JOIN directory_boundary_decision d ON d."requestId"=g."requestId" AND d."invalidatedAt" IS NULL WHERE g."communityId"=t."communityId")`
    );
  });
  // A register re-reconcile or an older deployment can leave a town pending while its automatic geometry is live.
  const promoted = await db.query(
    `UPDATE directory_town t SET "geometryStatus"='ready' WHERE t.eligible AND t."geometryStatus"='pending'
       AND EXISTS (SELECT 1 FROM directory_reviewed_geometry g JOIN directory_boundary_decision d ON d."requestId"=g."requestId" AND d."communityId"=g."communityId" AND d."invalidatedAt" IS NULL AND d.automatic AND d."decision"='verified'
         WHERE g."communityId"=t."communityId" AND g."recoveryEpoch"=$1 AND g."directoryGeneration"=$2 AND g.version=t."geometryVersion")
     RETURNING t."communityId"`,
    params
  );
  return {
    undone: rowCount(undone),
    retried: rowCount(retried),
    promoted: rowCount(promoted),
  };
}

/** Eligible towns that still need a look: never tried, or due for a retry (including an unmatched town last tried under an older matching rule version). Never-tried towns come first, most recently registered first; retries follow, oldest attempt first. Bounded. */
export async function selectAutoBoundaryTowns(
  db: DataSource,
  identity: DirectoryRecoveryIdentity,
  options: AutoSelectOptions
): Promise<string[]> {
  const rows = await db.query(
    `SELECT t."communityId" FROM directory_town t
     LEFT JOIN directory_boundary_auto_attempt a ON a."communityId"=t."communityId"
     WHERE t.eligible IS TRUE
       AND NOT EXISTS (SELECT 1 FROM directory_boundary_lock l WHERE l."communityId"=t."communityId")
       AND NOT EXISTS (SELECT 1 FROM directory_reviewed_geometry g JOIN directory_boundary_decision d ON d."requestId"=g."requestId" AND d."communityId"=g."communityId" AND d."invalidatedAt" IS NULL
                       WHERE g."communityId"=t."communityId" AND g."recoveryEpoch"=$4 AND g."directoryGeneration"=$5)
       AND (a."communityId" IS NULL
         OR (a.status='error' AND a."attemptedAt" < now() - ($2::int * interval '1 millisecond'))
         OR (a.status IN ('ambiguous','unmatched','unsupported') AND a."attemptedAt" < now() - ($3::int * interval '1 millisecond'))
         OR (a.status='unmatched' AND a.reason IS DISTINCT FROM $6))
     ORDER BY (a."communityId" IS NOT NULL),
       CASE WHEN a."communityId" IS NULL THEN t."registeredAt" END DESC NULLS LAST,
       a."attemptedAt" ASC, t."communityId" LIMIT $1`,
    [
      options.limit,
      options.retryErrorMs,
      options.retryReviewMs,
      identity.recoveryEpoch,
      identity.directoryGeneration,
      UNMATCHED_REASON,
    ]
  );
  return rows.map((r: { communityId: string }) => r.communityId);
}

export interface AutoSweepResult {
  status: 'ok' | 'paused';
  examined: number;
  installed: number;
  queued: number;
  errors: number;
  reasons: Record<string, number>;
}

/**
 * One bounded sweep. The existing `provider_acquisition` operating control is the kill switch: this sweep fetches
 * Census archives from an external provider, so pausing provider work stops it before any town is touched.
 */
export async function runAutoBoundarySweep(
  deps: AutoBoundaryDeps,
  options: AutoSelectOptions & { signal?: AbortSignal }
): Promise<AutoSweepResult> {
  const result: AutoSweepResult = {
    status: 'ok',
    examined: 0,
    installed: 0,
    queued: 0,
    errors: 0,
    reasons: {},
  };
  if (await isPaused(deps.db, 'provider_acquisition')) {
    result.status = 'paused';
    return result;
  }
  await reconcileAutoBoundary(deps.db, deps.identity);
  const towns = await selectAutoBoundaryTowns(deps.db, deps.identity, options);
  for (const town of towns) {
    if (options.signal?.aborted) break;
    if (await isPaused(deps.db, 'provider_acquisition')) {
      result.status = 'paused';
      break;
    }
    const { outcome, reason } = await autoInstallTown(deps, town);
    if (outcome === 'locked') continue;
    result.examined++;
    result.reasons[reason] = (result.reasons[reason] ?? 0) + 1;
    if (outcome === 'installed') result.installed++;
    else if (outcome === 'error') result.errors++;
    else result.queued++;
  }
  return result;
}
