import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import staticDatabase from '../staticDatabase';
import { Community } from '../../entities/community.entity';
import { CommunityService } from './community.service';
import { CommunityMemberRole } from '../../entities/community-member.entity';

const optIn = process.env.SOCIAL_WRITER_RACE_TEST;
if (optIn !== undefined && optIn !== 'disposable-s3social')
  throw new Error('Invalid disposable writer race test marker');
const enabled = optIn === 'disposable-s3social';
(enabled ? describe : describe.skip)(
  'community manager writes preserve concurrent privacy changes',
  () => {
    let db: DataSource;
    let repo: Repository<Community>;
    let id: string;
    beforeAll(async () => {
      if (
        process.env.POSTGRES_HOST !== '127.0.0.1' ||
        process.env.POSTGRES_DB !== 's3social'
      )
        throw new Error('Disposable database required');
      db = await staticDatabase.initialize();
      repo = db.getRepository(Community);
    });
    beforeEach(async () => {
      const community = await repo.save(
        repo.create({
          name: `privacy-race-${randomUUID()}`,
          ownerId: 'owner',
          ownerProfileId: 'owner',
          isPrivate: false,
          memberCount: 1,
        })
      );
      id = community.id;
    });
    afterEach(async () => {
      await repo.delete(id);
    });
    afterAll(async () => {
      if (db?.isInitialized) await db.destroy();
    });

    it.each(['appoint', 'revoke'])(
      '%s does not restore a stale public value',
      async (action) => {
        const stale = await repo.findOneByOrFail({ id });
        const service = Object.create(
          CommunityService.prototype
        ) as CommunityService;
        (service as any).communityRepo = repo;
        jest.spyOn(service, 'findOne').mockImplementation(async () => {
          await repo.update({ id }, { isPrivate: true });
          return stale;
        });
        if (action === 'appoint')
          await service.appointManager(id, 'manager', 'profile');
        else await service.revokeManager(id);
        const result = await repo.findOneByOrFail({ id });
        expect(result.isPrivate).toBe(true);
        expect(result.managerId).toBe(action === 'appoint' ? 'manager' : null);
      }
    );
    it('membership removal does not restore a stale public value', async () => {
      const stale = await repo.findOneByOrFail({ id });
      const service = Object.create(
        CommunityService.prototype
      ) as CommunityService;
      (service as any).communityRepo = repo;
      (service as any).memberRepo = {
        remove: jest.fn().mockResolvedValue(undefined),
      };
      jest
        .spyOn(service, 'getMember')
        .mockResolvedValue({ role: CommunityMemberRole.MEMBER } as any);
      jest.spyOn(service, 'findOne').mockImplementation(async () => {
        await repo.update({ id }, { isPrivate: true });
        return stale;
      });
      await service.leave(id, 'member');
      const result = await repo.findOneByOrFail({ id });
      expect(result.isPrivate).toBe(true);
      expect(result.memberCount).toBe(0);
    });

    it('an unrelated community update preserves concurrent privacy changes', async () => {
      const stale = await repo.findOneByOrFail({ id });
      const service = Object.create(
        CommunityService.prototype
      ) as CommunityService;
      (service as any).communityRepo = repo;
      jest
        .spyOn(service, 'getMember')
        .mockResolvedValue({ role: CommunityMemberRole.OWNER } as any);
      jest.spyOn(service, 'findOne').mockImplementation(async () => {
        await repo.update({ id }, { isPrivate: true });
        return stale;
      });
      await service.update(id, { description: 'new description' }, 'owner');
      const result = await repo.findOneByOrFail({ id });
      expect(result.isPrivate).toBe(true);
      expect(result.description).toBe('new description');
    });
  }
);
