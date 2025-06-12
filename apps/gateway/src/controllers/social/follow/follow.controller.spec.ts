import {
  FollowCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { Test, TestingModule } from '@nestjs/testing';

import { FollowController } from './follow.controller';
import { UserDetails } from '../../../decorators/user.decorator';
import { of } from 'rxjs';

describe('FollowController', () => {
  let controller: FollowController;
  let mockAuthClinent;
  let mockSocialClient;
  let mockProfileClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowController],
      providers: [
        {
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: ServiceTokens.SOCIAL_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
      ],
    }).compile();

    mockAuthClinent = module.get(ServiceTokens.AUTHENTICATION_SERVICE);
    mockSocialClient = module.get(ServiceTokens.SOCIAL_SERVICE);
    mockProfileClient = module.get(ServiceTokens.PROFILE_SERVICE);
    controller = module.get<FollowController>(FollowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('follow', () => {
    it('should follow a user (happy path)', async () => {
      const user = { email: 'a', exp: 1, iat: 1, name: 'n', userId: 'user-1' };
      const followDto = { followerId: 'profile-1', followeeId: 'profile-2' };
      const profile = { userId: 'user-1' };
      const module = (controller as any);
      module.profileClient = { send: jest.fn(() => of(profile)) };
      module.socialClient = { send: jest.fn(() => of({ success: true })) };
      const result = await controller.follow(user, followDto);
      expect(module.profileClient.send).toHaveBeenCalledWith({ cmd: 'Get:Profile' }, { id: followDto.followerId });
      expect(module.socialClient.send).toHaveBeenCalledWith({ cmd: 'FOLLOW' }, followDto);
      expect(result).toEqual({ success: true });
    });
    it('should throw if profile not found', async () => {
      const user = { email: 'a', exp: 1, iat: 1, name: 'n', userId: 'user-1' };
      const followDto = { followerId: 'profile-1', followeeId: 'profile-2' };
      const module = (controller as any);
      module.profileClient = { send: jest.fn(() => of(null)) };
      await expect(controller.follow(user, followDto)).rejects.toThrow('Profile not found');
    });
    it('should throw if userId does not match', async () => {
      const user = { email: 'a', exp: 1, iat: 1, name: 'n', userId: 'user-1' };
      const followDto = { followerId: 'profile-1', followeeId: 'profile-2' };
      const profile = { userId: 'other-user' };
      const module = (controller as any);
      module.profileClient = { send: jest.fn(() => of(profile)) };
      await expect(controller.follow(user, followDto)).rejects.toThrow("You can't add a follow for someone else as the follower!");
    });
  });

  describe('unfollow', () => {
    it('should unfollow a user (happy path)', async () => {
      const user = { email: 'a', exp: 1, iat: 1, name: 'n', userId: 'user-1' };
      const followDto = { followerId: 'profile-1', followeeId: 'profile-2' };
      const profile = { userId: 'user-1' };
      const module = (controller as any);
      module.profileClient = { send: jest.fn(() => of(profile)) };
      module.socialClient = { send: jest.fn(() => of({ success: true })) };
      const result = await controller.unfollow(user, followDto);
      expect(module.profileClient.send).toHaveBeenCalledWith({ cmd: 'Get:Profile' }, { id: followDto.followerId });
      expect(module.socialClient.send).toHaveBeenCalledWith({ cmd: 'UNFOLLOW' }, followDto);
      expect(result).toEqual({ success: true });
    });
    it('should throw if profile not found', async () => {
      const user = { email: 'a', exp: 1, iat: 1, name: 'n', userId: 'user-1' };
      const followDto = { followerId: 'profile-1', followeeId: 'profile-2' };
      const module = (controller as any);
      module.profileClient = { send: jest.fn(() => of(null)) };
      await expect(controller.unfollow(user, followDto)).rejects.toThrow('Profile not found');
    });
    it('should throw if userId does not match', async () => {
      const user = { email: 'a', exp: 1, iat: 1, name: 'n', userId: 'user-1' };
      const followDto = { followerId: 'profile-1', followeeId: 'profile-2' };
      const profile = { userId: 'other-user' };
      const module = (controller as any);
      module.profileClient = { send: jest.fn(() => of(profile)) };
      await expect(controller.unfollow(user, followDto)).rejects.toThrow("You can't remove a follow for someone else as the follower!");
    });
  });

  describe('getFollowers', () => {
    it('should get followers', async () => {
      const module = (controller as any);
      module.socialClient = { send: jest.fn(() => of(['follower1', 'follower2'])) };
      const result = await controller.getFollowers('id-1');
      expect(module.socialClient.send).toHaveBeenCalledWith({ cmd: 'GET_FOLLOWERS' }, { foloweeId: 'id-1' });
      expect(result).toEqual(['follower1', 'follower2']);
    });
  });

  describe('getFollowing', () => {
    it('should get following', async () => {
      const module = (controller as any);
      module.socialClient = { send: jest.fn(() => of(['following1', 'following2'])) };
      const result = await controller.getFollowing('id-1');
      expect(module.socialClient.send).toHaveBeenCalledWith({ cmd: 'GET_FOLLOWING' }, { followerId: 'id-1' });
      expect(result).toEqual(['following1', 'following2']);
    });
  });

  describe('getMutuals', () => {
    it('should get mutuals', async () => {
      const module = (controller as any);
      module.socialClient = { send: jest.fn(() => of(['mutual1', 'mutual2'])) };
      const result = await controller.getMutuals('id-1');
      expect(module.socialClient.send).toHaveBeenCalledWith({ cmd: 'GET_MUTUALS' }, { followerId: 'id-1' });
      expect(result).toEqual(['mutual1', 'mutual2']);
    });
  });

  describe('getFollowingCount', () => {
    it('should get following count', async () => {
      const module = (controller as any);
      module.socialClient = { send: jest.fn(() => of(5)) };
      const result = await controller.getFollowingCount('id-1');
      expect(module.socialClient.send).toHaveBeenCalledWith({ cmd: 'GET_FOLLOWING_COUNT' }, { followerId: 'id-1' });
      expect(result).toBe(5);
    });
  });

  describe('getFollowerCount', () => {
    it('should get follower count', async () => {
      const module = (controller as any);
      module.socialClient = { send: jest.fn(() => of(7)) };
      const result = await controller.getFollowerCount('id-1');
      expect(module.socialClient.send).toHaveBeenCalledWith({ cmd: 'GET_FOLLOWER_COUNT' }, { followeeId: 'id-1' });
      expect(result).toBe(7);
    });
  });
});
