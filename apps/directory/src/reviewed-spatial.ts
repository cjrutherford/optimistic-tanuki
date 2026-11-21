import { isIP } from 'node:net';
import type { EntityManager } from 'typeorm';

/**
 * Bump when the rules in this file change what counts as a mappable reviewed
 * listing. A mismatch with the stored projection makes bounds search fail closed
 * until the projection is rebuilt.
 */
export const REVIEWED_SPATIAL_VALIDATOR_VERSION = 1;

export const text = (x: unknown): x is string =>
  typeof x === 'string' &&
  x.trim().length > 0 &&
  x.length <= 2000 &&
  // eslint-disable-next-line no-control-regex -- Control characters are matched on purpose.
  !/[\x00-\x1f\x7f]/.test(x);
export const textArray = (x: unknown): x is string[] =>
  Array.isArray(x) && x.length <= 50 && x.every(text);

export function validUrl(value: unknown, httpsOnly = false): boolean {
  try {
    if (typeof value !== 'string' || value.length > 2048) return false;
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    return (
      (httpsOnly
        ? u.protocol === 'https:'
        : ['http:', 'https:'].includes(u.protocol)) &&
      !u.username &&
      !u.password &&
      host.includes('.') &&
      !isIP(host.replace(/^\[|\]$/g, '')) &&
      !/(?:^|\.)(localhost|local|internal)$/.test(host)
    );
  } catch {
    return false;
  }
}

/** The structure every served listing must have, reviewed or not. */
export function validBaseListing(listing: any): boolean {
  const c = listing?.location?.coordinates;
  return !(
    !text(listing?.name) ||
    !text(listing?.category) ||
    listing?.location?.type !== 'Point' ||
    !Array.isArray(c) ||
    c.length !== 2 ||
    !c.every(Number.isFinite) ||
    Math.abs(c[0]) > 180 ||
    Math.abs(c[1]) > 90 ||
    !textArray(listing.attribution) ||
    !listing.attribution.length ||
    !textArray(listing.notices) ||
    !textArray(listing.termsUrls)
  );
}

export interface ReviewedFields {
  website?: string;
  phone?: string;
  address?: string;
  attribution: string[];
  notices: string[];
  termsUrls: string[];
}

/** The reviewed fields a listing may serve, or null when the reviewed object is not well formed. */
export function reviewedFields(reviewed: any): ReviewedFields | null {
  if (
    !reviewed ||
    typeof reviewed !== 'object' ||
    Array.isArray(reviewed) ||
    !validUrl(reviewed.evidenceUrl) ||
    !textArray(reviewed.attribution) ||
    !reviewed.attribution.length ||
    !textArray(reviewed.notices) ||
    !textArray(reviewed.termsUrls)
  )
    return null;
  const fields: ReviewedFields = {
    attribution: reviewed.attribution,
    notices: reviewed.notices,
    termsUrls: reviewed.termsUrls,
  };
  if (validUrl(reviewed.website)) fields.website = reviewed.website;
  if (
    typeof reviewed.phone === 'string' &&
    /^\+[1-9][0-9]{6,14}$/.test(reviewed.phone)
  )
    fields.phone = reviewed.phone;
  if (text(reviewed.address) && reviewed.address.length <= 300)
    fields.address = reviewed.address;
  return fields;
}

/**
 * The map point of a listing whose reviewed fields include a valid address, or
 * null. The one rule shared by bounds search and the projection writers.
 */
export function mappableReviewed(
  listing: any
): { coordinates: [number, number] } | null {
  if (!validBaseListing(listing)) return null;
  const fields = reviewedFields(listing.reviewed);
  if (!fields?.address) return null;
  return {
    coordinates: [
      listing.location.coordinates[0],
      listing.location.coordinates[1],
    ],
  };
}

/** The listing changed, or its row went away, between the read and the projection write. */
export class SpatialProjectionConflict extends Error {
  constructor(message = 'Reviewed spatial projection conflict') {
    super(message);
    this.name = 'SpatialProjectionConflict';
  }
}

export interface ProjectableBinding {
  id: string;
  scanId: string;
  sourceFileRowNumber: string;
  communityId: string;
}

/**
 * Writes (or repairs) the candidate-index row of an active binding, inside the
 * caller's transaction. The stored point verdict and digest always describe the
 * same listing content: the insert re-reads the row and only matches the exact
 * content the validator saw. Zero rows written throws, aborting the transition.
 */
export async function projectBinding(
  manager: EntityManager,
  binding: ProjectableBinding
): Promise<void> {
  const [row] = await manager.query(
    'SELECT listing FROM "directory_overture_private_row" WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "regionId"=$3',
    [binding.scanId, binding.sourceFileRowNumber, binding.communityId]
  );
  if (!row?.listing)
    throw new SpatialProjectionConflict('Reviewed row missing for projection');
  const mapped = mappableReviewed(row.listing);
  const written = await manager.query(
    `WITH written AS (
       INSERT INTO "directory_reviewed_spatial"
         ("scanId","sourceFileRowNumber","bindingId","communityId","point","listingDigest","validatorVersion")
       SELECT r."scanId", r."sourceFileRowNumber", b."id", b."communityId",
              CASE WHEN $5::boolean THEN ST_SetSRID(ST_MakePoint($6::float8,$7::float8),4326) END,
              md5(r.listing::text), $8::integer
       FROM "directory_overture_private_row" r
       JOIN "directory_reviewed_binding" b ON b."id"=$1 AND b."state"='active'
         AND b."scanId"=r."scanId" AND b."sourceFileRowNumber"=r."sourceFileRowNumber" AND b."communityId"::text=r."regionId"
       WHERE r."scanId"=$2 AND r."sourceFileRowNumber"=$3 AND r."regionId"=$4 AND r.listing=$9::jsonb
       ON CONFLICT ("scanId","sourceFileRowNumber") DO UPDATE SET
         "bindingId"=EXCLUDED."bindingId","communityId"=EXCLUDED."communityId","point"=EXCLUDED."point",
         "listingDigest"=EXCLUDED."listingDigest","validatorVersion"=EXCLUDED."validatorVersion","createdAt"=CURRENT_TIMESTAMP
       RETURNING 1)
     SELECT count(*)::int AS n FROM written`,
    [
      binding.id,
      binding.scanId,
      binding.sourceFileRowNumber,
      binding.communityId,
      !!mapped,
      mapped?.coordinates[0] ?? null,
      mapped?.coordinates[1] ?? null,
      REVIEWED_SPATIAL_VALIDATOR_VERSION,
      JSON.stringify(row.listing),
    ]
  );
  if (written[0]?.n !== 1) throw new SpatialProjectionConflict();
}

export async function unprojectBinding(
  manager: EntityManager,
  bindingId: string
): Promise<void> {
  await manager.query(
    'DELETE FROM "directory_reviewed_spatial" WHERE "bindingId"=$1',
    [bindingId]
  );
}

export async function unprojectScan(
  manager: EntityManager,
  scanId: string
): Promise<void> {
  await manager.query(
    'DELETE FROM "directory_reviewed_spatial" WHERE "scanId"=$1',
    [scanId]
  );
}

export async function unprojectRow(
  manager: EntityManager,
  scanId: string,
  sourceFileRowNumber: string | number
): Promise<void> {
  await manager.query(
    'DELETE FROM "directory_reviewed_spatial" WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
    [scanId, sourceFileRowNumber]
  );
}

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<any>;
}

export interface SpatialDrift {
  missing: number;
  stale: number;
  orphaned: number;
  versionMismatch: number;
  unreachableAssignment: number;
}

/** Active, current-lease bindings whose live row has no projection row of the current validator version. */
const MISSING_SQL = `SELECT count(*)::int AS n FROM "directory_reviewed_binding" b
  JOIN "directory_overture_private_row" r ON r."scanId"=b."scanId" AND r."sourceFileRowNumber"=b."sourceFileRowNumber" AND r."regionId"=b."communityId"::text
  WHERE b."state"='active' AND b."verifiedUntil">now()
    AND NOT EXISTS (SELECT 1 FROM "directory_reviewed_spatial" p WHERE p."bindingId"=b."id" AND p."validatorVersion"=$1)`;

/** The cheap probe behind readiness: no full pass, one anti-join over active bindings. */
export async function countMissingSpatial(
  db: Queryable,
  version = REVIEWED_SPATIAL_VALIDATOR_VERSION
): Promise<number> {
  const [row] = await db.query(MISSING_SQL, [version]);
  return row.n;
}

export async function readSpatialState(db: Queryable): Promise<{
  validatorVersion: number;
  rebuildStartedAt: Date | null;
  rebuildCompletedAt: Date | null;
  reconciledAt: Date | null;
} | null> {
  const rows = await db.query(
    `SELECT "validatorVersion","rebuildStartedAt","rebuildCompletedAt","reconciledAt" FROM "directory_reviewed_spatial_state" WHERE "id"='current'`
  );
  return rows[0] ?? null;
}

/** Full read-only measurement of how the projection differs from the live tables. */
export async function measureSpatialDrift(
  db: Queryable,
  version = REVIEWED_SPATIAL_VALIDATOR_VERSION
): Promise<SpatialDrift> {
  const missing = await countMissingSpatial(db, version);
  const [stale] = await db.query(
    `SELECT count(*)::int AS n FROM "directory_reviewed_spatial" p
     JOIN "directory_overture_private_row" r ON r."scanId"=p."scanId" AND r."sourceFileRowNumber"=p."sourceFileRowNumber"
     WHERE p."listingDigest"<>md5(r.listing::text)`
  );
  const [orphaned] = await db.query(
    `SELECT count(*)::int AS n FROM "directory_reviewed_spatial" p
     WHERE NOT EXISTS (SELECT 1 FROM "directory_reviewed_binding" b WHERE b."id"=p."bindingId" AND b."state"='active' AND b."scanId"=p."scanId" AND b."sourceFileRowNumber"=p."sourceFileRowNumber")
        OR NOT EXISTS (SELECT 1 FROM "directory_overture_private_row" r WHERE r."scanId"=p."scanId" AND r."sourceFileRowNumber"=p."sourceFileRowNumber")`
  );
  const [versionMismatch] = await db.query(
    `SELECT count(*)::int AS n FROM "directory_reviewed_spatial" WHERE "validatorVersion"<>$1`,
    [version]
  );
  const [unreachable] = await db.query(
    `SELECT count(*)::int AS n FROM "directory_reviewed_binding" b
     JOIN "directory_overture_private_row" r ON r."scanId"=b."scanId" AND r."sourceFileRowNumber"=b."sourceFileRowNumber"
     WHERE b."state"='active' AND (r.listing->>'assignmentChangeToken' IS NULL OR r.listing->>'assignmentChangeToken' IS DISTINCT FROM b."assignmentChangeToken"::text)`
  );
  return {
    missing,
    stale: stale.n,
    orphaned: orphaned.n,
    versionMismatch: versionMismatch.n,
    unreachableAssignment: unreachable.n,
  };
}
