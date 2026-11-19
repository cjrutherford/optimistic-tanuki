import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AUTO_BOUNDARY_PROMOTE } from './auto-boundary';
import { ensureOwnerLockBinding } from './locked-boundary-binding';
import {
  serializeBoundaryGeometry,
  validateBoundaryGeometry,
} from './boundary-geometry-validation';

/**
 * Owner-locked town boundaries. A researched Census geometry is installed with a lock row; from then on the geometry
 * sweep, the register re-reconcile and the recovery resets neither replace it nor move the town off 'ready'. A
 * reviewer decision through the boundary review routes can still install a different geometry.
 *
 * The install runs the same checks the reviewed install runs (a valid, non-empty polygon in SRID 4326, a size limit,
 * a geometry hash over the stored bytes) and adds an area sanity band and an evidence hash, because the Social
 * reference point is deliberately not part of the proof: several towns have a mis-placed Social point, which is why
 * the automatic matcher could not place them.
 */
export interface LockedBoundaryInput {
  communityId: string;
  /** The town name the directory holds for the community; a mismatch refuses the install. */
  expectedName: string;
  geoid: string;
  layer: 'place' | 'cousub';
  vintage: string;
  stateFips: string;
  archiveSha256: string;
  sourceUrl: string;
  geometry: unknown;
  /** Inclusive band for the polygon's geodesic area in square kilometres, from the manifest. */
  areaSqKm: { min: number; max: number };
  /** Everything the manifest recorded about why this entity is the town (hashed into the lock). */
  evidence: Record<string, unknown>;
}
export interface LockedBoundaryResult {
  /** `backfilled`: the lock was already installed; its owner-verified decision and reviewed geometry were written. */
  status:
    | 'installed'
    | 'unchanged'
    | 'would-install'
    | 'backfilled'
    | 'would-backfill';
  version: number;
  geometryHash: string;
  evidenceHash: string;
  areaSqKm: number;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha = /^[0-9a-f]{64}$/;
const MIN_AREA_SQ_KM = 0.01;
const MAX_AREA_SQ_KM = 20000;

/** Key-sorted JSON so the evidence hash does not depend on the order the manifest wrote its keys in. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonicalJson(
            (value as Record<string, unknown>)[k]
          )}`
      )
      .join(',')}}`;
  return JSON.stringify(value);
}

function validateInput(input: LockedBoundaryInput): void {
  const geoidLength = input?.layer === 'place' ? 7 : 10;
  if (
    !input ||
    !uuid.test(input.communityId || '') ||
    typeof input.expectedName !== 'string' ||
    !input.expectedName ||
    !['place', 'cousub'].includes(input.layer) ||
    !/^[0-9]{2}$/.test(input.stateFips || '') ||
    !new RegExp(`^[0-9]{${geoidLength}}$`).test(input.geoid || '') ||
    !input.geoid.startsWith(input.stateFips) ||
    !/^20[0-9]{2}$/.test(input.vintage || '') ||
    !sha.test(input.archiveSha256 || '') ||
    !input.evidence ||
    typeof input.evidence !== 'object' ||
    !input.areaSqKm ||
    !Number.isFinite(input.areaSqKm.min) ||
    !Number.isFinite(input.areaSqKm.max) ||
    input.areaSqKm.min <= 0 ||
    input.areaSqKm.min > input.areaSqKm.max
  )
    throw Error('Invalid locked boundary request');
  let source: URL;
  try {
    source = new URL(input.sourceUrl);
  } catch {
    throw Error('Invalid official source');
  }
  if (
    input.sourceUrl.length > 2048 ||
    source.protocol !== 'https:' ||
    source.hostname !== 'www2.census.gov' ||
    source.username ||
    source.password ||
    source.port ||
    source.search ||
    source.hash
  )
    throw Error('Invalid official source');
}

/**
 * Installs the boundary and the lock in one transaction. Idempotent: a town already locked with the same evidence
 * is left as it is (even if a reviewer has since replaced the geometry), so a repeat run never undoes a decision.
 * With `dryRun` it runs every check and writes nothing.
 */
export async function installLockedBoundary(
  db: DataSource,
  input: LockedBoundaryInput,
  options: { dryRun?: boolean } = {}
): Promise<LockedBoundaryResult> {
  validateInput(input);
  const json = serializeBoundaryGeometry(input.geometry);
  return db.transaction(async (manager) => {
    // Serialize against the recovery and automatic reconciliation bulk status resets.
    await manager.query(
      "SELECT pg_advisory_xact_lock_shared(hashtextextended('directory-recovery-authority-v1', 0))"
    );
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [input.communityId]
    );
    const towns = await manager.query(
      'SELECT name,eligible,"geometryVersion" FROM directory_town WHERE "communityId"=$1 FOR UPDATE',
      [input.communityId]
    );
    const town = towns[0];
    if (!town) throw Error('Unknown town');
    if (town.eligible !== true) throw Error('Eligible town required');
    if (town.name !== input.expectedName)
      throw Error('Town name does not match the manifest');
    const { areaSqKm: area, geometryHash } = await validateBoundaryGeometry(
      manager,
      json,
      true
    );
    if (
      area === undefined ||
      !Number.isFinite(area) ||
      area < MIN_AREA_SQ_KM ||
      area > MAX_AREA_SQ_KM ||
      area < input.areaSqKm.min ||
      area > input.areaSqKm.max
    )
      throw Error('Boundary area outside the expected range');
    const evidenceHash = createHash('sha256')
      .update(
        canonicalJson({
          communityId: input.communityId,
          geoid: input.geoid,
          layer: input.layer,
          vintage: input.vintage,
          stateFips: input.stateFips,
          archiveSha256: input.archiveSha256,
          sourceUrl: input.sourceUrl,
          geometryHash,
          evidence: input.evidence,
        })
      )
      .digest('hex');
    const existing = await manager.query(
      'SELECT "evidenceHash",version FROM directory_boundary_lock WHERE "communityId"=$1 FOR UPDATE',
      [input.communityId]
    );
    if (existing[0]?.evidenceHash === evidenceHash) {
      // An installed lock must also carry its owner-verified boundary records (locks made before they existed, or
      // wiped by a recovery reset, are backfilled here; a lock a reviewer has since replaced is left alone).
      const ensured = await ensureOwnerLockBinding(manager, input.communityId, {
        dryRun: options.dryRun,
      });
      return {
        status:
          ensured === 'written'
            ? 'backfilled'
            : ensured === 'would-write'
            ? 'would-backfill'
            : 'unchanged',
        version: Number(town.geometryVersion),
        geometryHash,
        evidenceHash,
        areaSqKm: area,
      } as LockedBoundaryResult;
    }
    const version = Number(town.geometryVersion) + 1;
    if (!Number.isSafeInteger(version) || version > 2147483647)
      throw Error('Geometry version exhausted');
    if (options.dryRun)
      return {
        status: 'would-install',
        version,
        geometryHash,
        evidenceHash,
        areaSqKm: area,
      } as LockedBoundaryResult;
    await manager.query(
      'INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights) VALUES ($1,$2,ST_SetSRID(ST_GeomFromGeoJSON($3),4326),$4,$5,$6)',
      [
        input.communityId,
        version,
        json,
        AUTO_BOUNDARY_PROMOTE.source,
        input.vintage,
        AUTO_BOUNDARY_PROMOTE.rights,
      ]
    );
    await manager.query(
      `UPDATE directory_town SET "geometryVersion"=$2,"geometryStatus"='ready' WHERE "communityId"=$1`,
      [input.communityId, version]
    );
    // The earlier Social-bound binding described the replaced geometry; it must not outlive it.
    await manager.query(
      'UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "communityId"=$1 AND "invalidatedAt" IS NULL',
      [input.communityId]
    );
    await manager.query(
      'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1',
      [input.communityId]
    );
    await manager.query(
      `INSERT INTO directory_boundary_lock ("communityId",version,geoid,layer,vintage,"stateFips","archiveSha256","geometryHash","evidenceHash","sourceUrl",evidence,"lockedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,CURRENT_TIMESTAMP)
       ON CONFLICT ("communityId") DO UPDATE SET version=EXCLUDED.version,geoid=EXCLUDED.geoid,layer=EXCLUDED.layer,vintage=EXCLUDED.vintage,
         "stateFips"=EXCLUDED."stateFips","archiveSha256"=EXCLUDED."archiveSha256","geometryHash"=EXCLUDED."geometryHash",
         "evidenceHash"=EXCLUDED."evidenceHash","sourceUrl"=EXCLUDED."sourceUrl",evidence=EXCLUDED.evidence,"lockedAt"=CURRENT_TIMESTAMP`,
      [
        input.communityId,
        version,
        input.geoid,
        input.layer,
        input.vintage,
        input.stateFips,
        input.archiveSha256,
        geometryHash,
        evidenceHash,
        input.sourceUrl,
        JSON.stringify(input.evidence),
      ]
    );
    await ensureOwnerLockBinding(manager, input.communityId);
    return {
      status: 'installed',
      version,
      geometryHash,
      evidenceHash,
      areaSqKm: area,
    } as LockedBoundaryResult;
  });
}
