import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityService } from './community.service';
import { Community } from '../../entities/community.entity';
import {
  CommunityMember,
  CommunityMemberRole,
  CommunityMembershipStatus,
} from '../../entities/community-member.entity';
import { CommunityInvite } from '../../entities/community-invite.entity';
import { RpcException } from '@nestjs/microservices';

describe('CommunityService', () => {
  let service: CommunityService;
  let communityRepo: jest.Mocked<Repository<Community>>;
  let memberRepo: jest.Mocked<Repository<CommunityMember>>;
  let inviteRepo: jest.Mocked<Repository<CommunityInvite>>;

  beforeEach(async () => {
    communityRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any;

    memberRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    } as any;

    inviteRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: getRepositoryToken(Community), useValue: communityRepo },
        { provide: getRepositoryToken(CommunityMember), useValue: memberRepo },
        { provide: getRepositoryToken(CommunityInvite), useValue: inviteRepo },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Community',
      description: 'A test community',
      createChatRoom: true,
    };

    it('should create a community', async () => {
      communityRepo.findOne.mockResolvedValue(null);
      communityRepo.create.mockReturnValue({
        id: 'community-1',
        name: 'Test Community',
        description: 'A test community',
        ownerId: 'user-1',
        ownerProfileId: 'profile-1',
        appScope: 'social',
        memberCount: 1,
        chatRoomId: null,
      } as any);
      communityRepo.save.mockImplementation((c) => Promise.resolve(c as any));

      memberRepo.create.mockReturnValue({
        communityId: 'community-1',
        userId: 'user-1',
        profileId: 'profile-1',
        role: CommunityMemberRole.OWNER,
        status: CommunityMembershipStatus.APPROVED,
      } as any);
      memberRepo.save.mockResolvedValue({} as any);

      const result = await service.create(
        createDto,
        'user-1',
        'profile-1',
        'social'
      );

      expect(result.name).toBe('Test Community');
      expect(result.chatRoomId).toBeNull();
    });

    it('should throw if community name already exists', async () => {
      communityRepo.findOne.mockResolvedValue({
        id: 'existing-id',
        name: 'Test Community',
      } as any);

      await expect(
        service.create(createDto, 'user-1', 'profile-1')
      ).rejects.toThrow(RpcException);
    });
  });

  describe('join', () => {
    const joinDto = { communityId: 'community-1' };

    it('should add user to community when membership is approved', async () => {
      communityRepo.findOne.mockResolvedValue({
        id: 'community-1',
        name: 'Test Community',
        ownerId: 'user-1',
        joinPolicy: 'public',
        chatRoomId: 'chat-room-123',
        memberCount: 1,
      } as any);
      memberRepo.findOne.mockResolvedValue(null);
      inviteRepo.findOne.mockResolvedValue(null);
      const savedMember = {
        communityId: 'community-1',
        userId: 'user-2',
        profileId: 'profile-2',
        role: CommunityMemberRole.MEMBER,
        status: CommunityMembershipStatus.APPROVED,
      };
      memberRepo.create.mockReturnValue(savedMember as any);
      memberRepo.save.mockResolvedValue(savedMember as any);
      communityRepo.save.mockImplementation((c) => Promise.resolve(c as any));

      const result = await service.join(joinDto, 'user-2', 'profile-2');

      expect(result.status).toBe(CommunityMembershipStatus.APPROVED);
    });

    it('should not add user when membership is pending', async () => {
      communityRepo.findOne.mockResolvedValue({
        id: 'community-1',
        name: 'Test Community',
        joinPolicy: 'approval_required',
        chatRoomId: 'chat-room-123',
        memberCount: 1,
      } as any);
      memberRepo.findOne.mockResolvedValue(null);
      inviteRepo.findOne.mockResolvedValue(null);
      const savedMember = {
        communityId: 'community-1',
        userId: 'user-2',
        profileId: 'profile-2',
        role: CommunityMemberRole.MEMBER,
        status: CommunityMembershipStatus.PENDING,
      };
      memberRepo.create.mockReturnValue(savedMember as any);
      memberRepo.save.mockResolvedValue(savedMember as any);

      const result = await service.join(joinDto, 'user-2', 'profile-2');

      expect(result.status).toBe(CommunityMembershipStatus.PENDING);
    });

    it('should throw if user is already a member', async () => {
      communityRepo.findOne.mockResolvedValue({ id: 'community-1' } as any);
      memberRepo.findOne.mockResolvedValue({
        userId: 'user-2',
        status: CommunityMembershipStatus.APPROVED,
      } as any);

      await expect(
        service.join(joinDto, 'user-2', 'profile-2')
      ).rejects.toThrow('Already a member');
    });
  });

  describe('leave', () => {
    it('should remove user from community', async () => {
      memberRepo.findOne.mockResolvedValue({
        id: 'member-1',
        communityId: 'community-1',
        userId: 'user-2',
        profileId: 'profile-2',
        role: CommunityMemberRole.MEMBER,
      } as any);
      communityRepo.findOne.mockResolvedValue({
        id: 'community-1',
        chatRoomId: 'chat-room-123',
        memberCount: 2,
      } as any);
      memberRepo.remove.mockResolvedValue({} as any);
      communityRepo.save.mockImplementation((c) => Promise.resolve(c as any));

      await service.leave('community-1', 'user-2');

      expect(memberRepo.remove).toHaveBeenCalled();
    });

    it('should throw if owner tries to leave', async () => {
      memberRepo.findOne.mockResolvedValue({
        id: 'member-1',
        communityId: 'community-1',
        userId: 'user-1',
        role: CommunityMemberRole.OWNER,
      } as any);

      await expect(service.leave('community-1', 'user-1')).rejects.toThrow(
        'Owner cannot leave the community'
      );
    });
  });

  describe('getMembers', () => {
    it('should return approved members', async () => {
      const members = [
        {
          id: '1',
          communityId: 'community-1',
          role: CommunityMemberRole.OWNER,
        },
        {
          id: '2',
          communityId: 'community-1',
          role: CommunityMemberRole.MEMBER,
        },
      ];
      memberRepo.find.mockResolvedValue(members as any);

      const result = await service.getMembers('community-1');

      expect(memberRepo.find).toHaveBeenCalledWith({
        where: {
          communityId: 'community-1',
          status: CommunityMembershipStatus.APPROVED,
        },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('approveMember', () => {
    it('should approve member', async () => {
      const pendingMember = {
        id: 'member-1',
        communityId: 'community-1',
        userId: 'user-2',
        profileId: 'profile-2',
        status: CommunityMembershipStatus.PENDING,
      };
      memberRepo.findOne
        .mockResolvedValueOnce(pendingMember as any)
        .mockResolvedValueOnce({
          id: 'owner-member',
          communityId: 'community-1',
          role: CommunityMemberRole.OWNER,
        } as any);
      communityRepo.findOne.mockResolvedValue({
        id: 'community-1',
        chatRoomId: 'chat-room-123',
        memberCount: 1,
      } as any);
      const approvedMember = {
        ...pendingMember,
        status: CommunityMembershipStatus.APPROVED,
      };
      memberRepo.save.mockResolvedValue(approvedMember as any);
      communityRepo.save.mockImplementation((c) => Promise.resolve(c as any));

      const result = await service.approveMember('member-1', 'user-1');

      expect(result.status).toBe(CommunityMembershipStatus.APPROVED);
    });
  });

  describe('rejectMember', () => {
    it('should reject and remove pending member', async () => {
      memberRepo.findOne
        .mockResolvedValueOnce({
          id: 'member-1',
          communityId: 'community-1',
          userId: 'user-2',
        } as any)
        .mockResolvedValueOnce({
          id: 'owner-member',
          communityId: 'community-1',
          role: CommunityMemberRole.OWNER,
        } as any);
      communityRepo.findOne.mockResolvedValue({ id: 'community-1' } as any);
      memberRepo.remove.mockResolvedValue({} as any);

      await service.rejectMember('member-1', 'user-1');

      expect(memberRepo.remove).toHaveBeenCalled();
    });

    it('should throw if non-admin tries to reject', async () => {
      memberRepo.findOne
        .mockResolvedValueOnce({
          id: 'member-1',
          communityId: 'community-1',
        } as any)
        .mockResolvedValueOnce({
          id: 'member-2',
          communityId: 'community-1',
          role: CommunityMemberRole.MEMBER,
        } as any);
      communityRepo.findOne.mockResolvedValue({ id: 'community-1' } as any);

      await expect(service.rejectMember('member-1', 'user-2')).rejects.toThrow(
        'Only admins can reject members'
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member from community', async () => {
      memberRepo.findOne
        .mockResolvedValueOnce({
          id: 'member-1',
          communityId: 'community-1',
          userId: 'user-2',
          profileId: 'profile-2',
          role: CommunityMemberRole.MEMBER,
        } as any)
        .mockResolvedValueOnce({
          id: 'admin-member',
          communityId: 'community-1',
          role: CommunityMemberRole.OWNER,
        } as any);
      communityRepo.findOne.mockResolvedValue({
        id: 'community-1',
        ownerId: 'user-1',
        chatRoomId: 'chat-room-123',
        memberCount: 2,
      } as any);
      memberRepo.remove.mockResolvedValue({} as any);
      communityRepo.save.mockImplementation((c) => Promise.resolve(c as any));

      await service.removeMember('member-1', 'user-1');

      expect(memberRepo.remove).toHaveBeenCalled();
    });

    it('should throw if trying to remove owner', async () => {
      memberRepo.findOne.mockResolvedValue({
        id: 'member-1',
        communityId: 'community-1',
        role: CommunityMemberRole.OWNER,
      } as any);
      communityRepo.findOne.mockResolvedValue({
        id: 'community-1',
        ownerId: 'user-1',
      } as any);

      await expect(service.removeMember('member-1', 'user-1')).rejects.toThrow(
        'Cannot remove the owner'
      );
    });

    it('should throw if member tries to remove another member', async () => {
      memberRepo.findOne
        .mockResolvedValueOnce({
          id: 'member-1',
          communityId: 'community-1',
          role: CommunityMemberRole.MEMBER,
        } as any)
        .mockResolvedValueOnce({
          id: 'member-2',
          communityId: 'community-1',
          role: CommunityMemberRole.MEMBER,
        } as any);
      communityRepo.findOne.mockResolvedValue({ id: 'community-1' } as any);

      await expect(service.removeMember('member-1', 'user-2')).rejects.toThrow(
        'Members cannot remove other members'
      );
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      memberRepo.findOne
        .mockResolvedValueOnce({
          id: 'member-1',
          communityId: 'community-1',
          role: CommunityMemberRole.MEMBER,
        } as any)
        .mockResolvedValueOnce({
          id: 'owner-member',
          communityId: 'community-1',
          role: CommunityMemberRole.OWNER,
        } as any);
      communityRepo.findOne.mockResolvedValue({
        id: 'community-1',
        ownerId: 'user-1',
      } as any);
      memberRepo.save.mockImplementation((m) =>
        Promise.resolve({ ...m, role: m.role } as any)
      );

      const result = await service.updateMemberRole(
        'member-1',
        CommunityMemberRole.ADMIN,
        'user-1'
      );

      expect(result.role).toBe(CommunityMemberRole.ADMIN);
    });

    it('should throw if trying to change owner role', async () => {
      memberRepo.findOne.mockResolvedValue({
        id: 'member-1',
        communityId: 'community-1',
        role: CommunityMemberRole.OWNER,
      } as any);

      await expect(
        service.updateMemberRole(
          'member-1',
          CommunityMemberRole.ADMIN,
          'user-1'
        )
      ).rejects.toThrow('Cannot change the owner role');
    });

    it('should throw if non-admin tries to change role', async () => {
      memberRepo.findOne
        .mockResolvedValueOnce({
          id: 'member-1',
          communityId: 'community-1',
          role: CommunityMemberRole.MEMBER,
        } as any)
        .mockResolvedValueOnce({
          id: 'member-2',
          communityId: 'community-1',
          role: CommunityMemberRole.MEMBER,
        } as any);
      communityRepo.findOne.mockResolvedValue({
        id: 'community-1',
        ownerId: 'user-3',
      } as any);

      await expect(
        service.updateMemberRole(
          'member-1',
          CommunityMemberRole.ADMIN,
          'user-2'
        )
      ).rejects.toThrow('Members cannot change member roles');
    });
  });

  describe('setCommunityChatRoom', () => {
    it('should set community chat room id', async () => {
      communityRepo.update.mockResolvedValue({} as any);

      await service.setCommunityChatRoom('community-1', 'chat-room-123');

      expect(communityRepo.update).toHaveBeenCalledWith('community-1', {
        chatRoomId: 'chat-room-123',
      });
    });
  });

  describe('getCommunityChatRoom', () => {
    it('should return chat room id', async () => {
      communityRepo.findOne.mockResolvedValue({
        id: 'community-1',
        chatRoomId: 'chat-room-123',
      } as any);

      const result = await service.getCommunityChatRoom('community-1');

      expect(result).toEqual({ id: 'chat-room-123' });
    });

    it('should return null if no chat room', async () => {
      communityRepo.findOne.mockResolvedValue({
        id: 'community-1',
        chatRoomId: null,
      } as any);

      const result = await service.getCommunityChatRoom('community-1');

      expect(result).toBeNull();
    });
  });
});
