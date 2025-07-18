import { Test, TestingModule } from '@nestjs/testing';

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
