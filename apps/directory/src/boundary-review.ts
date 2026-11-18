import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DirectoryRecoveryIdentity } from './register-recovery-authority';
import { lockAuthority } from './register-reconciliation-v2';

export type BoundaryCandidate = {
  communityId: string;
  changeToken: string;
  geoid: string;
  layer: 'place' | 'cousub';
  vintage: string;
  stateFips: string;
  archiveSha256: string;
};
type Geography = {
  communityId?: string;
  name?: string | null;
  city?: string | null;
  adminArea?: string | null;
  countryCode?: string | null;
  localityType?: string;
  referencePoint?: [number, number] | null;
};
export type SourceRead = () => Promise<{
  status: string;
  changeToken?: string;
  geography?: Geography | null;
}>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function geographyHash(
  g: Geography | null | undefined,
  id: string
): string | null {
  const p = g?.referencePoint;
  const text = (v: unknown, n: number) =>
    typeof v === 'string' &&
    !!v.trim() &&
    v.length <= n &&
    !/[\x00-\x1f\x7f]/.test(v);
  if (
    !g ||
    g.communityId !== id ||
    !text(g.name, 255) ||
    !text(g.city, 100) ||
    !text(g.adminArea, 100) ||
    !text(g.countryCode, 3) ||
    !['city', 'town'].includes(g.localityType ?? '') ||
    !Array.isArray(p) ||
    p.length !== 2 ||
    ![0, 1].every(
      (i) =>
        Object.prototype.hasOwnProperty.call(p, i) &&
        typeof p[i] === 'number' &&
        Number.isFinite(p[i])
    ) ||
    Math.abs(p[0]) > 180 ||
    Math.abs(p[1]) > 90
  )
    return null;
  return createHash('sha256')
    .update(
      JSON.stringify([
        g.communityId,
        g.name,
        g.city,
        g.adminArea,
        g.countryCode,
        g.localityType,
        p[0],
        p[1],
      ])
    )
    .digest('hex');
}
/** Private caller assertion, never a verified binding or authorization to serve. */
export async function storeBoundaryCandidate(
  db: DataSource,
  identity: DirectoryRecoveryIdentity,
  candidate: BoundaryCandidate,
  read: SourceRead,
  options: { automatic?: boolean } = {}
): Promise<void> {
  if (
    !candidate ||
    !uuid.test(candidate.communityId) ||
    !uuid.test(candidate.changeToken) ||
    !['place', 'cousub'].includes(candidate.layer) ||
    !(candidate.layer === 'place' ? /^\d{7}$/ : /^\d{10}$/).test(
      candidate.geoid
    ) ||
    !/^\d{4}$/.test(candidate.vintage) ||
    !/^\d{2}$/.test(candidate.stateFips) ||
    !candidate.geoid.startsWith(candidate.stateFips) ||
    !/^[a-f0-9]{64}$/.test(candidate.archiveSha256)
  )
    throw Error('Invalid boundary candidate');
  const value = { ...candidate },
    authority = { ...identity };
  await db.transaction(async (manager) => {
    await lockAuthority(manager, authority);
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [value.communityId]
    );
    if (
      options.automatic &&
      (
        await manager.query(
          'SELECT 1 FROM directory_boundary_lock WHERE "communityId"=$1',
          [value.communityId]
        )
      ).length
    )
      throw Error('Boundary is locked');
    const towns = await manager.query(
      'SELECT eligible FROM directory_town WHERE "communityId"=$1 FOR UPDATE',
      [value.communityId]
    );
    if (
      towns.length !== 1 ||
      towns[0].eligible !== true ||
      typeof read !== 'function'
    )
      throw Error('Eligible town required');
    const current = await read(),
      hash = geographyHash(current?.geography, value.communityId);
    if (
      !current ||
      current.status !== 'current' ||
      current.changeToken !== value.changeToken ||
      !hash
    )
      throw Error('Stale boundary candidate');
    await manager.query(
      'UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "communityId"=$1 AND "invalidatedAt" IS NULL',
      [value.communityId]
    );
    await manager.query(
      'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1',
      [value.communityId]
    );
    await manager.query(
      `INSERT INTO directory_boundary_candidate ("communityId","sourceEpoch","activationId","socialGeneration","changeToken",geoid,layer,vintage,"stateFips","archiveSha256","geographyHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT ("communityId") DO UPDATE SET "sourceEpoch"=EXCLUDED."sourceEpoch","activationId"=EXCLUDED."activationId","socialGeneration"=EXCLUDED."socialGeneration","changeToken"=EXCLUDED."changeToken",geoid=EXCLUDED.geoid,layer=EXCLUDED.layer,vintage=EXCLUDED.vintage,"stateFips"=EXCLUDED."stateFips","archiveSha256"=EXCLUDED."archiveSha256","geographyHash"=EXCLUDED."geographyHash"`,
      [
        value.communityId,
        authority.sourceEpoch,
        authority.activationId,
        authority.socialGeneration,
        value.changeToken,
        value.geoid,
        value.layer,
        value.vintage,
        value.stateFips,
        value.archiveSha256,
        hash,
      ]
    );
  });
}
/** Revalidates a private candidate; caller must separately authenticate any human reviewer. */
export async function readCurrentBoundaryCandidate(
  db: DataSource,
  identity: DirectoryRecoveryIdentity,
  communityId: string,
  read: SourceRead
): Promise<
  | (BoundaryCandidate & {
      geographyHash: string;
      reviewContext: {
        name: string | null | undefined;
        city: string | null | undefined;
        adminArea: string | null | undefined;
        countryCode: string | null | undefined;
        localityType: string | undefined;
      };
    })
  | null
> {
  if (
    typeof communityId !== 'string' ||
    !uuid.test(communityId) ||
    typeof read !== 'function'
  )
    throw Error('Invalid boundary read');
  const authority = { ...identity };
  return db.transaction(async (manager) => {
    await lockAuthority(manager, authority);
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [communityId]
    );
    const rows = await manager.query(
      'SELECT c.*,t.eligible FROM directory_boundary_candidate c JOIN directory_town t ON t."communityId"=c."communityId" WHERE c."communityId"=$1 FOR UPDATE OF c,t',
      [communityId]
    );
    if (!rows.length) return null;
    const row = rows[0],
      current = await read(),
      hash = geographyHash(current?.geography, communityId);
    if (
      row.eligible !== true ||
      row.sourceEpoch !== authority.sourceEpoch ||
      row.activationId !== authority.activationId ||
      row.socialGeneration !== authority.socialGeneration ||
      current?.status !== 'current' ||
      current.changeToken !== row.changeToken ||
      !hash ||
      row.geographyHash !== hash
    ) {
      await manager.query(
        'UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "communityId"=$1 AND "invalidatedAt" IS NULL',
        [communityId]
      );
      await manager.query(
        'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1',
        [communityId]
      );
      await manager.query(
        'DELETE FROM directory_boundary_candidate WHERE "communityId"=$1',
        [communityId]
      );
      return null;
    }
    const g = current.geography!;
    return {
      communityId,
      changeToken: row.changeToken,
      geoid: row.geoid,
      layer: row.layer,
      vintage: row.vintage,
      stateFips: row.stateFips,
      archiveSha256: row.archiveSha256,
      geographyHash: hash,
      reviewContext: {
        name: g.name,
        city: g.city,
        adminArea: g.adminArea,
        countryCode: g.countryCode,
        localityType: g.localityType,
      },
    };
  });
}
