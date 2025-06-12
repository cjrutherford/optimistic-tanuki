import { Test, TestingModule } from '@nestjs/testing';
import { FollowController } from './follow.controller';
import { of } from 'rxjs';
import {
  FollowCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { UserDetails } from '../../../decorators/user.decorator';

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
    it('should successfully follow a user', async () => {
      const mockProfileResponse = { userId: 'user123', username: 'testuser' };
      mockProfileClient.send.mockReturnValueOnce(of(mockProfileResponse));

      const mockSocialResponse = { success: true };
      mockSocialClient.send.mockReturnValueOnce(of(mockSocialResponse));

      const dto = {
        followerId: mockProfileResponse.userId,
        followeeId: 'user456',
      };
      const result = await controller.follow(
        { userId: mockProfileResponse.userId } as UserDetails,
        dto
      );

      expect(mockProfileClient.send).toHaveBeenCalledWith(
        { cmd: ProfileCommands.Get },
        { id: dto.followerId }
      );
      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: FollowCommands.FOLLOW },
        dto
      );
      expect(result).toEqual(mockSocialResponse);
    });

    it('should throw an error if the profile is not found', async () => {
      mockProfileClient.send.mockReturnValueOnce(of(null));

      const dto = { followerId: 'nonexistent', followeeId: 'user456' };
      await expect(
        controller.follow({ userId: 'user123' } as UserDetails, dto)
      ).rejects.toThrow('Profile not found');
    });

    it("should throw an error if the followerId does not match the user's userId", async () => {
      const mockProfileResponse = { userId: 'user123', username: 'testuser' };
      mockProfileClient.send.mockReturnValueOnce(of(mockProfileResponse));
      const dto = { followerId: 'differentUser', followeeId: 'user456' };
      await expect(
        controller.follow({ userId: 'userXYZ' } as UserDetails, dto)
      ).rejects.toThrow(
        "You can't add a follow for someone else as the follower!"
      );
    });
  });

  describe('unfollow', () => {
    it('should successfully unfollow a user', async () => {
      const mockProfileResponse = { userId: 'user123', username: 'testuser' };
      mockProfileClient.send.mockReturnValueOnce(of(mockProfileResponse));

      const mockSocialResponse = { success: true };
      mockSocialClient.send.mockReturnValueOnce(of(mockSocialResponse));

      const dto = {
        followerId: mockProfileResponse.userId,
        followeeId: 'user456',
      };
      const result = await controller.unfollow(
        { userId: mockProfileResponse.userId } as UserDetails,
        dto
      );

      expect(mockProfileClient.send).toHaveBeenCalledWith(
        { cmd: ProfileCommands.Get },
        { id: dto.followerId }
      );
      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: FollowCommands.UNFOLLOW },
        dto
      );
      expect(result).toEqual(mockSocialResponse);
    });

    it('should throw an error if the profile is not found', async () => {
      mockProfileClient.send.mockReturnValueOnce(of(null));

      const dto = { followerId: 'nonexistent', followeeId: 'user456' };
      await expect(
        controller.unfollow({ userId: 'user123' } as UserDetails, dto)
      ).rejects.toThrow('Profile not found');
    });

    it("should throw an error if the followerId does not match the user's userId", async () => {
      const mockProfileResponse = { userId: 'user123', username: 'testuser' };
      mockProfileClient.send.mockReturnValueOnce(of(mockProfileResponse));
      const dto = { followerId: 'differentUser', followeeId: 'user456' };
      await expect(
        controller.unfollow({ userId: 'userXYZ' } as UserDetails, dto)
      ).rejects.toThrow(
        "You can't remove a follow for someone else as the follower!"
      );
    });
  });

  describe('get followers', () => {
    it('should successfully get followers of a user', async () => {
      const mockResponse = [{ userId: 'user456', username: 'followerUser' }];
      mockSocialClient.send.mockReturnValueOnce(of(mockResponse));
      const result = await controller.getFollowers('user123');
      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: FollowCommands.GET_FOLLOWERS },
        { followeeId: 'user123' }
      );
      expect(result).toEqual(mockResponse);
    });
  })

  describe('get following', () => {
    it('should successfully get following of a user', async () => {
      const mockResponse = [{ userId: 'user456', username: 'followedUser' }];
      mockSocialClient.send.mockReturnValueOnce(of(mockResponse));
      const result = await controller.getFollowing('user123');
      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: FollowCommands.GET_FOLLOWING },  
        { followerId: 'user123' }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('get mutual follows', () => {

    it('should successfully get mutual follows of a user', async () => {
      const mockResponse = [{ userId: 'user456', username: 'mutualUser' }];
      mockSocialClient.send.mockReturnValueOnce(of(mockResponse));
      const result = await controller.getMutuals('user123');
      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: FollowCommands.GET_MUTUALS },
        { followerId: 'user123' }
      );
      expect(result).toEqual(mockResponse);
    });

  });

  describe("get following count", () => {
    it('should successfully get following count of a user', async () => {
      const mockResponse = { count: 10 };
      mockSocialClient.send.mockReturnValueOnce(of(mockResponse));
      const result = await controller.getFollowingCount('user123');
      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: FollowCommands.GET_FOLLOWING_COUNT },
        { followerId: 'user123' }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('get follower count', () => {
    it('should successfully get followers of a user', async () => {
      const mockResponse = [{ userId: 'user456', username: 'followerUser' }];
      mockSocialClient.send.mockReturnValueOnce(of(mockResponse));
      const result = await controller.getFollowerCount('user123');
      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: FollowCommands.GET_FOLLOWER_COUNT },
        { followeeId: 'user123' }
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
