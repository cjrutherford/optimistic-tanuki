import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { requireCaptureIncarnation, SocialCaptureIncarnation } from './community-directory-register-read';
import { lockCommunityDirectoryWrite } from './community-directory-outbox';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Enumerate source IDs independently of register contents, in bounded keyset pages. */
export async function scanSourceCommunities(manager: EntityManager, identity: SocialCaptureIncarnation, afterCommunityId: string | null, limit: number): Promise<string[]> {
  if (afterCommunityId !== null && (typeof afterCommunityId !== 'string' || !UUID.test(afterCommunityId))) throw new Error('Invalid cursor');
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Invalid limit');
  await requireCaptureIncarnation(manager, identity);
  const rows = await manager.query('SELECT id FROM community WHERE ($1::uuid IS NULL OR id > $1::uuid) ORDER BY id LIMIT $2', [afterCommunityId, limit]);
  return rows.map((row: { id: string }) => row.id);
}

/** Repair one ID. Direct SQL writers that bypass the authority lock require a later census. */
export async function repairSourceCommunityRegister(manager: EntityManager, identity: SocialCaptureIncarnation, communityId: string): Promise<{ status: 'unchanged' | 'repaired' }> {
  if (typeof communityId !== 'string' || !UUID.test(communityId)) throw new Error('Invalid community ID');
  await lockCommunityDirectoryWrite(manager);
  await requireCaptureIncarnation(manager, identity);
  const rows = await manager.query(`SELECT (c.id IS NOT NULL) AS exists, r."communityId", r.operation, r.dirty, r."changeToken"
    FROM (SELECT $1::uuid AS id) requested
    LEFT JOIN community c ON c.id=requested.id
    LEFT JOIN community_directory_register r ON r."communityId"=requested.id`, [communityId]);
  const row = rows[0];
  const operation = row.exists ? 'changed' : 'deleted';
  if (row.communityId !== null && row.operation === operation && row.dirty === true && typeof row.changeToken === 'string' && UUID.test(row.changeToken)) return { status: 'unchanged' };
  await manager.query(`INSERT INTO community_directory_register ("communityId", "changeToken", operation, dirty, "updatedAt")
    VALUES ($1, $2, $3, true, now()) ON CONFLICT ("communityId") DO UPDATE SET "changeToken"=EXCLUDED."changeToken", operation=EXCLUDED.operation, dirty=true, "updatedAt"=now()`, [communityId, randomUUID(), operation]);
  return { status: 'repaired' };
}
