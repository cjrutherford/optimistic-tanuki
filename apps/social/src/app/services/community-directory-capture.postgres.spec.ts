import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import staticDatabase from '../staticDatabase';
import {
  beginRecovery,
  enableRegisterCapture,
} from './community-directory-epoch';
import { initializeDirectoryRegister } from './community-directory-register-initialize';
import {
  lockCommunityDirectoryWrite,
  recordCommunityChange,
  saveCommunityWithDirectoryChange,
} from './community-directory-outbox';
import { CommunityMemberRole } from '../../entities/community-member.entity';
import { lockSocialRuntimeAuthority } from './social-authority';
import { CommunityService } from './community.service';
import { Community } from '../../entities/community.entity';

const enabled = process.env.SOCIAL_CAPTURE_TEST === 'disposable';
(enabled ? describe : describe.skip)(
  'capture-only authority (disposable Postgres)',
  () => {
    let db: DataSource;
    const previousMode = process.env.SOCIAL_DIRECTORY_MODE;
    const previousCap = process.env.DIRECTORY_OUTBOX_MAX_EVENTS;
    beforeAll(async () => {
      if (
        process.env.POSTGRES_HOST !== '127.0.0.1' ||
        process.env.POSTGRES_PORT !== '55439' ||
        process.env.POSTGRES_DB !== 'social_capture'
      )
        throw new Error('Disposable database required');
      db = await staticDatabase.initialize();
    });
    beforeEach(async () => {
      await db.query('DELETE FROM community_directory_register');
      await db.query('DELETE FROM community_directory_change');
      await db.query('DELETE FROM community_directory_epoch');
      await beginRecovery(db);
    });
    afterAll(async () => {
      if (previousMode === undefined) delete process.env.SOCIAL_DIRECTORY_MODE;
      else process.env.SOCIAL_DIRECTORY_MODE = previousMode;
      if (previousCap === undefined)
        delete process.env.DIRECTORY_OUTBOX_MAX_EVENTS;
      else process.env.DIRECTORY_OUTBOX_MAX_EVENTS = previousCap;
      if (db?.isInitialized) await db.destroy();
    });
    it('requires successful baseline, confirmation, and an unbound matching epoch', async () => {
      await expect(enableRegisterCapture(db, true)).rejects.toThrow(
        'Initialized unbound'
      );
      await expect(initializeDirectoryRegister(db, false)).rejects.toThrow(
        'external fence'
      );
      const id = randomUUID();
      await db.query(
        `INSERT INTO community_directory_register ("communityId", "changeToken", operation, dirty) VALUES ($1,$2,'changed',true)`,
        [id, randomUUID()]
      );
      await expect(initializeDirectoryRegister(db, true)).rejects.toThrow(
        'contradictory'
      );
      expect(
        (
          await db.query(
            'SELECT "registerBaselineEpoch" FROM community_directory_epoch'
          )
        )[0].registerBaselineEpoch
      ).toBeNull();
      await db.query('DELETE FROM community_directory_register');
      await initializeDirectoryRegister(db, true);
      const [row] = await db.query('SELECT * FROM community_directory_epoch');
      expect(row.registerBaselineEpoch).toBe(row.sourceEpoch);
      await expect(enableRegisterCapture(db, false)).rejects.toThrow(
        'external fence'
      );
      await db.query(
        'UPDATE community_directory_epoch SET "activationId"=NULL'
      );
      await expect(enableRegisterCapture(db, true)).rejects.toThrow('unbound');
      await db.query(
        'UPDATE community_directory_epoch SET "activationId"=$1, "socialGeneration"=0',
        [row.activationId]
      );
      await expect(enableRegisterCapture(db, true)).rejects.toThrow('unbound');
      await db.query(
        'UPDATE community_directory_epoch SET "socialGeneration"=$1',
        [row.socialGeneration]
      );
      await db.query('UPDATE community_directory_epoch SET owner = $1', [
        randomUUID(),
      ]);
      await expect(enableRegisterCapture(db, true)).rejects.toThrow('unbound');
      await db.query(
        'UPDATE community_directory_epoch SET owner = NULL, "registerBaselineEpoch" = $1',
        [randomUUID()]
      );
      await expect(enableRegisterCapture(db, true)).rejects.toThrow('unbound');
      await db.query(
        'UPDATE community_directory_epoch SET "registerBaselineEpoch" = "sourceEpoch"'
      );
      await enableRegisterCapture(db, true);
      expect(
        (
          await db.query('SELECT fenced, phase FROM community_directory_epoch')
        )[0]
      ).toEqual({ fenced: false, phase: 'capture-only' });
      // Populate every other local active-authority prerequisite inside a rolled
      // back transaction, so the phase is the reason runtime authority is denied.
      const recoveryEpoch = randomUUID();
      await expect(
        db.transaction(async (m) => {
          await m.query(
            `UPDATE community_directory_epoch SET "directoryRecoveryEpoch"=$1, owner=$2, "directoryGeneration"=1, "preparedPayload"=$3::jsonb WHERE id=1`,
            [
              recoveryEpoch,
              randomUUID(),
              JSON.stringify({
                accepted: {
                  version: 'directory-enabled-v1',
                  digest: 'a'.repeat(64),
                },
              }),
            ]
          );
          await expect(
            lockSocialRuntimeAuthority(m, {
              sourceEpoch: row.sourceEpoch,
              recoveryEpoch,
            })
          ).rejects.toThrow('unavailable');
          throw new Error('rollback phase fixture');
        })
      ).rejects.toThrow('rollback phase fixture');
      const service = new CommunityService(
        db.getRepository(Community),
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any
      );
      await expect(
        (service as any).withDirectoryEpoch(
          row.sourceEpoch,
          async () => 'unexpected',
          true
        )
      ).rejects.toThrow();
    });
    it('coalesces through an outage without touching legacy rows or the outbox cap and rolls back', async () => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO community_directory_change ("communityId", operation, "sourceEpoch") VALUES ($1,'changed',NULL)`,
        [id]
      );
      const legacy = await db.query('SELECT * FROM community_directory_change');
      await initializeDirectoryRegister(db, true);
      await enableRegisterCapture(db, true);
      process.env.SOCIAL_DIRECTORY_MODE = 'register-only';
      process.env.DIRECTORY_OUTBOX_MAX_EVENTS = '1';
      await db.transaction(async (m) => {
        for (let i = 0; i < 5; i++)
          await recordCommunityChange(m, id, i === 4 ? 'deleted' : 'changed');
      });
      const [captured] = await db.query(
        'SELECT * FROM community_directory_register WHERE "communityId"=$1',
        [id]
      );
      expect(captured.operation).toBe('deleted');
      expect(captured.dirty).toBe(true);
      expect(
        await db.query('SELECT * FROM community_directory_change')
      ).toEqual(legacy);
      await expect(
        db.transaction(async (m) => {
          await recordCommunityChange(m, id, 'changed');
          throw new Error('rollback');
        })
      ).rejects.toThrow('rollback');
      expect(
        await db.query(
          'SELECT * FROM community_directory_register WHERE "communityId"=$1',
          [id]
        )
      ).toEqual([captured]);
      await beginRecovery(db);
      const [row] = await db.query('SELECT * FROM community_directory_epoch');
      expect(row.fenced).toBe(true);
      expect(row.phase).toBe('fenced');
      expect(row.registerBaselineEpoch).toBeNull();
      await expect(
        db.transaction((m) => lockCommunityDirectoryWrite(m))
      ).rejects.toThrow('capture authority');
      await initializeDirectoryRegister(db, true);
      await enableRegisterCapture(db, true);
      await db.transaction((m) => recordCommunityChange(m, id, 'deleted'));
      const [reentered] = await db.query(
        'SELECT fenced, phase, "sourceEpoch", "registerBaselineEpoch" FROM community_directory_epoch'
      );
      expect(reentered).toMatchObject({
        fenced: false,
        phase: 'capture-only',
        sourceEpoch: row.sourceEpoch,
        registerBaselineEpoch: row.sourceEpoch,
      });
      expect(
        await db.query('SELECT * FROM community_directory_change')
      ).toEqual(legacy);
    });
    it('waits for an in-flight writer before rotating and prevents later writes', async () => {
      await initializeDirectoryRegister(db, true);
      await enableRegisterCapture(db, true);
      process.env.SOCIAL_DIRECTORY_MODE = 'register-only';
      const writer = db.createQueryRunner();
      await writer.connect();
      await writer.startTransaction();
      try {
        await lockCommunityDirectoryWrite(writer.manager);
        const before = (
          await db.query('SELECT "sourceEpoch" FROM community_directory_epoch')
        )[0].sourceEpoch;
        const recovery = beginRecovery(db);
        let waiting = false;
        for (let attempt = 0; attempt < 40 && !waiting; attempt++) {
          const [state] = await db.query(
            `SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event = 'advisory' AND query LIKE '%community-directory-epoch-init-v1%') AS waiting`
          );
          waiting = state.waiting;
          if (!waiting) await new Promise((resolve) => setTimeout(resolve, 25));
        }
        expect(waiting).toBe(true);
        await recordCommunityChange(writer.manager, randomUUID(), 'changed');
        await writer.commitTransaction();
        await recovery;
        const [after] = await db.query(
          'SELECT * FROM community_directory_epoch'
        );
        expect(after.sourceEpoch).not.toBe(before);
        expect(after.registerBaselineEpoch).toBeNull();
        await expect(
          db.transaction((m) => lockCommunityDirectoryWrite(m))
        ).rejects.toThrow('capture authority');
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
      }
    });
    it('captures actual community creation, privacy update and deletion with a full legacy outbox', async () => {
      const legacyId = randomUUID();
      await db.query(
        `INSERT INTO community_directory_change ("communityId", operation, "sourceEpoch") VALUES ($1,'deleted',NULL)`,
        [legacyId]
      );
      const legacy = await db.query('SELECT * FROM community_directory_change');
      await initializeDirectoryRegister(db, true);
      await enableRegisterCapture(db, true);
      process.env.SOCIAL_DIRECTORY_MODE = 'register-only';
      process.env.DIRECTORY_OUTBOX_MAX_EVENTS = '1';
      const repo = db.getRepository(Community);
      const created = await saveCommunityWithDirectoryChange(
        repo,
        repo.create({
          name: `capture-${randomUUID()}`,
          ownerId: 'owner',
          ownerProfileId: 'owner',
          appScope: 'local-hub',
          localityType: 'town',
          isPrivate: false,
        })
      );
      try {
        const [first] = await db.query(
          'SELECT * FROM community_directory_register WHERE "communityId"=$1',
          [created.id]
        );
        const service = Object.create(
          CommunityService.prototype
        ) as CommunityService;
        (service as any).communityRepo = repo;
        jest
          .spyOn(service, 'findOne')
          .mockImplementation(async () => repo.findOneBy({ id: created.id }));
        jest
          .spyOn(service, 'getMember')
          .mockResolvedValue({ role: CommunityMemberRole.OWNER } as any);
        await service.update(created.id, { isPrivate: true }, 'owner');
        const [second] = await db.query(
          'SELECT * FROM community_directory_register WHERE "communityId"=$1',
          [created.id]
        );
        expect(second.changeToken).not.toBe(first.changeToken);
        expect((await repo.findOneByOrFail({ id: created.id })).isPrivate).toBe(
          true
        );
        await service.delete(created.id, 'owner');
        const [deleted] = await db.query(
          'SELECT * FROM community_directory_register WHERE "communityId"=$1',
          [created.id]
        );
        expect(deleted.operation).toBe('deleted');
        expect(deleted.changeToken).not.toBe(second.changeToken);
        expect(await repo.findOneBy({ id: created.id })).toBeNull();
        expect(
          await db.query('SELECT * FROM community_directory_change')
        ).toEqual(legacy);
      } finally {
        await repo.delete(created.id);
        await db.query(
          'DELETE FROM community_directory_register WHERE "communityId"=$1',
          [created.id]
        );
      }
    });
  }
);
