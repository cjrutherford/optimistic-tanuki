import { createHash } from 'node:crypto';

/** Freshness thresholds. Constants on purpose: readiness and labels must agree. */
export const FRESH_DAYS = 90;
export const STALE_DAYS = 120;
export const EVIDENCE_VERSION = 1;
const DAY_MS = 86_400_000;

export type FreshnessState = 'fresh' | 'due' | 'stale' | 'unknown';
export type EvidenceKind = 'captured' | 'attached_verified';

/** The columns covered by evidenceSha256 (everything except recordedAt and the hash). */
export interface EvidenceCore {
  scanId: string;
  evidenceVersion: number;
  kind: EvidenceKind | string;
  releaseId: string;
  artifactUrl: string;
  artifactEtag: string;
  artifactBytes: string | number | bigint | null;
  upstreamLastModified: Date | string | null;
  observedAt: Date | string | null;
  recorder: string;
  inventorySha256: string;
}
export interface EvidenceRow extends EvidenceCore {
  recordedAt?: Date | string | null;
  evidenceSha256: string;
}
export interface FreshnessThresholds { freshDays: number; staleDays: number }
export const FRESHNESS_THRESHOLDS: FreshnessThresholds = Object.freeze({ freshDays: FRESH_DAYS, staleDays: STALE_DAYS });

const iso = (value: Date | string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

/** Canonical JSON of the hashed columns: fixed key order, ISO dates, bytes as a decimal string. */
export function canonicalEvidenceJson(core: EvidenceCore): string {
  return JSON.stringify({
    scanId: core.scanId,
    evidenceVersion: Number(core.evidenceVersion),
    kind: core.kind,
    releaseId: core.releaseId,
    artifactUrl: core.artifactUrl,
    artifactEtag: core.artifactEtag,
    artifactBytes: core.artifactBytes === null || core.artifactBytes === undefined ? null : String(core.artifactBytes),
    upstreamLastModified: iso(core.upstreamLastModified),
    observedAt: iso(core.observedAt),
    recorder: core.recorder,
    inventorySha256: core.inventorySha256,
  });
}

export const evidenceHash = (core: EvidenceCore): string => createHash('sha256').update(canonicalEvidenceJson(core)).digest('hex');

export const evidenceHashMatches = (row: EvidenceRow | null | undefined): boolean =>
  !!row && typeof row.evidenceSha256 === 'string' && evidenceHash(row) === row.evidenceSha256;

/** Release id (YYYY-MM-DD.N) from a pinned Overture object URL or path, or null. */
export function releaseIdFromObject(object: string): string | null {
  const match = /\/release\/(\d{4}-\d{2}-\d{2}\.\d+)\/theme=places\/type=place\/[^/]+\.parquet$/.exec(object);
  return match ? match[1] : null;
}

/** A Last-Modified date that disagrees with the release id by more than 14 days is discarded. */
export function plausibleLastModified(lastModified: Date | null, releaseId: string): Date | null {
  if (!lastModified || !Number.isFinite(lastModified.getTime())) return null;
  const release = Date.parse(`${releaseId.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(release)) return null;
  return Math.abs(lastModified.getTime() - release) > 14 * DAY_MS ? null : lastModified;
}

/** Scan state at `now`. Never stored. Unknown without a verified row and a usable past date. */
export function scanFreshness(row: EvidenceRow | null | undefined, now: Date = new Date()): FreshnessState {
  if (!row || !evidenceHashMatches(row)) return 'unknown';
  const stamp = iso(row.upstreamLastModified);
  if (stamp === null) return 'unknown';
  const age = now.getTime() - Date.parse(stamp);
  if (age < 0) return 'unknown';
  if (age < FRESH_DAYS * DAY_MS) return 'fresh';
  if (age <= STALE_DAYS * DAY_MS) return 'due';
  return 'stale';
}

const SEVERITY: Record<FreshnessState, number> = { fresh: 0, due: 1, stale: 2, unknown: 3 };
/** Worst wins: unknown > stale > due > fresh. An empty set is unknown. */
export function worstFreshness(states: FreshnessState[]): FreshnessState {
  if (!states.length) return 'unknown';
  return states.reduce((worst, state) => (SEVERITY[state] > SEVERITY[worst] ? state : worst));
}

export interface PageFreshness {
  state: FreshnessState;
  releaseId: string | null;
  sourcePublishedAt: string | null;
  acquiredAt: string | null;
  thresholds: FreshnessThresholds;
}

/** Aggregate per-scan rows (null = no evidence) into the page-level label. */
export function aggregateFreshness(rows: Array<EvidenceRow | null>, now: Date = new Date()): PageFreshness {
  const evaluated = rows.map(row => ({ row, state: scanFreshness(row, now) }));
  const state = worstFreshness(evaluated.map(e => e.state));
  if (state === 'unknown') return { state, releaseId: null, sourcePublishedAt: null, acquiredAt: null, thresholds: FRESHNESS_THRESHOLDS };
  // Every scan is known here; the worst one is the oldest upstream timestamp.
  const oldest = evaluated.reduce((a, b) => (Date.parse(iso(a.row!.upstreamLastModified)!) <= Date.parse(iso(b.row!.upstreamLastModified)!) ? a : b)).row!;
  return { state, releaseId: oldest.releaseId, sourcePublishedAt: iso(oldest.upstreamLastModified), acquiredAt: iso(oldest.recordedAt), thresholds: FRESHNESS_THRESHOLDS };
}

/** Readiness counts over the given completed live scans. */
export function freshnessCounts(rows: Array<EvidenceRow | null>, now: Date = new Date()) {
  const counts = { fresh: 0, due: 0, stale: 0, unknown: 0 };
  let oldest: string | null = null;
  for (const row of rows) {
    const state = scanFreshness(row, now);
    counts[state]++;
    const stamp = state === 'unknown' ? null : iso(row!.upstreamLastModified);
    if (stamp && (oldest === null || stamp < oldest)) oldest = stamp;
  }
  return { ...counts, oldestPublishedAt: oldest, evaluatedAt: now.toISOString() };
}
