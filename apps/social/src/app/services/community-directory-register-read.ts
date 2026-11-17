import type { DirectoryGeographyCurrent } from '@optimistic-tanuki/social-contracts';
import { EntityManager } from 'typeorm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function validUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
async function authority(manager: EntityManager, sourceEpoch: string): Promise<void> {
  if (!manager.queryRunner?.isTransactionActive) throw new Error('Directory register read requires a transaction');
  if (!validUuid(sourceEpoch)) throw new Error('Invalid source epoch');
  const rows = await manager.query('SELECT "sourceEpoch", "registerBaselineEpoch", fenced, phase, "directoryRecoveryEpoch", owner, "directoryGeneration", "preparedPayload" FROM community_directory_epoch WHERE id=1 FOR SHARE');
  const a = rows[0];
  if (rows.length !== 1 || a.fenced !== false || a.phase !== 'capture-only' || a.sourceEpoch !== sourceEpoch || a.registerBaselineEpoch !== sourceEpoch || a.directoryRecoveryEpoch !== null || a.owner !== null || a.directoryGeneration !== null || a.preparedPayload !== null) throw new Error('Social source authority is not capture-only for this baseline');
}
export interface DirectoryRegisterToken { communityId: string; changeToken: string; operation: 'changed' | 'deleted'; }
export interface DirectoryPublicSnapshot { id: string; name: string; slug: string | null; adminArea: string | null; appScope: 'local-hub'; isPrivate: false; localityType: 'city' | 'town'; }
export type DirectoryRegisterRead = { status: 'superseded' } | { status: 'current'; snapshot: DirectoryPublicSnapshot | null };

/** Bounded internal scan. It does not establish current Directory authority. */
export async function scanDirectoryRegister(manager: EntityManager, sourceEpoch: string, afterCommunityId: string | null, limit: number): Promise<DirectoryRegisterToken[]> {
  if (afterCommunityId !== null && !validUuid(afterCommunityId)) throw new Error('Invalid cursor');
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Invalid limit');
  await authority(manager, sourceEpoch);
  const rows = await manager.query(`SELECT "communityId", "changeToken", operation FROM community_directory_register WHERE dirty IS TRUE AND ($1::uuid IS NULL OR "communityId" > $1::uuid) ORDER BY "communityId" LIMIT $2`, [afterCommunityId, limit]);
  if (rows.some((row: DirectoryRegisterToken) => !validUuid(row.communityId) || !validUuid(row.changeToken) || !['changed','deleted'].includes(row.operation))) throw new Error('Invalid register record');
  return rows;
}

/** Exact-token internal read; a null snapshot means current but ineligible or deleted. */
export async function readDirectoryRegisterSnapshot(manager: EntityManager, sourceEpoch: string, communityId: string, changeToken: string): Promise<DirectoryRegisterRead> {
  if (!validUuid(communityId) || !validUuid(changeToken)) throw new Error('Invalid UUID');
  await authority(manager, sourceEpoch);
  const rows = await manager.query(`SELECT r."communityId", r."changeToken", r.operation, (c.id IS NOT NULL) AS eligible, c.name, c.slug, c."adminArea", c."localityType"
    FROM community_directory_register r LEFT JOIN community c ON c.id=r."communityId" AND r.operation='changed'
      AND c."isPrivate" IS FALSE AND c."appScope"='local-hub' AND c."localityType" IN ('city','town') AND c."adminArea" IS DISTINCT FROM 'Development fixture'
    WHERE r."communityId"=$1 AND r."changeToken"=$2 AND r.dirty IS TRUE`, [communityId, changeToken]);
  if (!rows.length) return {status:'superseded'};
  const row = rows[0];
  if (rows.length !== 1 || !['changed','deleted'].includes(row.operation)) throw new Error('Invalid register record');
  if (!row.eligible) return {status:'current', snapshot:null};
  return {status:'current', snapshot:{id:row.communityId, name:row.name, slug:row.slug, adminArea:row.adminArea, appScope:'local-hub', isPrivate:false, localityType:row.localityType}};
}

export interface SocialCaptureIncarnation { sourceEpoch: string; activationId: string; socialGeneration: string }
export type CurrentDirectoryRegister = { status: 'absent' } | { status: 'current'; changeToken: string; snapshot: DirectoryPublicSnapshot | null };

export async function requireCaptureIncarnation(manager: EntityManager, identity: SocialCaptureIncarnation): Promise<void> {
  if (!manager.queryRunner?.isTransactionActive) throw new Error('Directory register read requires a transaction');
  if (!identity || !validUuid(identity.sourceEpoch) || !validUuid(identity.activationId) || typeof identity.socialGeneration !== 'string' || !/^[1-9][0-9]*$/.test(identity.socialGeneration) || BigInt(identity.socialGeneration) > 9223372036854775807n) throw new Error('Invalid source incarnation');
  const authorities = await manager.query('SELECT "sourceEpoch", "registerBaselineEpoch", fenced, phase, "directoryRecoveryEpoch", "activationId", "socialGeneration", owner, "directoryGeneration", "preparedPayload" FROM community_directory_epoch WHERE id=1 FOR SHARE');
  const row = authorities[0];
  if (authorities.length !== 1 || row.fenced !== false || row.phase !== 'capture-only' || row.sourceEpoch !== identity.sourceEpoch || row.registerBaselineEpoch !== identity.sourceEpoch || row.activationId !== identity.activationId || row.socialGeneration !== identity.socialGeneration || row.directoryRecoveryEpoch !== null || row.owner !== null || row.directoryGeneration !== null || row.preparedPayload !== null) throw new Error('Social source authority unavailable');
}

export async function scanDirectoryRegisterV2(manager: EntityManager, identity: SocialCaptureIncarnation, afterCommunityId: string | null, limit: number): Promise<DirectoryRegisterToken[]> {
  await requireCaptureIncarnation(manager, identity);
  return scanDirectoryRegister(manager, identity.sourceEpoch, afterCommunityId, limit);
}
export async function readDirectoryRegisterSnapshotV2(manager: EntityManager, identity: SocialCaptureIncarnation, communityId: string, changeToken: string): Promise<DirectoryRegisterRead> {
  await requireCaptureIncarnation(manager, identity);
  return readDirectoryRegisterSnapshot(manager, identity.sourceEpoch, communityId, changeToken);
}

/** Internal repair read. External fencing is still needed for restore or refence. */
export async function readCurrentDirectoryRegister(manager: EntityManager, identity: SocialCaptureIncarnation, communityId: string): Promise<CurrentDirectoryRegister> {
  if (!validUuid(communityId)) throw new Error('Invalid community ID');
  await requireCaptureIncarnation(manager, identity);
  const rows = await manager.query(`SELECT r."communityId", r."changeToken", r.operation, r.dirty, (c.id IS NOT NULL) AS exists,
    (eligible.id IS NOT NULL) AS eligible, eligible.name, eligible.slug, eligible."adminArea", eligible."localityType"
    FROM (SELECT $1::uuid AS id) requested
    LEFT JOIN community_directory_register r ON r."communityId"=requested.id
    LEFT JOIN community c ON c.id=requested.id
    LEFT JOIN community eligible ON eligible.id=c.id AND eligible."isPrivate" IS FALSE AND eligible."appScope"='local-hub' AND eligible."localityType" IN ('city','town') AND eligible."adminArea" IS DISTINCT FROM 'Development fixture'`, [communityId]);
  if (rows.length !== 1) throw new Error('Invalid register read');
  const current = rows[0];
  if (current.communityId === null) {
    if (current.exists) throw new Error('Directory register invariant violated');
    return {status:'absent'};
  }
  if (!validUuid(current.changeToken) || current.dirty !== true || (current.exists ? current.operation !== 'changed' : current.operation !== 'deleted')) throw new Error('Directory register invariant violated');
  const snapshot = current.eligible ? {id:communityId, name:current.name, slug:current.slug, adminArea:current.adminArea, appScope:'local-hub' as const, isPrivate:false as const, localityType:current.localityType as 'city' | 'town'} : null;
  return {status:'current', changeToken:current.changeToken, snapshot};
}

/** Minimal eligible geography for private boundary discovery; no boundary identity is inferred. */
export async function readCurrentDirectoryGeography(manager: EntityManager, identity: SocialCaptureIncarnation, communityId: string): Promise<DirectoryGeographyCurrent> {
  if (!validUuid(communityId)) throw new Error('Invalid community ID');
  await requireCaptureIncarnation(manager, identity);
  const rows = await manager.query(`SELECT r."communityId", r."changeToken", r.operation, r.dirty, (c.id IS NOT NULL) AS exists,
    (eligible.id IS NOT NULL) AS eligible, eligible.name, eligible.city, eligible."adminArea", eligible."countryCode", eligible."localityType", eligible.lat, eligible.lng
    FROM (SELECT $1::uuid AS id) requested
    LEFT JOIN community_directory_register r ON r."communityId"=requested.id
    LEFT JOIN community c ON c.id=requested.id
    LEFT JOIN community eligible ON eligible.id=c.id AND eligible."isPrivate" IS FALSE AND eligible."appScope"='local-hub' AND eligible."localityType" IN ('city','town') AND eligible."adminArea" IS DISTINCT FROM 'Development fixture'`, [communityId]);
  if (rows.length !== 1) throw new Error('Invalid register read');
  const row = rows[0];
  if (row.communityId === null) {
    if (row.exists) throw new Error('Directory register invariant violated');
    return {status:'absent'};
  }
  if (!validUuid(row.changeToken) || row.dirty !== true || (row.exists ? row.operation !== 'changed' : row.operation !== 'deleted')) throw new Error('Directory register invariant violated');
  if (!row.eligible) return {status:'current',changeToken:row.changeToken,geography:null};
  if (!['city','town'].includes(row.localityType)) throw new Error('Invalid eligible locality type');
  const text = (value: unknown, limit: number): string | null => typeof value === 'string' && value.trim() && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value) ? value : null;
  const coordinate = (value: unknown): number | null => {
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value))) return null;
    const n=Number(value);return Number.isFinite(n) ? n : null;
  };
  const lat=coordinate(row.lat),lng=coordinate(row.lng);
  const referencePoint: [number, number] | null = lat !== null && lng !== null && Math.abs(lat)<=90 && Math.abs(lng)<=180 ? [lng,lat] : null;
  return {status:'current',changeToken:row.changeToken,geography:{communityId,name:text(row.name,255),city:text(row.city,100),adminArea:text(row.adminArea,100),countryCode:text(row.countryCode,3),localityType:row.localityType,referencePoint}};
}
