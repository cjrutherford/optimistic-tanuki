import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { Repository } from 'typeorm';
import { SearchService } from './search.service';
import { SearchHistory } from '../../entities/search-history.entity';
import { Post } from '../../entities/post.entity';
import { Community } from '../../entities/community.entity';
import { ProfileCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import FollowService from './follow.service';
import { PrivacyService } from './privacy.service';

describe('SearchService (visibility scope wiring)', () => {
  let service: SearchService;
  let postRepo: jest.Mocked<Repository<Post>>;
  let followService: { getFollowing: jest.Mock };
  let privacyService: { getBlockedUsers: jest.Mock; getBlockersOf: jest.Mock };
  let profileClient: { send: jest.Mock };

  const mockRepoFactory = () => ({
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    followService = { getFollowing: jest.fn().mockResolvedValue([]) };
    privacyService = {
      getBlockedUsers: jest.fn().mockResolvedValue([]),
      getBlockersOf: jest.fn().mockResolvedValue([]),
    };
    profileClient = { send: jest.fn(() => of([])) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getRepositoryToken(SearchHistory),
          useFactory: mockRepoFactory,
        },
        { provide: getRepositoryToken(Post), useFactory: mockRepoFactory },
        { provide: getRepositoryToken(Community), useFactory: mockRepoFactory },
        { provide: ServiceTokens.PROFILE_SERVICE, useValue: profileClient },
        { provide: FollowService, useValue: followService },
        { provide: PrivacyService, useValue: privacyService },
      ],
    }).compile();

    service = module.get(SearchService);
    postRepo = module.get(getRepositoryToken(Post));
  });

  it('search() posts branch applies the visibility scope with blocked authors excluded', async () => {
    followService.getFollowing.mockResolvedValue([{ followeeId: 'friend' }]);
    privacyService.getBlockedUsers.mockResolvedValue([{ blockedId: 'blk-a' }]);
    privacyService.getBlockersOf.mockResolvedValue([{ blockerId: 'blk-b' }]);

    await service.search('hello', { type: 'posts' }, 'viewer');

    expect(followService.getFollowing).toHaveBeenCalledWith('viewer');
    expect(privacyService.getBlockedUsers).toHaveBeenCalledWith('viewer');
    expect(privacyService.getBlockersOf).toHaveBeenCalledWith('viewer');

    const where = postRepo.find.mock.calls[0][0]?.where as any[];
    expect(Array.isArray(where)).toBe(true);
    // Two base fragments (title, content) each expanded into
    // public + followers + own branches for an authenticated viewer.
    expect(where).toHaveLength(6);
    const publicBranch = where.find((b) => b.visibility === 'public');
    expect(publicBranch.moderationStatus).toBe('visible');
    expect(publicBranch.isScheduled).toBe(false);
    expect(publicBranch.profileId?.type).toBe('not');
    expect(publicBranch.profileId?.value).toEqual(['blk-a', 'blk-b']);
  });

  it('search() with no viewer restricts to public/visible/unscheduled only', async () => {
    await service.search('hello', { type: 'posts' });

    const where = postRepo.find.mock.calls[0][0]?.where as any[];
    // No viewer -> one public branch per base fragment (title, content).
    expect(where).toHaveLength(2);
    for (const branch of where) {
      expect(branch.visibility).toBe('public');
      expect(branch.moderationStatus).toBe('visible');
      expect(branch.isScheduled).toBe(false);
      expect(branch.profileId).toBeUndefined();
    }
  });

  it('getTrending() applies the visibility scope to the aggregate query', async () => {
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    postRepo.createQueryBuilder.mockReturnValue(qb);

    await service.getTrending(5, 'viewer');

    expect(followService.getFollowing).toHaveBeenCalledWith('viewer');
    // applyVisiblePostScope adds its predicate through andWhere.
    expect(qb.andWhere).toHaveBeenCalledTimes(1);
    expect(qb.getMany).toHaveBeenCalled();
  });

  it('search() users branch sends the profile Search command with query/limit/offset', async () => {
    await service.search('hello', { type: 'users', limit: 15, offset: 5 });

    expect(profileClient.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Search },
      { query: 'hello', limit: 15, offset: 5 }
    );
  });

  it('getSuggestedUsers() sends excludeIds containing self and followed profiles', async () => {
    followService.getFollowing.mockResolvedValue([
      { followeeId: 'friend-a' },
      { followeeId: 'friend-b' },
    ]);

    await service.getSuggestedUsers(10, 'viewer');

    expect(followService.getFollowing).toHaveBeenCalledWith('viewer');
    expect(profileClient.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Search },
      { excludeIds: ['viewer', 'friend-a', 'friend-b'], limit: 10 }
    );
  });
});
