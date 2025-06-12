import { Test, TestingModule } from '@nestjs/testing';
<<<<<<< HEAD

import FollowEntity from '../../entities/Follow.entity';
import FollowService from './follow.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

const mockFollowRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
});

describe('FollowService', () => {
  let service: FollowService;
  let followRepo: jest.Mocked<Repository<FollowEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowService,
        {
          provide: getRepositoryToken(FollowEntity),
          useFactory: mockFollowRepo,
        },
      ],
    }).compile();

    service = module.get<FollowService>(FollowService);
    followRepo = module.get(getRepositoryToken(FollowEntity));
  });

  describe('follow', () => {
    it('should create a new follow if not already following', async () => {
      followRepo.findOne.mockResolvedValueOnce(null); // not following
      followRepo.create.mockReturnValue({ id: 'id1', followerId: 'a', followeeId: 'b', createdAt: new Date(), updatedAt: new Date(), isMutual: false });
      followRepo.findOne.mockResolvedValueOnce(null); // no inverse
      followRepo.save.mockResolvedValue({ id: 'id1', followerId: 'a', followeeId: 'b', createdAt: new Date(), updatedAt: new Date(), isMutual: false });
      const result = await service.follow('a', 'b');
      expect(result).toHaveProperty('id');
      expect(followRepo.create).toHaveBeenCalledWith({ followerId: 'a', followeeId: 'b' });
      expect(followRepo.save).toHaveBeenCalled();
    });

    it('should throw if already following', async () => {
      followRepo.findOne.mockResolvedValueOnce({ id: 'id2', followerId: 'a', followeeId: 'b', createdAt: new Date(), updatedAt: new Date(), isMutual: false }); // already following
      await expect(service.follow('a', 'b')).rejects.toThrow('Already following');
    });

    it('should set isMutual if inverse follow exists', async () => {
      followRepo.findOne.mockResolvedValueOnce(null); // not following
      followRepo.create.mockReturnValue({ id: 'id3', followerId: 'a', followeeId: 'b', createdAt: new Date(), updatedAt: new Date(), isMutual: false });
      followRepo.findOne.mockResolvedValueOnce({ id: 'id4', followerId: 'b', followeeId: 'a', createdAt: new Date(), updatedAt: new Date(), isMutual: false }); // inverse exists
      followRepo.save.mockResolvedValue({ id: 'id3', followerId: 'a', followeeId: 'b', createdAt: new Date(), updatedAt: new Date(), isMutual: true });
      const result = await service.follow('a', 'b');
      expect(result).toHaveProperty('isMutual', true);
      expect(followRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('unfollow', () => {
    it('should remove follow if exists', async () => {
      followRepo.findOne.mockResolvedValueOnce({ id: 'id5', followerId: 'a', followeeId: 'b', createdAt: new Date(), updatedAt: new Date(), isMutual: false });
      followRepo.findOne.mockResolvedValueOnce(null); // no inverse
      followRepo.remove.mockResolvedValue({ id: 'id5', followerId: 'a', followeeId: 'b', createdAt: new Date(), updatedAt: new Date(), isMutual: false });
      await service.unfollow('a', 'b');
      expect(followRepo.remove).toHaveBeenCalled();
    });

    it('should set isMutual to false if inverse exists', async () => {
      followRepo.findOne.mockResolvedValueOnce({ id: 'id6', followerId: 'a', followeeId: 'b', createdAt: new Date(), updatedAt: new Date(), isMutual: true });
      followRepo.findOne.mockResolvedValueOnce({ id: 'id7', followerId: 'b', followeeId: 'a', createdAt: new Date(), updatedAt: new Date(), isMutual: true });
      followRepo.save.mockResolvedValue({ id: 'id7', followerId: 'b', followeeId: 'a', createdAt: new Date(), updatedAt: new Date(), isMutual: false });
      followRepo.remove.mockResolvedValue({ id: 'id6', followerId: 'a', followeeId: 'b', createdAt: new Date(), updatedAt: new Date(), isMutual: false });
      await service.unfollow('a', 'b');
      expect(followRepo.save).toHaveBeenCalledWith({ id: 'id7', followerId: 'b', followeeId: 'a', isMutual: false , updatedAt: expect.any(Date), createdAt: expect.any(Date)});
      expect(followRepo.remove).toHaveBeenCalled();
    });

    it('should throw if not following', async () => {
      followRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.unfollow('a', 'b')).rejects.toThrow('Not following');
    });
  });

  it('getFollowers should call find with followeeId', async () => {
    followRepo.find.mockResolvedValue([]);
    await service.getFollowers('b');
    expect(followRepo.find).toHaveBeenCalledWith({ where: { followeeId: 'b' } });
  });

  it('getFollowing should call find with followerId', async () => {
    followRepo.find.mockResolvedValue([]);
    await service.getFollowing('a');
    expect(followRepo.find).toHaveBeenCalledWith({ where: { followerId: 'a' } });
  });

  it('getMutuals should call find with isMutual', async () => {
    followRepo.find.mockResolvedValue([]);
    await service.getMutuals('a');
    expect(followRepo.find).toHaveBeenCalledWith({ where: { followerId: 'a', isMutual: true } });
  });

  it('getFollowerCount should call count with followeeId', async () => {
    followRepo.count.mockResolvedValue(0);
    await service.getFollowerCount('b');
    expect(followRepo.count).toHaveBeenCalledWith({ where: { followeeId: 'b' } });
  });

  it('getFollowingCount should call count with followerId', async () => {
    followRepo.count.mockResolvedValue(0);
    await service.getFollowingCount('a');
    expect(followRepo.count).toHaveBeenCalledWith({ where: { followerId: 'a' } });
  });
});
=======
import { getRepositoryToken } from '@nestjs/typeorm';
import FollowService from './follow.service';
import FollowEntity from '../../entities/Follow.entity';
import { Repository } from 'typeorm';

const mockFollowRepo = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
});

describe('FollowService', () => {
    let service: FollowService;
    let repo: jest.Mocked<Repository<FollowEntity>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FollowService,
                {
                    provide: getRepositoryToken(FollowEntity),
                    useFactory: mockFollowRepo,
                },
            ],
        }).compile();

        service = module.get<FollowService>(FollowService);
        repo = module.get(getRepositoryToken(FollowEntity));
    });

    describe('follow', () => {
        it('should throw if already following', async () => {
            repo.findOne.mockResolvedValueOnce({ id: 1 } as any);
            await expect(service.follow('1', '2')).rejects.toThrow(new Error('Unable to create follow: Already following'));
        });

        it('should create a new follow and set isMutual if inverse exists', async () => {
            const mockCreateResponse: FollowEntity = {
                id: '3', isMutual: true,
                followerId: '1234',
                followeeId: '4567',
                createdAt: undefined,
                updatedAt: undefined
            };
            const mockSaveResponse: FollowEntity = {
                id: '3',
                isMutual: true,
                followerId: '1234',
                followeeId: '4567',
                createdAt: undefined,
                updatedAt: undefined
            };
            repo.findOne
                .mockResolvedValueOnce(null) // currentFollow
                .mockResolvedValueOnce({ id: 2 } as any); // inverseFollow
            repo.create.mockReturnValue(mockCreateResponse);
            repo.save.mockResolvedValue(mockSaveResponse);

            const result = await service.follow('1', '2');
            expect(repo.create).toHaveBeenCalledWith({ followerId: '1', followeeId: '2' });
            expect(repo.save).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ id: "3", isMutual: true, followerId: '1234', followeeId: '4567' });
        });

        it('should create a new follow if no inverse', async () => {
            const mockCreateResponse: FollowEntity = {
                id: '4',
                isMutual: false,
                followerId: '1',
                followeeId: '2',
                createdAt: undefined,
                updatedAt: undefined
            };
            const mockSaveResponse: FollowEntity = {
                id: '4',
                isMutual: false,
                followerId: '1',
                followeeId: '2',
                createdAt: undefined,
                updatedAt: undefined
            };
            repo.findOne
                .mockResolvedValueOnce(null) // currentFollow
                .mockResolvedValueOnce(null); // inverseFollow
            repo.create.mockReturnValue(mockCreateResponse);
            repo.save.mockResolvedValue(mockSaveResponse);

            const result = await service.follow('1', '2');
            expect(repo.save).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockSaveResponse);
        });
    });

    describe('unfollow', () => {
        it('should throw if not following', async () => {
            repo.findOne.mockResolvedValueOnce(null);
            await expect(service.unfollow('1', '2')).rejects.toThrow(new Error('Unable to Unfollow: Not following'));
        });

        it('should remove follow and update inverse if exists', async () => {
            const currentFollow = { id: 1 };
            const inverseFollow = { id: 2, isMutual: true };
            repo.findOne
                .mockResolvedValueOnce(currentFollow as any)
                .mockResolvedValueOnce(inverseFollow as any);
            repo.save.mockResolvedValue(inverseFollow as any);
            repo.remove.mockResolvedValue(currentFollow as any);

            const result = await service.unfollow('1', '2');
            expect(repo.save).toHaveBeenCalledWith({ ...inverseFollow, isMutual: false });
            expect(repo.remove).toHaveBeenCalledWith(currentFollow);
            expect(result).toEqual(currentFollow);
        });

        it('should remove follow if no inverse', async () => {
            const currentFollow = { id: 1 };
            repo.findOne
                .mockResolvedValueOnce(currentFollow as any)
                .mockResolvedValueOnce(null);
            repo.remove.mockResolvedValue(currentFollow as any);

            const result = await service.unfollow('1', '2');
            expect(repo.remove).toHaveBeenCalledWith(currentFollow);
            expect(result).toEqual(currentFollow);
        });
    });

    describe('getFollowers', () => {
        it('should return followers', async () => {
            repo.find.mockResolvedValue([{ id: 1 } as any]);
            const result = await service.getFollowers('2');
            expect(repo.find).toHaveBeenCalledWith({ where: { followeeId: '2' } });
            expect(result).toEqual([{ id: 1 }]);
        });
    });

    describe('getFollowing', () => {
        it('should return following', async () => {
            repo.find.mockResolvedValue([{ id: 2 } as any]);
            const result = await service.getFollowing('1');
            expect(repo.find).toHaveBeenCalledWith({ where: { followerId: '1' } });
            expect(result).toEqual([{ id: 2 }]);
        });
    });

    describe('getMutuals', () => {
        it('should return mutuals', async () => {
            repo.find.mockResolvedValue([{ id: 3, isMutual: true } as any]);
            const result = await service.getMutuals('1');
            expect(repo.find).toHaveBeenCalledWith({ where: { followerId: '1', isMutual: true } });
            expect(result).toEqual([{ id: 3, isMutual: true }]);
        });
    });

    describe('getFollowerCount', () => {
        it('should return follower count', async () => {
            repo.count.mockResolvedValue(5);
            const result = await service.getFollowerCount('2');
            expect(repo.count).toHaveBeenCalledWith({ where: { followeeId: '2' } });
            expect(result).toBe(5);
        });
    });

    describe('getFollowingCount', () => {
        it('should return following count', async () => {
            repo.count.mockResolvedValue(3);
            const result = await service.getFollowingCount('1');
            expect(repo.count).toHaveBeenCalledWith({ where: { followerId: '1' } });
            expect(result).toBe(3);
        });
    });
});
>>>>>>> eb42fc1 (filled in unit tests)
