import { DataSource } from 'typeorm';

/**
 * Operator-only baseline. The caller must stop and drain all Social/Directory
 * processes and direct database writers before calling, and keep them fenced.
 * The flag records an operator assertion; it cannot enforce that external fence.
 */
export async function initializeDirectoryRegister(
  db: DataSource,
  externalFenceConfirmed: boolean
): Promise<void> {
  if (externalFenceConfirmed !== true)
    throw new Error('An external fence is required');
  await db.transaction(async (manager) => {
    await manager.query("SET LOCAL lock_timeout = '3s'");
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('community-directory-epoch-init-v1', 0))"
    );
    const authority = await manager.query(
      'SELECT fenced, phase FROM community_directory_epoch WHERE id = 1 FOR UPDATE'
    );
    if (
      authority.length !== 1 ||
      authority[0].fenced !== true ||
      authority[0].phase !== 'fenced'
    ) {
      throw new Error('Social authority must be fenced');
    }
    // This protects the baseline transaction even from direct writers that do
    // not participate in the advisory lock. The external fence must continue
    // after commit and must include every process and direct writer.
    await manager.query(
      'LOCK TABLE community, community_directory_change, community_directory_register IN SHARE ROW EXCLUSIVE MODE'
    );
    const conflicts =
      await manager.query(`SELECT 1 FROM community_directory_register r
      LEFT JOIN community c ON c.id = r."communityId"
      WHERE r.dirty IS NOT TRUE OR r.operation <> CASE WHEN c.id IS NULL THEN 'deleted' ELSE 'changed' END LIMIT 1`);
    if (conflicts.length)
      throw new Error(
        'Directory register contains contradictory or clean records; manual reconciliation required'
      );
    await manager.query(`INSERT INTO community_directory_register ("communityId", "changeToken", operation, dirty, "updatedAt")
      SELECT ids.id, gen_random_uuid(), CASE WHEN c.id IS NULL THEN 'deleted' ELSE 'changed' END, true, now()
      FROM (SELECT id FROM community UNION SELECT "communityId" FROM community_directory_change) ids
      LEFT JOIN community c ON c.id = ids.id
      ON CONFLICT ("communityId") DO NOTHING`);
    await manager.query(
      'UPDATE community_directory_epoch SET "registerBaselineEpoch" = "sourceEpoch", "updatedAt" = now() WHERE id = 1'
    );
  });
}
