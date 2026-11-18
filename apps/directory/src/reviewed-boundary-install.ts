import {
  serializeBoundaryGeometry,
  validateBoundaryGeometry,
} from './boundary-geometry-validation';
import { DataSource, EntityManager } from 'typeorm';
import { geographyHash, SourceRead } from './boundary-review';
import { DirectoryRecoveryIdentity } from './register-recovery-authority';
import { lockAuthority } from './register-reconciliation-v2';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const candidateFields = [
  'communityId',
  'changeToken',
  'geoid',
  'layer',
  'vintage',
  'stateFips',
  'archiveSha256',
  'geographyHash',
] as const;
type SourceGeometry = {
  status: string;
  geoid: string;
  stateFips: string;
  layer: string;
  vintage: string;
  sourceSha256: string;
  geometry: unknown;
};
type SourceLoader = (
  decision: Record<string, unknown>,
  geography: unknown
) => Promise<SourceGeometry>;

/**
 * Only the automatic Census sweep passes `promote`: it labels the public geometry source and rights and moves the
 * town off 'pending' in the same transaction. Without it the install stays private and the town stays pending.
 */
export type InstallOptions = {
  promote?: { source: string; rights: string };
};

/** Private installation primitive. Only a trusted caller that derives geometry from the pinned archive may provide load. */
export async function installReviewedBoundary(
  db: DataSource,
  identity: DirectoryRecoveryIdentity,
  input: { communityId: string; requestId: string },
  read: SourceRead,
  load: SourceLoader,
  options?: InstallOptions
): Promise<number> {
  if (
    !input ||
    !uuid.test(input.communityId || '') ||
    !uuid.test(input.requestId || '') ||
    typeof read !== 'function' ||
    typeof load !== 'function'
  )
    throw Error('Invalid installation request');
  const authority = { ...identity },
    request = { ...input },
    promote = options?.promote ? { ...options.promote } : undefined;
  async function inspect(manager: EntityManager) {
    await lockAuthority(manager, authority);
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [request.communityId]
    );
    const decisions = await manager.query(
      'SELECT * FROM directory_boundary_decision WHERE "requestId"=$1 AND "communityId"=$2',
      [request.requestId, request.communityId]
    );
    const d = decisions[0];
    if (
      !d ||
      d.invalidatedAt !== null ||
      d.decision !== 'verified' ||
      d.sourceEpoch !== authority.sourceEpoch ||
      d.activationId !== authority.activationId ||
      d.socialGeneration !== authority.socialGeneration ||
      d.recoveryEpoch !== authority.recoveryEpoch ||
      d.directoryGeneration !== authority.directoryGeneration
    )
      throw Error('Decision unavailable or stale');
    const rows = await manager.query(
      'SELECT c.*,t.eligible,t."geometryVersion" FROM directory_boundary_candidate c JOIN directory_town t ON t."communityId"=c."communityId" WHERE c."communityId"=$1 FOR UPDATE OF c,t',
      [request.communityId]
    );
    const c = rows[0];
    if (
      !c ||
      c.eligible !== true ||
      c.sourceEpoch !== authority.sourceEpoch ||
      c.activationId !== authority.activationId ||
      c.socialGeneration !== authority.socialGeneration ||
      candidateFields.some((k) => c[k] !== d[k])
    )
      throw Error('Candidate unavailable or changed');
    const current = await read(),
      hash = geographyHash(current?.geography, request.communityId);
    if (
      current?.status !== 'current' ||
      current.changeToken !== d.changeToken ||
      !hash ||
      hash !== d.geographyHash
    )
      throw Error('Stale Social geography');
    return { decision: d, candidate: c, geography: current.geography };
  }
  const initial = await db.transaction(inspect);
  const extracted = await load(
    structuredClone(initial.decision),
    structuredClone(initial.geography)
  );
  const d = initial.decision;
  if (
    !extracted ||
    extracted.status !== 'candidate' ||
    extracted.geoid !== d.geoid ||
    extracted.stateFips !== d.stateFips ||
    extracted.layer !== d.layer ||
    extracted.vintage !== d.vintage ||
    extracted.sourceSha256 !== d.archiveSha256
  )
    throw Error('Source geometry identity mismatch');
  const json = serializeBoundaryGeometry(extracted.geometry);
  return db.transaction(async (manager) => {
    const current = await inspect(manager);
    if (candidateFields.some((k) => current.decision[k] !== d[k]))
      throw Error('Decision changed');
    const { geometryHash } = await validateBoundaryGeometry(manager, json);
    const matches = await manager.query(
      'SELECT * FROM directory_reviewed_geometry WHERE "communityId"=$1 FOR UPDATE',
      [request.communityId]
    );
    if (matches.length && matches[0].requestId === request.requestId) {
      if (
        matches[0].geometryHash !== geometryHash ||
        matches[0].geographyHash !== d.geographyHash ||
        matches[0].recoveryEpoch !== authority.recoveryEpoch ||
        matches[0].directoryGeneration !== authority.directoryGeneration
      )
        throw Error('Installed geometry mismatch');
      return matches[0].version as number;
    }
    // An owner-locked boundary is never replaced by the automatic sweep; a reviewer install may, and keeps the town ready.
    const locked =
      (
        await manager.query(
          'SELECT 1 FROM directory_boundary_lock WHERE "communityId"=$1',
          [request.communityId]
        )
      ).length > 0;
    if (locked && promote) throw Error('Boundary is locked');
    const version = Number(current.candidate.geometryVersion) + 1;
    if (!Number.isSafeInteger(version) || version < 1 || version > 2147483647)
      throw Error('Geometry version exhausted');
    await manager.query(
      'INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights) VALUES ($1,$2,ST_SetSRID(ST_GeomFromGeoJSON($3),4326),$4,$5,$6)',
      [
        request.communityId,
        version,
        json,
        promote?.source ?? d.sourceUrl,
        d.vintage,
        promote?.rights ?? 'Census source; reviewed private installation',
      ]
    );
    await manager.query(
      'UPDATE directory_town SET "geometryVersion"=$2,"geometryStatus"=$3 WHERE "communityId"=$1',
      [request.communityId, version, promote || locked ? 'ready' : 'pending']
    );
    await manager.query(
      `INSERT INTO directory_reviewed_geometry ("communityId","requestId",version,"changeToken","geographyHash","geometryHash","recoveryEpoch","directoryGeneration") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("communityId") DO UPDATE SET "requestId"=EXCLUDED."requestId",version=EXCLUDED.version,"changeToken"=EXCLUDED."changeToken","geographyHash"=EXCLUDED."geographyHash","geometryHash"=EXCLUDED."geometryHash","recoveryEpoch"=EXCLUDED."recoveryEpoch","directoryGeneration"=EXCLUDED."directoryGeneration"`,
      [
        request.communityId,
        request.requestId,
        version,
        d.changeToken,
        d.geographyHash,
        geometryHash,
        authority.recoveryEpoch,
        authority.directoryGeneration,
      ]
    );
    return version;
  });
}
