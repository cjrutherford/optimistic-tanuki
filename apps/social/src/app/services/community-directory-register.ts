import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';

/** Capture is transactional and source-local; this does not authorize a consumer. */
export async function recordDirectoryRegisterChange(
  manager: EntityManager,
  communityId: string,
  operation: 'changed' | 'deleted'
): Promise<void> {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Directory register requires a transaction');
  if (operation !== 'changed' && operation !== 'deleted')
    throw new Error('Invalid directory register operation');
  await manager.query(
    `INSERT INTO community_directory_register ("communityId", "changeToken", operation, dirty, "updatedAt")
    VALUES ($1, $2, $3, true, now())
    ON CONFLICT ("communityId") DO UPDATE SET "changeToken"=EXCLUDED."changeToken", operation=EXCLUDED.operation, dirty=true, "updatedAt"=now()`,
    [communityId, randomUUID(), operation]
  );
}
