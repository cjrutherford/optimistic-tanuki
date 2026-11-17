import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import staticDatabase from '../staticDatabase';
import { recordDirectoryRegisterChange } from './community-directory-register';
import {
  recordCommunityChange,
  saveCommunityWithDirectoryChange,
} from './community-directory-outbox';
import { Community } from '../../entities/community.entity';

const marker = process.env.SOCIAL_REGISTER_TEST;
if (marker !== undefined && marker !== 'disposable-s3social')
  throw new Error('Invalid disposable register test marker');
(marker === 'disposable-s3social' ? describe : describe.skip)(
  'directory register transaction',
  () => {
    let db: DataSource;
    const id = randomUUID();
    beforeAll(async () => {
      if (
        process.env.POSTGRES_HOST !== '127.0.0.1' ||
        process.env.POSTGRES_DB !== 's3social'
      )
        throw new Error('Disposable database required');
      db = await staticDatabase.initialize();
    });
    afterAll(async () => {
      if (db?.isInitialized) {
        await db.query(
          'DELETE FROM community_directory_register WHERE "communityId"=$1',
          [id]
        );
        await db.destroy();
      }
    });
    it('coalesces mutations, preserves a tombstone, and rolls back with the transaction', async () => {
      await db.transaction((m) =>
        recordDirectoryRegisterChange(m, id, 'changed')
      );
      const [first] = await db.query(
        'SELECT * FROM community_directory_register WHERE "communityId"=$1',
        [id]
      );
      await db.transaction((m) =>
        recordDirectoryRegisterChange(m, id, 'deleted')
      );
      const [deleted] = await db.query(
        'SELECT * FROM community_directory_register WHERE "communityId"=$1',
        [id]
      );
      expect(deleted.operation).toBe('deleted');
      expect(deleted.changeToken).not.toBe(first.changeToken);
      await expect(
        db.transaction(async (m) => {
          await recordDirectoryRegisterChange(m, id, 'changed');
          throw new Error('rollback');
        })
      ).rejects.toThrow('rollback');
      const rows = await db.query(
        'SELECT * FROM community_directory_register WHERE "communityId"=$1',
        [id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].changeToken).toBe(deleted.changeToken);
      expect(rows[0].operation).toBe('deleted');
    });
    it('captures real inactive-mode writes and retains a tombstone without altering legacy events', async () => {
      const previousMode = process.env.SOCIAL_DIRECTORY_MODE;
      delete process.env.SOCIAL_DIRECTORY_MODE;
      const repo = db.getRepository(Community);
      let communityId: string | undefined;
      let legacyRevision: string | undefined;
      try {
        const [legacy] = await db.query(
          `INSERT INTO community_directory_change ("communityId", operation, "sourceEpoch") VALUES ($1, 'deleted', NULL) RETURNING revision`,
          [randomUUID()]
        );
        legacyRevision = legacy.revision;
        const before = await db.query(
          'SELECT count(*)::int AS n FROM community_directory_change'
        );
        const community = await saveCommunityWithDirectoryChange(
          repo,
          repo.create({
            name: `register-${randomUUID()}`,
            ownerId: 'owner',
            ownerProfileId: 'owner',
          })
        );
        communityId = community.id;
        const [created] = await db.query(
          'SELECT * FROM community_directory_register WHERE "communityId"=$1',
          [communityId]
        );
        expect(created.operation).toBe('changed');
        await db.transaction(async (manager) => {
          await manager.delete(Community, communityId);
          await recordCommunityChange(manager, communityId!, 'deleted');
        });
        const [deleted] = await db.query(
          'SELECT * FROM community_directory_register WHERE "communityId"=$1',
          [communityId]
        );
        expect(deleted.operation).toBe('deleted');
        expect(deleted.changeToken).not.toBe(created.changeToken);
        expect(
          await db.query(
            'SELECT count(*)::int AS n FROM community_directory_change'
          )
        ).toEqual(before);
      } finally {
        if (legacyRevision)
          await db.query(
            'DELETE FROM community_directory_change WHERE revision=$1',
            [legacyRevision]
          );
        if (communityId) {
          await repo.delete(communityId);
          await db.query(
            'DELETE FROM community_directory_register WHERE "communityId"=$1',
            [communityId]
          );
        }
        if (previousMode === undefined)
          delete process.env.SOCIAL_DIRECTORY_MODE;
        else process.env.SOCIAL_DIRECTORY_MODE = previousMode;
      }
    });

    it('serializes concurrent changes to one community without losing the later write', async () => {
      const first = db.createQueryRunner();
      const second = db.createQueryRunner();
      await first.connect();
      await second.connect();
      try {
        await first.startTransaction();
        await second.startTransaction();
        await recordDirectoryRegisterChange(first.manager, id, 'changed');
        const pending = recordDirectoryRegisterChange(
          second.manager,
          id,
          'deleted'
        );
        await first.commitTransaction();
        await pending;
        await second.commitTransaction();
        const rows = await db.query(
          'SELECT operation FROM community_directory_register WHERE "communityId"=$1',
          [id]
        );
        expect(rows).toEqual([{ operation: 'deleted' }]);
      } finally {
        if (first.isTransactionActive) await first.rollbackTransaction();
        if (second.isTransactionActive) await second.rollbackTransaction();
        await first.release();
        await second.release();
      }
    });
  }
);
