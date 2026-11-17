import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import staticDatabase from '../staticDatabase';
import { deleteExactDirectoryAckV2 } from './directory-ack-v2';
import { Community } from '../../entities/community.entity';
import { CommunityDirectoryChange } from '../../entities/community-directory-change.entity';
import { recordCommunityChange, saveCommunityWithDirectoryChange } from './community-directory-outbox';

const enabled = process.env.SOCIAL_OUTBOX_TEST === 'disposable-s3fresh';
const describeDatabase = enabled ? describe : describe.skip;

describeDatabase('community directory outbox PostgreSQL', () => {
  let db: DataSource;
  const previousMode = process.env.SOCIAL_DIRECTORY_MODE;
  const fixtureEpoch = randomUUID();
  const prefix = `outbox-test-${randomUUID()}`;
  beforeAll(async () => {
    if (process.env.POSTGRES_HOST !== '127.0.0.1' || process.env.POSTGRES_DB !== 's3fresh') throw new Error('Disposable database required');
    db = await staticDatabase.initialize();
    if ((await db.query('SELECT 1 FROM community_directory_epoch LIMIT 1')).length || (await db.query('SELECT 1 FROM community_directory_change LIMIT 1')).length) throw new Error('Empty disposable outbox and epoch required');
    await db.query('INSERT INTO community_directory_epoch (id, "sourceEpoch", "directoryRecoveryEpoch", fenced, "initializedAt", "updatedAt") VALUES (1, $1, gen_random_uuid(), false, now(), now())', [fixtureEpoch]);
    process.env.SOCIAL_DIRECTORY_MODE = 'active';
  });
  afterAll(async () => {
    if (db?.isInitialized) {
      await db.query('DELETE FROM community_directory_change WHERE "communityId" IN (SELECT id FROM community WHERE name LIKE $1)', [`${prefix}%`]);
      await db.query('DELETE FROM community WHERE name LIKE $1', [`${prefix}%`]);
      await db.query('DELETE FROM community_directory_epoch WHERE id = 1 AND "sourceEpoch" = $1', [fixtureEpoch]);
      await db.destroy();
    }
    if (previousMode === undefined) delete process.env.SOCIAL_DIRECTORY_MODE; else process.env.SOCIAL_DIRECTORY_MODE = previousMode;
  });
  it('deletes only an exact v2 identity, supports retries, rollback and concurrent deletion', async () => {
    const repo = db.getRepository(Community);
    const saved = await saveCommunityWithDirectoryChange(repo, repo.create({ name: `${prefix}-ack`, ownerId: 'test', ownerProfileId: 'test' }));
    const changes = db.getRepository(CommunityDirectoryChange);
    const change = await changes.findOneByOrFail({ communityId: saved.id });
    const identity = { revision: change.revision, communityId: saved.id, eventNonce: change.eventNonce, sourceEpoch: fixtureEpoch, recoveryEpoch: randomUUID() };
    for (const field of ['communityId', 'eventNonce', 'sourceEpoch'] as const) {
      await expect(db.transaction(m => deleteExactDirectoryAckV2(m, { ...identity, [field]: randomUUID() }))).rejects.toThrow();
    }
    expect(await changes.countBy({ revision: change.revision })).toBe(1);
    await expect(db.transaction(async m => { await deleteExactDirectoryAckV2(m, identity); throw new Error('rollback'); })).rejects.toThrow('rollback');
    expect(await changes.countBy({ revision: change.revision })).toBe(1);
    const results = await Promise.all([db.transaction(m => deleteExactDirectoryAckV2(m, identity)), db.transaction(m => deleteExactDirectoryAckV2(m, identity))]);
    expect(results.sort()).toEqual(['already-absent', 'deleted']);
    expect(await db.transaction(m => deleteExactDirectoryAckV2(m, identity))).toBe('already-absent');
  });
  it('rolls back the community when the outbox insert fails and commits both on success', async () => {
    const repo = db.getRepository(Community);
    const community = () => repo.create({ name: `${prefix}-rollback`, ownerId: 'test', ownerProfileId: 'test' });
    await expect(db.transaction(async manager => {
      await manager.save(Community, community());
      await recordCommunityChange(manager, 'invalid-uuid', 'changed');
    })).rejects.toThrow();
    expect(await repo.countBy({ name: `${prefix}-rollback` })).toBe(0);
    const saved = await saveCommunityWithDirectoryChange(repo, repo.create({ name: `${prefix}-commit`, ownerId: 'test', ownerProfileId: 'test' }));
    expect(await db.getRepository(CommunityDirectoryChange).countBy({ communityId: saved.id, operation: 'changed' })).toBe(1);
  });
});
