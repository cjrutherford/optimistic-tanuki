import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import staticDatabase from '../staticDatabase';
import {
  fenceSourceEpoch,
  initializeSourceEpoch,
  rotateSourceEpoch,
} from './community-directory-epoch';
import {
  recordCommunityChange,
  saveCommunityWithDirectoryChange,
} from './community-directory-outbox';
import { CommunityService } from './community.service';
import { Community } from '../../entities/community.entity';
import { CommunityMember } from '../../entities/community-member.entity';

const database = process.env.SOCIAL_EPOCH_TEST === 'disposable-epoch';
(database ? describe : describe.skip)(
  'source epoch authority on PostGIS',
  () => {
    let db: DataSource;
    beforeAll(async () => {
      if (
        process.env.POSTGRES_HOST !== '127.0.0.1' ||
        process.env.POSTGRES_PORT !== '55439' ||
        process.env.POSTGRES_DB !== 'epochfresh'
      )
        throw new Error('Disposable epoch database required');
      process.env.SOCIAL_DIRECTORY_MODE = 'active';
      db = await staticDatabase.initialize();
    });
    // Test-only reset between independent fixtures; production has no unfence operation.
    beforeEach(async () => {
      await db.query(
        `UPDATE community_directory_epoch SET fenced = false, phase = 'active', "activationId" = gen_random_uuid(), owner = gen_random_uuid(), "socialGeneration" = 1, "directoryGeneration" = 1, "directoryRecoveryEpoch" = COALESCE("directoryRecoveryEpoch", gen_random_uuid()) WHERE id = 1`
      );
    });
    afterAll(async () => {
      delete process.env.SOCIAL_DIRECTORY_MODE;
      if (db?.isInitialized) await db.destroy();
    });
    it('preserves legacy events during fenced initialization', async () => {
      const id = randomUUID();
      await db.query(
        'INSERT INTO community_directory_change ("communityId", operation, "sourceEpoch") VALUES ($1, $2, NULL)',
        [id, 'changed']
      );
      const before = await db.query(
        'SELECT * FROM community_directory_change WHERE "communityId" = $1',
        [id]
      );
      await initializeSourceEpoch(db);
      expect(
        (await db.query('SELECT fenced FROM community_directory_epoch'))[0]
          .fenced
      ).toBe(true);
      await db.query('DELETE FROM community_directory_epoch WHERE id = 1');
      expect(
        await db.query(
          'SELECT * FROM community_directory_change WHERE "communityId" = $1',
          [id]
        )
      ).toEqual(before);
      await db.query(
        'DELETE FROM community_directory_change WHERE "communityId" = $1',
        [id]
      );
    });
    it('allows inactive owner, seed and delete operations beyond a small outbox cap', async () => {
      delete process.env.SOCIAL_DIRECTORY_MODE;
      const repo = db.getRepository(Community);
      const members = db.getRepository(CommunityMember);
      const service = new CommunityService(
        repo,
        members,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any
      );
      const prefix = `epoch-fixture-${randomUUID()}`;
      const previousCap = process.env.DIRECTORY_OUTBOX_MAX_EVENTS;
      process.env.DIRECTORY_OUTBOX_MAX_EVENTS = '1';
      try {
        const owner = await service.create(
          { name: `${prefix}-owner`, slug: `${prefix}-owner` } as any,
          'owner',
          'profile'
        );
        const seed = await saveCommunityWithDirectoryChange(
          repo,
          repo.create({
            name: `${prefix}-seed`,
            ownerId: 'owner',
            ownerProfileId: 'profile',
          })
        );
        expect(await members.countBy({ communityId: owner.id })).toBe(1);
        for (let i = 0; i < 3; i++)
          await saveCommunityWithDirectoryChange(
            repo,
            repo.create({
              name: `${prefix}-${i}`,
              ownerId: 'owner',
              ownerProfileId: 'profile',
              isPrivate: true,
            })
          );
        await service.delete(seed.id, 'owner');
        const events = await db.query(
          'SELECT "communityId" FROM community_directory_change WHERE "communityId" = ANY($1::uuid[])',
          [[owner.id, seed.id]]
        );
        expect(events).toHaveLength(0);
        expect(await repo.findOneBy({ id: seed.id })).toBeNull();
      } finally {
        await db.query(
          'DELETE FROM community_directory_change WHERE "communityId" IN (SELECT id FROM community WHERE name LIKE $1)',
          [`${prefix}%`]
        );
        await db.query(
          'DELETE FROM community_member WHERE "communityId" IN (SELECT id FROM community WHERE name LIKE $1)',
          [`${prefix}%`]
        );
        await db.query('DELETE FROM community WHERE name LIKE $1', [
          `${prefix}%`,
        ]);
        process.env.SOCIAL_DIRECTORY_MODE = 'active';
        if (previousCap === undefined)
          delete process.env.DIRECTORY_OUTBOX_MAX_EVENTS;
        else process.env.DIRECTORY_OUTBOX_MAX_EVENTS = previousCap;
      }
    });
    it('fails closed when missing or fenced, and rolls back event writes', async () => {
      const id = randomUUID();
      await expect(
        db.transaction((m) => recordCommunityChange(m, id, 'changed'))
      ).rejects.toThrow('epoch');
      const reader = new CommunityService(
        db.getRepository(Community),
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any
      );
      await expect(reader.findDirectoryCensus(randomUUID())).rejects.toThrow(
        'epoch'
      );
      await initializeSourceEpoch(db);
      await expect(initializeSourceEpoch(db)).rejects.toThrow('already');
      await expect(
        db.transaction((m) => recordCommunityChange(m, id, 'changed'))
      ).rejects.toThrow('epoch');
      expect(
        await db.query(
          'SELECT 1 FROM community_directory_change WHERE "communityId" = $1',
          [id]
        )
      ).toHaveLength(0);
      await fenceSourceEpoch(db);
      await expect(
        db.transaction((m) => recordCommunityChange(m, id, 'changed'))
      ).rejects.toThrow('epoch');
      await rotateSourceEpoch(db);
      const [rotated] = await db.query(
        'SELECT fenced FROM community_directory_epoch WHERE id = 1'
      );
      expect(rotated.fenced).toBe(true);
      await expect(
        db.transaction((m) => recordCommunityChange(m, id, 'changed'))
      ).rejects.toThrow('epoch');
    });
    it('serializes fencing and rotation with an in-flight event transaction', async () => {
      const id = randomUUID();
      const writer = db.createQueryRunner();
      await writer.connect();
      await writer.startTransaction();
      try {
        await recordCommunityChange(writer.manager, id, 'changed');
        const [event] = await writer.query(
          'SELECT "sourceEpoch", "eventNonce" FROM community_directory_change WHERE "communityId" = $1',
          [id]
        );
        const other = db.createQueryRunner();
        await other.connect();
        await other.startTransaction();
        try {
          await other.query("SET LOCAL lock_timeout = '300ms'");
          await expect(
            other.query(
              'SELECT id FROM community_directory_epoch WHERE id = 1 FOR UPDATE'
            )
          ).rejects.toThrow();
        } finally {
          await other.rollbackTransaction();
          await other.release();
        }
        const fencing = fenceSourceEpoch(db);
        await writer.commitTransaction();
        await fencing;
        await rotateSourceEpoch(db);
        const [state] = await db.query(
          'SELECT "sourceEpoch" FROM community_directory_epoch WHERE id = 1'
        );
        expect(event.sourceEpoch).not.toBe(state.sourceEpoch);
        expect(event.eventNonce).toMatch(/^[0-9a-f-]{36}$/);
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
      }
    });
    it('binds live census, snapshots and membership to the locked epoch', async () => {
      const repo = db.getRepository(Community);
      const service = new CommunityService(
        repo,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any
      );
      const [state] = await db.query(
        'SELECT "sourceEpoch" FROM community_directory_epoch WHERE id = 1'
      );
      const epoch = state.sourceEpoch;
      const ids = [
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000001',
        '08000000-0000-4000-8000-000000000001',
      ];
      const prefix = `read-fixture-${randomUUID()}`;
      try {
        for (let i = 0; i < 4; i++)
          await repo.save(
            repo.create({
              id: ids[i],
              name: `${prefix}-${i}`,
              slug: null,
              ownerId: 'owner',
              ownerProfileId: 'profile',
              appScope: i === 3 ? 'social' : 'local-hub',
              isPrivate: i === 2,
              localityType: 'town',
              description: 'private description',
            })
          );
        const page = await service.findDirectoryCensus(epoch, undefined, 1);
        expect(page.communities).toEqual([{ id: ids[0] }]);
        expect(page.nextCursor).toBe(ids[0]);
        await db.transaction(async (manager) => {
          await manager.save(
            Community,
            repo.create({
              id: ids[4],
              name: `${prefix}-late`,
              ownerId: 'owner',
              ownerProfileId: 'profile',
              appScope: 'local-hub',
              isPrivate: false,
              localityType: 'town',
            })
          );
          await recordCommunityChange(manager, ids[4], 'changed');
        });
        expect(
          await db.query(
            'SELECT 1 FROM community_directory_change WHERE "communityId" = $1 AND "sourceEpoch" = $2',
            [ids[4], epoch]
          )
        ).toHaveLength(1);
        expect(
          (await service.findDirectoryCensus(epoch, page.nextCursor!, 10))
            .communities
        ).toEqual([{ id: ids[1] }]);
        const snapshot = await service.directorySnapshot(ids[0], epoch);
        expect(snapshot).toMatchObject({ id: ids[0], slug: null });
        expect(snapshot).not.toHaveProperty('description');
        expect(await service.directorySnapshot(ids[2], epoch)).toBeNull();
        expect(await service.directorySnapshot(ids[3], epoch)).toBeNull();
        await db.transaction((m) =>
          recordCommunityChange(m, ids[2], 'changed')
        );
        const [event] = await db.query(
          'SELECT revision, "eventNonce" FROM community_directory_change WHERE "communityId" = $1',
          [ids[2]]
        );
        expect(
          await service.directoryMembership(
            event.revision,
            ids[2],
            epoch,
            event.eventNonce
          )
        ).toEqual({
          status: 'pending',
          eventNonce: event.eventNonce,
          sourceEpoch: epoch,
          snapshot: null,
        });
        await expect(
          service.directoryMembership(
            event.revision,
            ids[1],
            epoch,
            event.eventNonce
          )
        ).rejects.toThrow('collision');
        await expect(
          service.directoryMembership(
            event.revision,
            ids[2],
            epoch,
            randomUUID()
          )
        ).rejects.toThrow('collision');
        expect(await service.directoryUnread()).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              revision: event.revision,
              communityId: ids[2],
              eventNonce: event.eventNonce,
              sourceEpoch: epoch,
            }),
          ])
        );
        await expect(
          service.directorySnapshot(ids[0], randomUUID())
        ).rejects.toThrow('epoch');
        await expect(
          service.directorySnapshot(ids[0], '' as any)
        ).rejects.toThrow('epoch');
        await fenceSourceEpoch(db);
        await expect(service.findDirectoryCensus(epoch)).rejects.toThrow(
          'epoch'
        );
        await rotateSourceEpoch(db);
        await expect(
          service.directoryMembership(
            event.revision,
            ids[2],
            epoch,
            event.eventNonce
          )
        ).rejects.toThrow('epoch');
        const [next] = await db.query(
          'SELECT "sourceEpoch" FROM community_directory_epoch WHERE id = 1'
        );
        await expect(
          service.directoryMembership(
            event.revision,
            ids[2],
            next.sourceEpoch,
            event.eventNonce
          )
        ).rejects.toThrow('epoch');
      } finally {
        await db.query(
          'DELETE FROM community_directory_change WHERE "communityId" = ANY($1::uuid[])',
          [ids]
        );
        await db.query('DELETE FROM community WHERE id = ANY($1::uuid[])', [
          ids,
        ]);
      }
    });

    it('prevents epoch fencing while a read holds the authority lock', async () => {
      const repo = db.getRepository(Community);
      const [state] = await db.query(
        'SELECT "sourceEpoch" FROM community_directory_epoch WHERE id = 1'
      );
      const original = repo.manager.transaction.bind(repo.manager);
      let release!: () => void;
      let locked!: () => void;
      const acquired = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const transaction = jest
        .spyOn(repo.manager, 'transaction')
        .mockImplementationOnce(((fn: any) =>
          original(async (manager) => {
            const query = manager.query.bind(manager);
            manager.query = (async (...args: any[]) => {
              const result = await query(args[0], args[1]);
              if (String(args[0]).includes('FOR SHARE')) {
                locked();
                await gate;
              }
              return result;
            }) as any;
            return fn(manager);
          })) as any);
      const service = new CommunityService(
        repo,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any
      );
      const read = service.findDirectoryCensus(state.sourceEpoch);
      try {
        await acquired;
        const other = db.createQueryRunner();
        await other.connect();
        await other.startTransaction();
        try {
          await other.query("SET LOCAL lock_timeout = '300ms'");
          await expect(
            other.query(
              'UPDATE community_directory_epoch SET fenced = true WHERE id = 1'
            )
          ).rejects.toThrow();
        } finally {
          await other.rollbackTransaction();
          await other.release();
        }
      } finally {
        release();
        await read;
        transaction.mockRestore();
      }
      await fenceSourceEpoch(db);
      await rotateSourceEpoch(db);
      await expect(
        service.findDirectoryCensus(state.sourceEpoch)
      ).rejects.toThrow('epoch');
    });

    it('allows only fenced recovery reads with restricted, UUID-paged snapshots', async () => {
      const repo = db.getRepository(Community);
      const service = new CommunityService(
        repo,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any
      );
      let [state] = await db.query(
        'SELECT "sourceEpoch" FROM community_directory_epoch WHERE id = 1'
      );
      const ids = [
        '11000000-0000-4000-8000-000000000001',
        '22000000-0000-4000-8000-000000000001',
        '33000000-0000-4000-8000-000000000001',
        '44000000-0000-4000-8000-000000000001',
        '55000000-0000-4000-8000-000000000001',
      ];
      try {
        for (let i = 0; i < 4; i++)
          await repo.save(
            repo.create({
              id: ids[i],
              name: `recovery-${i}`,
              slug: null,
              ownerId: 'owner',
              ownerProfileId: 'profile',
              appScope: i === 3 ? 'social' : 'local-hub',
              isPrivate: i === 2,
              localityType: 'town',
              description: 'private description',
            })
          );
        await expect(
          service.recoveryDirectoryCensus(state.sourceEpoch)
        ).rejects.toThrow('epoch');
        await fenceSourceEpoch(db);
        await expect(
          service.findDirectoryCensus(state.sourceEpoch)
        ).rejects.toThrow('epoch');
        [state] = await db.query(
          'SELECT "sourceEpoch" FROM community_directory_epoch WHERE id = 1'
        );
        await expect(
          service.recoveryDirectoryCensus(randomUUID())
        ).rejects.toThrow('epoch');
        const page = await service.recoveryDirectoryCensus(
          state.sourceEpoch,
          undefined,
          1
        );
        expect(page).toEqual({
          communities: [{ id: ids[0] }],
          nextCursor: ids[0],
        });
        expect(
          await service.recoveryDirectoryCensus(
            state.sourceEpoch,
            page.nextCursor!,
            10
          )
        ).toEqual({ communities: [{ id: ids[1] }], nextCursor: null });
        const snapshot = await service.recoveryDirectorySnapshot(
          ids[0],
          state.sourceEpoch
        );
        expect(snapshot).toMatchObject({ id: ids[0], slug: null });
        expect(snapshot).not.toHaveProperty('description');
        for (const id of ids.slice(2))
          expect(
            await service.recoveryDirectorySnapshot(id, state.sourceEpoch)
          ).toBeNull();
        await db.query('DELETE FROM community WHERE id = $1', [ids[1]]);
        expect(
          await service.recoveryDirectorySnapshot(ids[1], state.sourceEpoch)
        ).toBeNull();
      } finally {
        await db.query(
          'DELETE FROM community_directory_change WHERE "communityId" = ANY($1::uuid[])',
          [ids]
        );
        await db.query('DELETE FROM community WHERE id = ANY($1::uuid[])', [
          ids,
        ]);
        const [current] = await db.query(
          'SELECT fenced FROM community_directory_epoch WHERE id = 1'
        );
        if (current.fenced) await rotateSourceEpoch(db);
      }
    });

    it('holds the epoch shared lock during recovery reads against rotation', async () => {
      await fenceSourceEpoch(db);
      const repo = db.getRepository(Community);
      const [state] = await db.query(
        'SELECT "sourceEpoch" FROM community_directory_epoch WHERE id = 1'
      );
      const original = repo.manager.transaction.bind(repo.manager);
      let release!: () => void, locked!: () => void;
      const acquired = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const spy = jest
        .spyOn(repo.manager, 'transaction')
        .mockImplementationOnce(((fn: any) =>
          original(async (manager) => {
            const query = manager.query.bind(manager);
            manager.query = (async (...args: any[]) => {
              const result = await query(args[0], args[1]);
              if (String(args[0]).includes('FOR SHARE')) {
                locked();
                await gate;
              }
              return result;
            }) as any;
            return fn(manager);
          })) as any);
      const service = new CommunityService(
        repo,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any,
        null as any
      );
      const read = service.recoveryDirectoryCensus(state.sourceEpoch);
      try {
        await acquired;
        const other = db.createQueryRunner();
        await other.connect();
        await other.startTransaction();
        try {
          await other.query("SET LOCAL lock_timeout = '300ms'");
          await expect(
            other.query(
              'UPDATE community_directory_epoch SET "sourceEpoch" = $1 WHERE id = 1',
              [randomUUID()]
            )
          ).rejects.toThrow();
        } finally {
          await other.rollbackTransaction();
          await other.release();
        }
      } finally {
        release();
        await read;
        spy.mockRestore();
      }
      await rotateSourceEpoch(db);
      await expect(
        service.recoveryDirectoryCensus(state.sourceEpoch)
      ).rejects.toThrow('epoch');
    });
  }
);
