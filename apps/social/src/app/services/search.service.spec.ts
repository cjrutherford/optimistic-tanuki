import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { In, Repository } from 'typeorm';
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
  let historyRepo: jest.Mocked<Repository<SearchHistory>>;
  let communityRepo: jest.Mocked<Repository<Community>>;
  let followService: { getFollowing: jest.Mock };
  let privacyService: { getBlockedUsers: jest.Mock; getBlockersOf: jest.Mock };
  let profileClient: { send: jest.Mock };

  const mockRepoFactory = () => ({
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
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
    historyRepo = module.get(getRepositoryToken(SearchHistory));
    communityRepo = module.get(getRepositoryToken(Community));
  });

  it('search() posts branch applies the visibility scope with blocked authors excluded', async () => {
    followService.getFollowing.mockResolvedValue([{ followeeId: 'friend' }]);
    privacyService.getBlockedUsers.mockResolvedValue([{ blockedId: 'blk-a' }]);
    privacyService.getBlockersOf.mockResolvedValue([{ blockerId: 'blk-b' }]);
    profileClient.send.mockImplementation((pattern, payload) =>
      pattern?.cmd === ProfileCommands.Get
        ? of({ id: payload.id, userId: 'account-1' })
        : of([])
    );

    await service.search('hello', { type: 'posts' }, 'viewer');

    expect(followService.getFollowing).toHaveBeenCalledWith('viewer');
    expect(privacyService.getBlockedUsers).toHaveBeenCalledWith('viewer');
    expect(privacyService.getBlockersOf).toHaveBeenCalledWith('viewer');

    const where = postRepo.find.mock.calls[0][0]?.where as any[];
    expect(Array.isArray(where)).toBe(true);
    // Each title/content fragment is expanded across the separate
    // non-community-public, explicit-community-public, member, legacy-member,
    // follower and own visibility branches.
    expect(where).toHaveLength(12);
    const publicBranch = where.find(
      (b) => b.visibility === 'public' && !b.publicAudienceExplicit
    );
    expect(publicBranch.moderationStatus).toBe('visible');
    expect(publicBranch.isScheduled).toBe(false);
    expect(publicBranch.profileId).toBeDefined();
    expect(publicBranch.communityId.type).toBe('and');
    expect(publicBranch.communityId.value[1].type).toBe('raw');
    expect(publicBranch.communityId.value[1].objectLiteralParameters).toEqual({
      pv_account_id: 'account-1',
    });
  });

  it('search() with no viewer restricts to public/visible/unscheduled only', async () => {
    await service.search('hello', { type: 'posts' });

    const where = postRepo.find.mock.calls[0][0]?.where as any[];
    // Each title/content fragment has non-community and explicitly-public
    // community branches; anonymous reads cannot see the member-default branch.
    expect(where).toHaveLength(4);
    for (const branch of where) {
      expect(branch.visibility).toBe('public');
      expect(branch.moderationStatus).toBe('visible');
      expect(branch.isScheduled).toBe(false);
      expect(branch.profileId).toBeUndefined();
    }
    expect(
      where.filter((branch) => branch.publicAudienceExplicit === true)
    ).toHaveLength(2);
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

  it('clears history only for the selected owner profiles', async () => {
    await service.clearSearchHistoryForProfiles([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
    ]);
    const selection = historyRepo.delete.mock.calls[0][0] as unknown as {
      profileId: { objectLiteralParameters: { profileIds: string[] } };
    };
    expect(selection.profileId.objectLiteralParameters.profileIds).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ]);
  });

  it('rejects malformed identities before mutating history', async () => {
    await expect(
      service.clearSearchHistoryForProfiles([
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'foreign/not-a-uuid',
      ])
    ).rejects.toThrow();
    expect(historyRepo.delete).not.toHaveBeenCalled();
  });

  it('does not save a history row when an old query completes after clear', async () => {
    let finish!: (value: any[]) => void;
    const { Observable } = require('rxjs');
    profileClient.send.mockImplementation(
      () =>
        new Observable((subscriber) => {
          finish = (value) => {
            subscriber.next(value);
            subscriber.complete();
          };
        })
    );
    const query = service.search(
      'old',
      { type: 'users' },
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    );
    await Promise.resolve();
    await service.clearSearchHistoryForProfiles([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ]);
    finish([]);
    await query;
    expect(historyRepo.save).not.toHaveBeenCalled();
  });

  it('waits for an active history save before deleting and records a later search', async () => {
    let finishSave!: () => void;
    historyRepo.save.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }) as any
    );
    const profileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const search = service.search('first', { type: 'users' }, profileId);
    await Promise.resolve();
    await Promise.resolve();
    const clearing = service.clearSearchHistoryForProfiles([profileId]);
    await Promise.resolve();
    expect(historyRepo.delete).not.toHaveBeenCalled();
    finishSave();
    await Promise.all([search, clearing]);
    expect(historyRepo.delete).toHaveBeenCalledTimes(1);

    historyRepo.save.mockResolvedValue({} as SearchHistory);
    await service.search('later', { type: 'users' }, profileId);
    expect(historyRepo.save).toHaveBeenCalledTimes(2);
  });

  it('keeps history suppressed until overlapping cleanups both finish', async () => {
    const profileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const releases: Array<() => void> = [];
    historyRepo.delete.mockImplementation(
      () => new Promise<void>((resolve) => releases.push(resolve)) as any
    );
    const first = service.clearSearchHistoryForProfiles([profileId]);
    const second = service.clearSearchHistoryForProfiles([profileId]);
    await Promise.resolve();
    await Promise.resolve();
    expect(releases).toHaveLength(2);
    releases[0]();
    await first;
    await service.search('during-second-clear', { type: 'users' }, profileId);
    expect(historyRepo.save).not.toHaveBeenCalled();
    releases[1]();
    await second;
    await service.search('after-both', { type: 'users' }, profileId);
    expect(historyRepo.save).toHaveBeenCalledTimes(1);
  });

  it('still cleans history after a started save rejects', async () => {
    let rejectWrite!: (reason: Error) => void;
    historyRepo.save.mockImplementation(
      () => new Promise((_resolve, reject) => (rejectWrite = reject)) as any
    );
    const profileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const search = service
      .search('failed-write', { type: 'users' }, profileId)
      .catch(() => undefined);
    await Promise.resolve();
    await Promise.resolve();
    const clear = service.clearSearchHistoryForProfiles([profileId]);
    rejectWrite(new Error('write failed'));
    await search;
    await expect(clear).resolves.toBeUndefined();
    expect(historyRepo.delete).toHaveBeenCalledTimes(1);
  });

  it('restricts community search and suggestions to public communities', async () => {
    await service.search('hello', { type: 'communities' });
    await service.getSuggestedCommunities();
    expect(communityRepo.find.mock.calls[0][0]?.where).toEqual([
      { name: expect.anything(), isPrivate: false },
      { description: expect.anything(), isPrivate: false },
    ]);
    expect(communityRepo.find.mock.calls[1][0]?.where).toEqual({
      isPrivate: false,
    });
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
