import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { CommunityService } from './community.service';
import { Community } from '../../entities/community.entity';
import {
  CommunityMember,
  CommunityMemberRole,
  CommunityMembershipStatus,
} from '../../entities/community-member.entity';
import { CommunityInvite } from '../../entities/community-invite.entity';
import { CommunityElection } from '../../entities/community-election.entity';
import { ElectionCandidate } from '../../entities/election-candidate.entity';
import { ElectionVote } from '../../entities/election-vote.entity';
import { CommunityMembershipAudit } from '../../entities/community-membership-audit.entity';
import {
  communityMembershipStatusToLifecycleState,
  lifecycleStateToCommunityMembershipStatus,
} from './community-membership-lifecycle';

describe('Social community membership lifecycle enforcement', () => {
  let service: CommunityService;
  let communityRepo: jest.Mocked<Repository<Community>>;
  let memberRepo: jest.Mocked<Repository<CommunityMember>>;
  let membershipAuditRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    communityRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;
    memberRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    } as any;
    membershipAuditRepo = {
      create: jest.fn((event) => event),
      save: jest.fn(async (event) => event),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: getRepositoryToken(Community), useValue: communityRepo },
        { provide: getRepositoryToken(CommunityMember), useValue: memberRepo },
        {
          provide: getRepositoryToken(CommunityMembershipAudit),
          useValue: membershipAuditRepo,
        },
        {
          provide: getRepositoryToken(CommunityInvite),
          useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(CommunityElection),
          useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(ElectionCandidate),
          useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(ElectionVote),
          useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CommunityService);
  });

  it('maps legacy Social statuses to the shared lifecycle vocabulary', () => {
    expect(
      communityMembershipStatusToLifecycleState(
        CommunityMembershipStatus.PENDING
      )
    ).toBe('pending');
    expect(
      communityMembershipStatusToLifecycleState(
        CommunityMembershipStatus.APPROVED
      )
    ).toBe('active');
    expect(
      communityMembershipStatusToLifecycleState(
        CommunityMembershipStatus.REJECTED
      )
    ).toBe('revoked');
    expect(lifecycleStateToCommunityMembershipStatus('suspended')).toBe(
      CommunityMembershipStatus.SUSPENDED
    );
  });

  it('does not allow a suspended or revoked member to act as a scoped member', async () => {
    memberRepo.findOne
      .mockResolvedValueOnce({
        communityId: 'community-1',
        userId: 'user-suspended',
        status: CommunityMembershipStatus.SUSPENDED,
      } as any)
      .mockResolvedValueOnce({
        communityId: 'community-1',
        userId: 'user-revoked',
        status: CommunityMembershipStatus.REVOKED,
      } as any);

    await expect(
      service.isMember('community-1', 'user-suspended')
    ).resolves.toBe(false);
    await expect(
      service.hasPermission('community-1', 'user-revoked', [
        CommunityMemberRole.MEMBER,
      ])
    ).resolves.toBe(false);
  });

  it('rejects a join attempt from a suspended or revoked relationship', async () => {
    communityRepo.findOne.mockResolvedValue({
      id: 'community-1',
      joinPolicy: 'public',
    } as any);
    memberRepo.findOne.mockResolvedValue({
      communityId: 'community-1',
      userId: 'user-2',
      status: CommunityMembershipStatus.SUSPENDED,
    } as any);

    await expect(
      service.join({ communityId: 'community-1' }, 'user-2', 'profile-2')
    ).rejects.toThrow(RpcException);
  });

  it('revokes instead of deleting a member and records an owner-visible audit event', async () => {
    const member = {
      id: 'member-1',
      communityId: 'community-1',
      userId: 'user-2',
      profileId: 'profile-2',
      role: CommunityMemberRole.MEMBER,
      status: CommunityMembershipStatus.APPROVED,
    } as any;
    memberRepo.findOne.mockResolvedValueOnce(member).mockResolvedValueOnce({
      communityId: 'community-1',
      userId: 'owner-1',
      role: CommunityMemberRole.OWNER,
      status: CommunityMembershipStatus.APPROVED,
    } as any);
    communityRepo.findOne.mockResolvedValue({
      id: 'community-1',
      ownerId: 'owner-1',
      memberCount: 2,
    } as any);
    memberRepo.save.mockImplementation(async (value) => value as any);

    await service.removeMember('member-1', 'owner-1');

    expect(memberRepo.remove).not.toHaveBeenCalled();
    expect(memberRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: CommunityMembershipStatus.REVOKED })
    );
    expect(membershipAuditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'community-1',
        subjectId: 'profile-2',
        action: 'revoke',
      })
    );
    membershipAuditRepo.find.mockResolvedValueOnce([
      membershipAuditRepo.save.mock.calls[0][0],
    ]);
    await expect(
      service.getMembershipAudit('community-1', 'owner-1')
    ).resolves.toEqual([
      expect.objectContaining({
        workspaceId: 'community-1',
        subjectId: 'profile-2',
        actorId: 'owner-1',
        actor: 'owner',
        action: 'revoke',
        from: 'active',
        to: 'revoked',
      }),
    ]);
  });

  it('returns only the selected member audit events', async () => {
    communityRepo.findOne.mockResolvedValue({
      id: 'community-1',
      ownerId: 'owner-1',
    } as any);
    membershipAuditRepo.find.mockResolvedValue([
      {
        workspaceId: 'community-1',
        subjectId: 'profile-1',
        actorId: 'owner-1',
        actor: 'owner',
        action: 'suspend',
        from: 'active',
        to: 'suspended',
      },
    ]);

    await expect(
      service.getMembershipAudit('community-1', 'owner-1', 'profile-1')
    ).resolves.toEqual([expect.objectContaining({ subjectId: 'profile-1' })]);
    expect(membershipAuditRepo.find).toHaveBeenCalledWith({
      where: { workspaceId: 'community-1', subjectId: 'profile-1' },
      order: { createdAt: 'DESC' },
    });
  });

  it('rejects a status transition from a revoked member', async () => {
    memberRepo.findOne.mockResolvedValue({
      id: 'member-1',
      communityId: 'community-1',
      profileId: 'profile-2',
      role: CommunityMemberRole.MEMBER,
      status: CommunityMembershipStatus.REVOKED,
    } as any);
    memberRepo.find.mockResolvedValue([
      {
        communityId: 'community-1',
        userId: 'owner-1',
        role: CommunityMemberRole.OWNER,
        status: CommunityMembershipStatus.APPROVED,
      },
    ] as any);
    communityRepo.findOne.mockResolvedValue({
      id: 'community-1',
      ownerId: 'owner-1',
    } as any);

    await expect(
      service.reactivateMember('member-1', 'owner-1')
    ).rejects.toThrow(RpcException);
    expect(memberRepo.save).not.toHaveBeenCalled();
  });

  it('protects the appointed community manager from lifecycle changes', async () => {
    memberRepo.findOne.mockResolvedValue({
      id: 'member-manager',
      communityId: 'community-1',
      profileId: 'manager-profile',
      role: CommunityMemberRole.MEMBER,
      status: CommunityMembershipStatus.APPROVED,
    } as any);
    memberRepo.find.mockResolvedValue([
      {
        communityId: 'community-1',
        userId: 'owner-1',
        role: CommunityMemberRole.OWNER,
        status: CommunityMembershipStatus.APPROVED,
      },
    ] as any);
    communityRepo.findOne.mockResolvedValue({
      id: 'community-1',
      ownerId: 'owner-1',
      managerProfileId: 'manager-profile',
    } as any);

    await expect(
      service.suspendMember('member-manager', 'owner-1')
    ).rejects.toThrow(RpcException);
    expect(memberRepo.save).not.toHaveBeenCalled();
  });

  it('does not remove an appointed manager or re-audit a terminal membership', async () => {
    const manager = {
      id: 'member-manager',
      communityId: 'community-1',
      profileId: 'manager-profile',
      role: CommunityMemberRole.MEMBER,
      status: CommunityMembershipStatus.APPROVED,
    } as any;
    const revoked = {
      id: 'member-revoked',
      communityId: 'community-1',
      profileId: 'profile-revoked',
      role: CommunityMemberRole.MEMBER,
      status: CommunityMembershipStatus.REVOKED,
    } as any;
    memberRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where.id === 'member-manager') {
        return manager;
      }
      if (where.id === 'member-revoked') {
        return revoked;
      }
      if (where.userId === 'owner-1') {
        return {
          communityId: 'community-1',
          userId: 'owner-1',
          role: CommunityMemberRole.OWNER,
          status: CommunityMembershipStatus.APPROVED,
        } as any;
      }
      return null;
    });
    communityRepo.findOne.mockResolvedValue({
      id: 'community-1',
      ownerId: 'owner-1',
      managerProfileId: 'manager-profile',
    } as any);

    await expect(
      service.removeMember('member-manager', 'owner-1')
    ).rejects.toThrow(RpcException);
    await expect(
      service.removeMember('member-revoked', 'owner-1')
    ).resolves.toBeUndefined();
    expect(memberRepo.save).not.toHaveBeenCalled();
    expect(membershipAuditRepo.save).not.toHaveBeenCalled();
  });
});
