import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import staticDatabase from '../staticDatabase';
import { Community } from '../../entities/community.entity';
import {
  beginRecovery,
  enableRegisterCapture,
} from './community-directory-epoch';
import { initializeDirectoryRegister } from './community-directory-register-initialize';
import {
  scanSourceCommunities,
  repairSourceCommunityRegister,
} from './community-directory-census';

const marker = process.env.SOCIAL_REGISTER_READ_TEST;
if (marker !== undefined && marker !== 'disposable-s3social')
  throw new Error('Invalid disposable register read marker');
(marker === 'disposable-s3social' ? describe : describe.skip)(
  'source census on disposable Social database',
  () => {
    let db: DataSource;
    const originalMode = process.env.SOCIAL_DIRECTORY_MODE;
    beforeAll(async () => {
      if (
        process.env.POSTGRES_HOST !== '127.0.0.1' ||
        process.env.POSTGRES_DB !== 's3social'
      )
        throw new Error('Disposable database required');
      db = await staticDatabase.initialize();
      process.env.SOCIAL_DIRECTORY_MODE = 'register-only';
    });
    afterAll(async () => {
      if (originalMode === undefined) delete process.env.SOCIAL_DIRECTORY_MODE;
      else process.env.SOCIAL_DIRECTORY_MODE = originalMode;
      if (db?.isInitialized) await db.destroy();
    });
    it('finds unregistered source rows and repairs missing and contradictory records idempotently', async () => {
      const repo = db.getRepository(Community);
      const row = await repo.save(
        repo.create({
          name: `census-${randomUUID()}`,
          ownerId: 'fixture',
          ownerProfileId: 'fixture',
          appScope: 'local-hub',
          localityType: 'town',
          isPrivate: false,
        })
      );
      const absent = randomUUID();
      try {
        await beginRecovery(db);
        await initializeDirectoryRegister(db, true);
        await enableRegisterCapture(db, true);
        const [identity] = await db.query(
          'SELECT "sourceEpoch", "activationId", "socialGeneration" FROM community_directory_epoch WHERE id=1'
        );
        await db.query(
          'DELETE FROM community_directory_register WHERE "communityId"=$1',
          [row.id]
        );
        const page = await db.transaction((m) =>
          scanSourceCommunities(m, identity, null, 200)
        );
        expect(page).toContain(row.id);
        expect(
          await db.transaction((m) =>
            repairSourceCommunityRegister(m, identity, row.id)
          )
        ).toEqual({ status: 'repaired' });
        const [first] = await db.query(
          'SELECT * FROM community_directory_register WHERE "communityId"=$1',
          [row.id]
        );
        expect(
          await db.transaction((m) =>
            repairSourceCommunityRegister(m, identity, row.id)
          )
        ).toEqual({ status: 'unchanged' });
        const [same] = await db.query(
          'SELECT * FROM community_directory_register WHERE "communityId"=$1',
          [row.id]
        );
        expect(same.changeToken).toBe(first.changeToken);
        await db.query(
          `UPDATE community_directory_register SET operation='deleted' WHERE "communityId"=$1`,
          [row.id]
        );
        await db.transaction((m) =>
          repairSourceCommunityRegister(m, identity, row.id)
        );
        const [fixed] = await db.query(
          'SELECT * FROM community_directory_register WHERE "communityId"=$1',
          [row.id]
        );
        expect(fixed.operation).toBe('changed');
        expect(fixed.changeToken).not.toBe(first.changeToken);
        await db.transaction((m) =>
          repairSourceCommunityRegister(m, identity, absent)
        );
        const [deleted] = await db.query(
          'SELECT * FROM community_directory_register WHERE "communityId"=$1',
          [absent]
        );
        expect(deleted.operation).toBe('deleted');
        await expect(
          db.transaction((m) =>
            repairSourceCommunityRegister(
              m,
              { ...identity, socialGeneration: '999' },
              row.id
            )
          )
        ).rejects.toThrow('authority');
      } finally {
        await db.query(
          'DELETE FROM community_directory_register WHERE "communityId"=ANY($1::uuid[])',
          [[row.id, absent]]
        );
        await repo.delete(row.id);
        await db.query('DELETE FROM community_directory_epoch WHERE id=1');
      }
    });
  }
);
