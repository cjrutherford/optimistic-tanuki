import { createHash } from 'node:crypto';
import type { AddressReviewDecision, GeocodeEvidence } from './address-review';

/**
 * Owner decision D11 (2026-11-18): an address is auto-approved only for a strong match. The address geocode and the
 * source map point must both lie inside the town's verified boundary, and the evidence sources must agree.
 * Everything else stays with a reviewer. See S7-address-review-auto-approval.md section 12.
 */
export const D11_POLICY = 'D11 strong match (owner 2026-11-18)';

type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Point = { lat: number; lng: number };

export interface VerifiedBoundaryRow {
  geometryHash: string;
  changeToken: string;
  geometry: string;
  geocode_inside: boolean;
  source_inside: boolean;
}

/**
 * The town's verified, reviewed boundary and whether each point lies inside it. Null when the town has no verified
 * boundary (no reviewed geometry, a decision that is not `verified`, or a stale change token). `lock` takes the
 * share locks the publisher holds through its write.
 */
export async function queryVerifiedBoundary(
  q: Q,
  communityId: string,
  geocode: Point,
  source: Point,
  lock = false
): Promise<VerifiedBoundaryRow | null> {
  const [row] = await q.query(
    `SELECT b."geometryHash",b."changeToken",encode(ST_AsEWKB(g.boundary,'XDR'),'hex') AS geometry, ST_Covers(g.boundary,ST_SetSRID(ST_MakePoint($2,$3),4326)) AS geocode_inside, ST_Covers(g.boundary,ST_SetSRID(ST_MakePoint($4,$5),4326)) AS source_inside
      FROM directory_reviewed_geometry b
      JOIN directory_town t ON t."communityId"=b."communityId" AND t.eligible IS TRUE AND t."geometryStatus"='ready' AND t."geometryVersion"=b.version
      JOIN directory_town_geometry g ON g."communityId"=b."communityId" AND g.version=b.version
      JOIN directory_boundary_decision d ON d."requestId"=b."requestId" AND d."communityId"=b."communityId" AND d.decision='verified' AND d."invalidatedAt" IS NULL
      JOIN directory_boundary_candidate c ON c."communityId"=b."communityId" AND c."changeToken"=b."changeToken" AND c."geographyHash"=b."geographyHash" AND c."sourceEpoch"=d."sourceEpoch" AND c."activationId"=d."activationId" AND c."socialGeneration"=d."socialGeneration"
      WHERE b."communityId"=$1 AND d."changeToken"=b."changeToken" AND d."geographyHash"=b."geographyHash" AND d."recoveryEpoch"=b."recoveryEpoch" AND d."directoryGeneration"=b."directoryGeneration"
      ${lock ? 'FOR SHARE OF b,t,g,d,c' : ''}`,
    [communityId, geocode.lng, geocode.lat, source.lng, source.lat]
  );
  if (row) return row;
  // An owner-locked town has no Social candidate to join (the lock exists because the Social point is wrong); its
  // owner-verified decision and binding are accepted when they match the lock and the current recovery authority.
  const [locked] = await q.query(
    `SELECT b."geometryHash",b."changeToken",encode(ST_AsEWKB(g.boundary,'XDR'),'hex') AS geometry, ST_Covers(g.boundary,ST_SetSRID(ST_MakePoint($2,$3),4326)) AS geocode_inside, ST_Covers(g.boundary,ST_SetSRID(ST_MakePoint($4,$5),4326)) AS source_inside
      FROM directory_reviewed_geometry b
      JOIN directory_town t ON t."communityId"=b."communityId" AND t.eligible IS TRUE AND t."geometryStatus"='ready' AND t."geometryVersion"=b.version
      JOIN directory_town_geometry g ON g."communityId"=b."communityId" AND g.version=b.version
      JOIN directory_boundary_decision d ON d."requestId"=b."requestId" AND d."communityId"=b."communityId" AND d.decision='verified' AND d."invalidatedAt" IS NULL AND d.reason='owner_lock'
      JOIN directory_boundary_lock l ON l."communityId"=b."communityId" AND l.version=b.version AND l."geometryHash"=b."geometryHash"
      JOIN directory_census_progress p ON p.id='recovery' AND p."recoveryEpoch"=b."recoveryEpoch" AND p."directoryGeneration"=b."directoryGeneration"
      WHERE b."communityId"=$1 AND d."changeToken"=b."changeToken" AND d."geographyHash"=b."geographyHash" AND d."recoveryEpoch"=b."recoveryEpoch" AND d."directoryGeneration"=b."directoryGeneration"
      ${lock ? 'FOR SHARE OF b,t,g,d,l' : ''}`,
    [communityId, geocode.lng, geocode.lat, source.lng, source.lat]
  );
  return locked ?? null;
}

const finite = (p: unknown): p is Point =>
  !!p &&
  Number.isFinite((p as Point).lat) &&
  Number.isFinite((p as Point).lng) &&
  Math.abs((p as Point).lat) <= 90 &&
  Math.abs((p as Point).lng) <= 180;

/** Checks that must all pass for the evidence sources to agree (they are the classifier's own checks). */
const AGREEMENT_CHECKS = [
  'singleAddress',
  'geocode',
  'geocodePrecision',
  'geocodeDistance',
  'officialEvidence',
  'officialName',
  'officialAddress',
  'officialPhone',
  'officialWebsite',
  'evidenceAge',
] as const;

export interface StrongMatchInput {
  communityId: string;
  point: Point | null | undefined;
  geocode: GeocodeEvidence | null | undefined;
  decision: AddressReviewDecision;
}

/**
 * Releases the automatic-approval hold for a strong match only. A candidate that the classifier did not approve is
 * returned unchanged. A classifier approval is held for a reviewer (`needs_human`, reason `auto_approval_paused`
 * plus the specific cause) unless the town has a verified boundary that contains both the geocode and the source
 * point and every agreeing-source check passed. A release adds the reason `d11_strong_match` and the check
 * `d11StrongMatch`; the caller records the policy name in the audit event.
 */
export async function applyStrongMatchPolicy(
  q: Q,
  input: StrongMatchInput
): Promise<{ decision: AddressReviewDecision; released: boolean }> {
  const { decision } = input;
  if (decision.verdict !== 'auto_approve') return { decision, released: false };
  const hold = (cause: string) => ({
    released: false,
    decision: {
      ...decision,
      verdict: 'needs_human' as const,
      reasons: [...decision.reasons, 'auto_approval_paused', cause],
    },
  });
  if (AGREEMENT_CHECKS.some((c) => decision.checks[c] !== 'pass'))
    return hold('sources_disagree');
  const coordinates = input.geocode?.coordinates;
  if (
    input.geocode?.status !== 'match' ||
    !finite(coordinates) ||
    !finite(input.point)
  )
    return hold('town_points_missing');
  const boundary = await queryVerifiedBoundary(
    q,
    input.communityId,
    coordinates,
    input.point
  );
  if (
    !boundary ||
    createHash('sha256')
      .update(Buffer.from(boundary.geometry, 'hex'))
      .digest('hex') !== boundary.geometryHash
  )
    return hold('town_boundary_unverified');
  if (!boundary.geocode_inside || !boundary.source_inside)
    return hold('point_outside_town');
  return {
    released: true,
    decision: {
      ...decision,
      reasons: [...decision.reasons, 'd11_strong_match'],
      checks: { ...decision.checks, d11StrongMatch: 'pass' },
    },
  };
}
