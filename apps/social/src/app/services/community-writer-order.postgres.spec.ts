import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import staticDatabase from '../staticDatabase';
import { Community } from '../../entities/community.entity';
import { CommunityMemberRole } from '../../entities/community-member.entity';
import { CommunityService } from './community.service';

const marker = process.env.SOCIAL_ORDER_TEST;
if (marker !== undefined && marker !== 'disposable-s3social')
  throw new Error('Invalid disposable order test marker');
(marker === 'disposable-s3social' ? describe : describe.skip)(
  'community write and delete ordering',
  () => {
    let db: DataSource;
    let repo: Repository<Community>;
    let community: Community;
    let previousMode: string | undefined;
    beforeAll(async () => {
      if (
        process.env.POSTGRES_HOST !== '127.0.0.1' ||
        process.env.POSTGRES_DB !== 's3social'
      )
        throw new Error('Disposable database required');
      db = await staticDatabase.initialize();
      repo = db.getRepository(Community);
      previousMode = process.env.SOCIAL_DIRECTORY_MODE;
      delete process.env.SOCIAL_DIRECTORY_MODE;
    });
    beforeEach(async () => {
      community = await repo.save(
        repo.create({
          name: `order-${randomUUID()}`,
          ownerId: 'owner',
          ownerProfileId: 'owner',
        })
      );
    });
    afterEach(async () => {
      await repo.delete(community.id);
      await db.query(
        'DELETE FROM community_directory_register WHERE "communityId"=$1',
        [community.id]
      );
    });
    afterAll(async () => {
      if (previousMode === undefined) delete process.env.SOCIAL_DIRECTORY_MODE;
      else process.env.SOCIAL_DIRECTORY_MODE = previousMode;
      if (db?.isInitialized) await db.destroy();
    });

    function gatedService(method: 'save' | 'remove') {
      let release!: () => void, reached!: (pid: number) => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const ready = new Promise<number>((r) => {
        reached = r;
      });
      const wrapped = {
        manager: {
          transaction: (fn: (m: EntityManager) => Promise<unknown>) =>
            repo.manager.transaction(async (manager) => {
              const [{ pid }] = await manager.query(
                'SELECT pg_backend_pid() AS pid'
              );
              const original = manager[method].bind(manager);
              (manager as any)[method] = async (...args: any[]) => {
                const value = await (original as any)(...args);
                reached(pid);
                await gate;
                return value;
              };
              return fn(manager);
            }),
        },
      };
      const service = Object.create(
        CommunityService.prototype
      ) as CommunityService;
      (service as any).communityRepo = wrapped;
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...community });
      jest
        .spyOn(service, 'getMember')
        .mockResolvedValue({ role: CommunityMemberRole.OWNER } as any);
      return { service, ready, release };
    }
    function regularService() {
      let reportPid!: (pid: number) => void;
      const started = new Promise<number>((resolve) => {
        reportPid = resolve;
      });
      const wrapped = {
        manager: {
          transaction: (fn: (m: EntityManager) => Promise<unknown>) =>
            repo.manager.transaction(async (manager) => {
              const [{ pid }] = await manager.query(
                'SELECT pg_backend_pid() AS pid'
              );
              reportPid(pid);
              return fn(manager);
            }),
        },
      };
      const service = Object.create(
        CommunityService.prototype
      ) as CommunityService;
      (service as any).communityRepo = wrapped;
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...community });
      jest
        .spyOn(service, 'getMember')
        .mockResolvedValue({ role: CommunityMemberRole.OWNER } as any);
      return { service, started };
    }
    async function expectBlocked(pid: number, blocker: number): Promise<void> {
      for (let attempt = 0; attempt < 50; attempt++) {
        const [{ blocked }] = await db.query(
          'SELECT $2::integer = ANY(pg_blocking_pids($1)) AS blocked',
          [pid, blocker]
        );
        if (blocked) return;
        await db.query('SELECT pg_sleep(0.02)');
      }
      throw new Error(
        'Competing database transaction was not observed blocked'
      );
    }
    it('orders an in-flight update before deletion and leaves a tombstone', async () => {
      const first = gatedService('save');
      const updating = first.service.update(
        community.id,
        { description: 'updated' },
        'owner'
      );
      const blocker = await first.ready;
      const second = regularService();
      const deleting = second.service.delete(community.id, 'owner');
      try {
        await expectBlocked(await second.started, blocker);
      } finally {
        first.release();
      }
      await updating;
      await deleting;
      expect(await repo.findOneBy({ id: community.id })).toBeNull();
      expect(
        await db.query(
          'SELECT operation FROM community_directory_register WHERE "communityId"=$1',
          [community.id]
        )
      ).toEqual([{ operation: 'deleted' }]);
    });
    it('does not resurrect a community when deletion completes before a stale update', async () => {
      const first = gatedService('remove');
      const deleting = first.service.delete(community.id, 'owner');
      const blocker = await first.ready;
      const second = regularService();
      const updating = second.service
        .update(community.id, { description: 'stale' }, 'owner')
        .then(
          () => null,
          (error) => error
        );
      try {
        await expectBlocked(await second.started, blocker);
      } finally {
        first.release();
      }
      await deleting;
      expect((await updating)?.driverError?.code).toBe('23502');
      expect(await repo.findOneBy({ id: community.id })).toBeNull();
      expect(
        await db.query(
          'SELECT operation FROM community_directory_register WHERE "communityId"=$1',
          [community.id]
        )
      ).toEqual([{ operation: 'deleted' }]);
    });
  }
);
