import { recordDirectoryRegisterChange } from './community-directory-register';
import { lockSocialRuntimeAuthority, trustedDirectoryRuntimeEpochs, SOCIAL_AUTHORITY_COLUMNS } from './social-authority';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Community } from '../../entities/community.entity';
import { CommunityDirectoryChange } from '../../entities/community-directory-change.entity';

export async function lockCommunityDirectoryWrite(manager: EntityManager): Promise<any | undefined> {
  if (!manager.queryRunner?.isTransactionActive) throw new Error('Directory write requires a transaction');
  const mode = process.env.SOCIAL_DIRECTORY_MODE ?? 'inactive';
  if (mode !== 'inactive' && mode !== 'active' && mode !== 'register-only') throw new Error('Invalid SOCIAL_DIRECTORY_MODE');
  // Serialize absent authority with initialization as well as existing authority changes.
  await manager.query("SELECT pg_advisory_xact_lock(hashtextextended('community-directory-epoch-init-v1', 0))");
  const rows = await manager.query(`SELECT ${SOCIAL_AUTHORITY_COLUMNS}, "registerBaselineEpoch", "preparedPayload" FROM community_directory_epoch WHERE id = 1 FOR UPDATE`);
  if (mode === 'inactive') {
    if (rows.length) throw new Error('Community directory inactive while source epoch authority exists');
    return;
  }
  if (mode === 'register-only') {
    const row = rows[0];
    if (rows.length !== 1 || row.fenced !== false || row.phase !== 'capture-only' || !row.sourceEpoch || row.registerBaselineEpoch !== row.sourceEpoch ||
        row.directoryRecoveryEpoch !== null || row.owner !== null || row.directoryGeneration !== null || row.preparedPayload !== null) {
      throw new Error('Directory capture authority unavailable');
    }
    return row;
  }
  return lockSocialRuntimeAuthority(manager, trustedDirectoryRuntimeEpochs());
}

export async function recordCommunityChange(manager: EntityManager, communityId: string, operation: 'changed' | 'deleted'): Promise<void> {
  const authority = await lockCommunityDirectoryWrite(manager);
  await recordDirectoryRegisterChange(manager, communityId, operation);
  if (!authority || authority.phase === 'capture-only') return;
  const legacy = await manager.query('SELECT 1 FROM community_directory_change WHERE "sourceEpoch" IS NULL LIMIT 1');
  if (legacy.length) throw new Error('Legacy directory events require a separately authorized fenced backfill');
  const sourceEpoch = authority.sourceEpoch;
  // Serialize producers before checking the bound, including uncommitted inserts.
  // Reject the surrounding mutation rather than discard an undelivered event.
  await manager.query("SELECT pg_advisory_xact_lock(hashtextextended('community-directory-outbox-cap-v1', 0))");
  const configured = process.env.DIRECTORY_OUTBOX_MAX_EVENTS ?? '10000';
  if (!/^[1-9][0-9]*$/.test(configured) || !Number.isSafeInteger(Number(configured)) || Number(configured) > 10000000) {
    throw new Error('Invalid DIRECTORY_OUTBOX_MAX_EVENTS');
  }
  const full = await manager.query('SELECT revision FROM community_directory_change ORDER BY revision OFFSET $1 LIMIT 1', [Number(configured) - 1]);
  if (full.length) throw new Error('Community directory outbox is full');
  await manager.insert(CommunityDirectoryChange, { communityId, operation, sourceEpoch, eventNonce: randomUUID() });
}

/** Use for direct seed/import writes as well as service writes. */
export async function saveCommunityWithDirectoryChange(repo: Repository<Community>, community: Community): Promise<Community> {
  return repo.manager.transaction(async manager => {
    await lockCommunityDirectoryWrite(manager);
    const saved = await manager.save(Community, community);
    await recordCommunityChange(manager, saved.id, 'changed');
    return saved;
  });
}
