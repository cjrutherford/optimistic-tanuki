import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Community } from '../../entities/community.entity';
import {
  CommunityMember,
  CommunityMemberRole,
  CommunityMembershipStatus,
} from '../../entities/community-member.entity';
import { CommunityInvite } from '../../entities/community-invite.entity';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  SearchCommunityDto,
  JoinCommunityDto,
  InviteToCommunityDto,
} from '@optimistic-tanuki/models';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger('Social Service | Community Service');

  constructor(
    @InjectRepository(Community)
    private readonly communityRepo: Repository<Community>,
    @InjectRepository(CommunityMember)
    private readonly memberRepo: Repository<CommunityMember>,
    @InjectRepository(CommunityInvite)
    private readonly inviteRepo: Repository<CommunityInvite>
  ) {}

  async create(
    dto: CreateCommunityDto,
    userId: string,
    profileId: string,
    appScope = 'social'
  ): Promise<Community> {
    const existing = await this.communityRepo.findOne({
      where: { name: dto.name, appScope },
    });
    if (existing) {
      throw new RpcException('Community with this name already exists');
    }

    const tags = (dto.tags || []).map((name, index) => ({
      id: `${Date.now()}-${index}`,
      name,
    }));

    const community = this.communityRepo.create({
      name: dto.name,
      description: dto.description || '',
      ownerId: userId,
      ownerProfileId: profileId,
      appScope,
      isPrivate: dto.isPrivate || false,
      joinPolicy: dto.joinPolicy || 'public',
      tags,
      memberCount: 1,
      bannerAssetId: dto.bannerAssetId,
      logoAssetId: dto.logoAssetId,
    });

    const saved = await this.communityRepo.save(community);

    const ownerMember = this.memberRepo.create({
      communityId: saved.id,
      userId,
      profileId,
      role: CommunityMemberRole.OWNER,
      status: CommunityMembershipStatus.APPROVED,
    });
    await this.memberRepo.save(ownerMember);

    return saved;
  }

  async findOne(id: string): Promise<Community | null> {
    const community = await this.communityRepo.findOne({ where: { id } });
    if (community) {
      return await this.addMemberInfo(community);
    }
    return null;
  }

  async findAll(
    searchDto: SearchCommunityDto,
    appScope: string
  ): Promise<Community[]> {
    const where: any = { appScope };

    if (searchDto.name) {
      where.name = `%${searchDto.name}%`;
    }
    if (searchDto.ownerId) {
      where.ownerId = searchDto.ownerId;
    }
    if (searchDto.isPrivate !== undefined) {
      where.isPrivate = searchDto.isPrivate;
    }
    if (searchDto.joinPolicy) {
      where.joinPolicy = searchDto.joinPolicy;
    }

    const communities = await this.communityRepo.find({
      where,
      take: 50,
    });

    const communitiesWithMembers = await Promise.all(
      communities.map((community) => this.addMemberInfo(community))
    );

    return communitiesWithMembers;
  }

  async getTopActive(limit: number, appScope: string): Promise<Community[]> {
    const communities = await this.communityRepo.find({
      where: { appScope },
      order: { memberCount: 'DESC' },
      take: limit,
    });

    const communitiesWithMembers = await Promise.all(
      communities.map((community) => this.addMemberInfo(community))
    );

    return communitiesWithMembers;
  }

  private async addMemberInfo(community: Community): Promise<Community> {
    const members = await this.memberRepo.find({
      where: {
        communityId: community.id,
        status: CommunityMembershipStatus.APPROVED,
      },
    });

    (community as any).memberIds = members.map((m) => m.profileId);
    (community as any).memberUserIds = members.map((m) => m.userId);
    (community as any).ownerIds = [
      community.ownerId,
      ...members
        .filter(
          (m) =>
            m.role === CommunityMemberRole.OWNER ||
            m.role === CommunityMemberRole.ADMIN ||
            m.role === CommunityMemberRole.MODERATOR
        )
        .map((m) => m.userId),
    ];

    return community;
  }

  async update(
    id: string,
    dto: UpdateCommunityDto,
    userId: string
  ): Promise<Community> {
    const community = await this.findOne(id);
    if (!community) {
      throw new RpcException('Community not found');
    }

    const member = await this.getMember(id, userId);
    if (!member || member.role !== CommunityMemberRole.OWNER) {
      throw new RpcException('Only the owner can update the community');
    }

    if (dto.name) {
      const existing = await this.communityRepo.findOne({
        where: { name: dto.name, appScope: community.appScope },
      });
      if (existing && existing.id !== id) {
        throw new RpcException('Community with this name already exists');
      }
      community.name = dto.name;
    }

    if (dto.description !== undefined) {
      community.description = dto.description;
    }
    if (dto.isPrivate !== undefined) {
      community.isPrivate = dto.isPrivate;
    }
    if (dto.joinPolicy) {
      community.joinPolicy = dto.joinPolicy;
    }
    if (dto.tags) {
      community.tags = dto.tags.map((name, index) => ({
        id: `${Date.now()}-${index}`,
        name,
      }));
    }

    return await this.communityRepo.save(community);
  }

  async delete(id: string, userId: string): Promise<void> {
    const community = await this.findOne(id);
    if (!community) {
      throw new RpcException('Community not found');
    }

    if (community.ownerId !== userId) {
      throw new RpcException('Only the owner can delete the community');
    }

    await this.communityRepo.remove(community);
  }

  async join(
    dto: JoinCommunityDto,
    userId: string,
    profileId: string
  ): Promise<CommunityMember> {
    const community = await this.findOne(dto.communityId);
    if (!community) {
      throw new RpcException('Community not found');
    }

    const existingMember = await this.getMember(dto.communityId, userId);
    if (existingMember) {
      if (existingMember.status === CommunityMembershipStatus.APPROVED) {
        throw new RpcException('Already a member');
      }
      if (existingMember.status === CommunityMembershipStatus.PENDING) {
        throw new RpcException('Join request already pending');
      }
    }

    const existingInvite = await this.inviteRepo.findOne({
      where: {
        communityId: dto.communityId,
        inviteeId: userId,
        status: CommunityMembershipStatus.PENDING,
      },
    });

    let status: CommunityMembershipStatus;
    if (existingInvite) {
      existingInvite.status = CommunityMembershipStatus.APPROVED;
      await this.inviteRepo.save(existingInvite);
      status = CommunityMembershipStatus.APPROVED;
    } else if (community.joinPolicy === 'public') {
      status = CommunityMembershipStatus.APPROVED;
    } else {
      status = CommunityMembershipStatus.PENDING;
    }

    const member = this.memberRepo.create({
      communityId: dto.communityId,
      userId,
      profileId,
      role: CommunityMemberRole.MEMBER,
      status,
    });

    const saved = await this.memberRepo.save(member);

    if (status === CommunityMembershipStatus.APPROVED) {
      community.memberCount += 1;
      await this.communityRepo.save(community);
    }

    return saved;
  }

  async leave(communityId: string, userId: string): Promise<void> {
    const member = await this.getMember(communityId, userId);
    if (!member) {
      throw new RpcException('Not a member of this community');
    }

    if (member.role === CommunityMemberRole.OWNER) {
      throw new RpcException(
        'Owner cannot leave the community. Transfer ownership or delete instead.'
      );
    }

    await this.memberRepo.remove(member);

    const community = await this.findOne(communityId);
    if (community && community.memberCount > 0) {
      community.memberCount -= 1;
      await this.communityRepo.save(community);
    }
  }

  async getMembers(communityId: string): Promise<CommunityMember[]> {
    return await this.memberRepo.find({
      where: { communityId, status: CommunityMembershipStatus.APPROVED },
    });
  }

  async getUserCommunities(
    userId: string,
    appScope: string
  ): Promise<Community[]> {
    const members = await this.memberRepo.find({
      where: { userId, status: CommunityMembershipStatus.APPROVED },
      relations: ['community'],
    });
    return members
      .filter((m) => m.community.appScope === appScope)
      .map((m) => m.community);
  }

  async getCommunitiesByProfileId(
    profileId: string,
    appScope: string
  ): Promise<Community[]> {
    const members = await this.memberRepo.find({
      where: { profileId, status: CommunityMembershipStatus.APPROVED },
      relations: ['community'],
    });
    return members
      .filter((m) => m.community.appScope === appScope)
      .map((m) => m.community);
  }

  async getMember(
    communityId: string,
    userId: string
  ): Promise<CommunityMember | null> {
    return await this.memberRepo.findOne({ where: { communityId, userId } });
  }

  async isMember(communityId: string, userId: string): Promise<boolean> {
    const member = await this.getMember(communityId, userId);
    return member?.status === CommunityMembershipStatus.APPROVED;
  }

  async hasPermission(
    communityId: string,
    userId: string,
    requiredRoles: CommunityMemberRole[]
  ): Promise<boolean> {
    const member = await this.getMember(communityId, userId);
    if (!member || member.status !== CommunityMembershipStatus.APPROVED) {
      return false;
    }
    return requiredRoles.includes(member.role);
  }

  async invite(
    dto: InviteToCommunityDto,
    inviterId: string
  ): Promise<CommunityInvite> {
    const community = await this.findOne(dto.communityId);
    if (!community) {
      throw new RpcException('Community not found');
    }

    const inviterMember = await this.getMember(dto.communityId, inviterId);
    if (
      !inviterMember ||
      ![
        CommunityMemberRole.OWNER,
        CommunityMemberRole.ADMIN,
        CommunityMemberRole.MODERATOR,
      ].includes(inviterMember.role)
    ) {
      throw new RpcException('Only admins can invite users');
    }

    const existingMember = await this.getMember(
      dto.communityId,
      dto.inviteeUserId
    );
    if (existingMember) {
      throw new RpcException('User is already a member');
    }

    const existingInvite = await this.inviteRepo.findOne({
      where: { communityId: dto.communityId, inviteeId: dto.inviteeUserId },
    });

    if (existingInvite) {
      if (existingInvite.status === CommunityMembershipStatus.PENDING) {
        throw new RpcException('Invite already pending');
      }
      existingInvite.status = CommunityMembershipStatus.PENDING;
      existingInvite.inviterId = inviterId;
      return await this.inviteRepo.save(existingInvite);
    }

    const invite = this.inviteRepo.create({
      communityId: dto.communityId,
      inviterId,
      inviteeId: dto.inviteeUserId,
      status: CommunityMembershipStatus.PENDING,
    });

    return await this.inviteRepo.save(invite);
  }

  async cancelInvite(inviteId: string, userId: string): Promise<void> {
    const invite = await this.inviteRepo.findOne({ where: { id: inviteId } });
    if (!invite) {
      throw new RpcException('Invite not found');
    }

    const community = await this.findOne(invite.communityId);
    if (community.ownerId !== userId) {
      const member = await this.getMember(invite.communityId, userId);
      if (
        !member ||
        ![
          CommunityMemberRole.OWNER,
          CommunityMemberRole.ADMIN,
          CommunityMemberRole.MODERATOR,
        ].includes(member.role)
      ) {
        throw new RpcException('Only admins can cancel invites');
      }
    }

    await this.inviteRepo.remove(invite);
  }

  async getPendingInvites(
    communityId: string,
    userId: string
  ): Promise<CommunityInvite[]> {
    const community = await this.findOne(communityId);
    if (!community) {
      throw new RpcException('Community not found');
    }

    const member = await this.getMember(communityId, userId);
    if (!member || member.status !== CommunityMembershipStatus.APPROVED) {
      throw new RpcException('Only members can view invites');
    }

    return await this.inviteRepo.find({
      where: { communityId, status: CommunityMembershipStatus.PENDING },
    });
  }

  async getPendingJoinRequests(
    communityId: string,
    userId: string
  ): Promise<CommunityMember[]> {
    const community = await this.findOne(communityId);
    if (!community) {
      throw new RpcException('Community not found');
    }

    const member = await this.getMember(communityId, userId);
    if (
      !member ||
      ![
        CommunityMemberRole.OWNER,
        CommunityMemberRole.ADMIN,
        CommunityMemberRole.MODERATOR,
      ].includes(member.role)
    ) {
      throw new RpcException('Only admins can view join requests');
    }

    return await this.memberRepo.find({
      where: { communityId, status: CommunityMembershipStatus.PENDING },
    });
  }

  async approveMember(
    memberId: string,
    approverId: string
  ): Promise<CommunityMember> {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });
    if (!member) {
      throw new RpcException('Member not found');
    }

    const community = await this.findOne(member.communityId);
    if (!community) {
      throw new RpcException('Community not found');
    }

    const approver = await this.getMember(member.communityId, approverId);
    if (
      !approver ||
      ![
        CommunityMemberRole.OWNER,
        CommunityMemberRole.ADMIN,
        CommunityMemberRole.MODERATOR,
      ].includes(approver.role)
    ) {
      throw new RpcException('Only admins can approve members');
    }

    member.status = CommunityMembershipStatus.APPROVED;
    const saved = await this.memberRepo.save(member);

    community.memberCount += 1;
    await this.communityRepo.save(community);

    return saved;
  }

  async rejectMember(memberId: string, rejecterId: string): Promise<void> {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });
    if (!member) {
      throw new RpcException('Member not found');
    }

    const community = await this.findOne(member.communityId);
    if (!community) {
      throw new RpcException('Community not found');
    }

    const rejecter = await this.getMember(member.communityId, rejecterId);
    if (
      !rejecter ||
      ![
        CommunityMemberRole.OWNER,
        CommunityMemberRole.ADMIN,
        CommunityMemberRole.MODERATOR,
      ].includes(rejecter.role)
    ) {
      throw new RpcException('Only admins can reject members');
    }

    await this.memberRepo.remove(member);
  }

  async removeMember(memberId: string, removerId: string): Promise<void> {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });
    if (!member) {
      throw new RpcException('Member not found');
    }

    const community = await this.findOne(member.communityId);
    if (!community) {
      throw new RpcException('Community not found');
    }

    const remover = await this.getMember(member.communityId, removerId);
    if (!remover) {
      throw new RpcException('Not a member');
    }

    if (member.role === CommunityMemberRole.OWNER) {
      throw new RpcException('Cannot remove the owner');
    }

    if (
      remover.role === CommunityMemberRole.MODERATOR &&
      member.role !== CommunityMemberRole.MEMBER
    ) {
      throw new RpcException('Moderators can only remove regular members');
    }

    if (
      remover.role === CommunityMemberRole.ADMIN &&
      member.role === CommunityMemberRole.ADMIN &&
      removerId !== community.ownerId
    ) {
      throw new RpcException('Only the owner can remove other admins');
    }

    if (remover.role === CommunityMemberRole.MEMBER) {
      throw new RpcException('Members cannot remove other members');
    }

    await this.memberRepo.remove(member);

    if (community.memberCount > 0) {
      community.memberCount -= 1;
      await this.communityRepo.save(community);
    }
  }

  async getUserInvites(userId: string): Promise<CommunityInvite[]> {
    return await this.inviteRepo.find({
      where: { inviteeId: userId, status: CommunityMembershipStatus.PENDING },
    });
  }

  async getCommunityChatRoom(
    communityId: string
  ): Promise<{ id: string } | null> {
    const community = await this.findOne(communityId);
    if (!community || !community.chatRoomId) {
      return null;
    }
    return { id: community.chatRoomId };
  }

  async setCommunityChatRoom(
    communityId: string,
    chatRoomId: string
  ): Promise<void> {
    await this.communityRepo.update(communityId, { chatRoomId });
  }

  async updateMemberRole(
    memberId: string,
    newRole: CommunityMemberRole,
    requesterId: string
  ): Promise<CommunityMember> {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });
    if (!member) {
      throw new RpcException('Member not found');
    }

    if (member.role === CommunityMemberRole.OWNER) {
      throw new RpcException('Cannot change the owner role');
    }

    const community = await this.findOne(member.communityId);
    if (!community) {
      throw new RpcException('Community not found');
    }

    const requester = await this.getMember(member.communityId, requesterId);
    if (!requester) {
      throw new RpcException('Not a member of this community');
    }

    if (requester.role !== CommunityMemberRole.OWNER) {
      if (requester.role === CommunityMemberRole.ADMIN) {
        if (newRole === CommunityMemberRole.OWNER) {
          throw new RpcException('Only the owner can assign owner role');
        }
        if (
          member.role === CommunityMemberRole.ADMIN &&
          requesterId !== community.ownerId
        ) {
          throw new RpcException('Only the owner can change admin roles');
        }
      } else if (requester.role === CommunityMemberRole.MODERATOR) {
        throw new RpcException('Moderators cannot change member roles');
      } else {
        throw new RpcException('Members cannot change member roles');
      }
    }

    member.role = newRole;
    return await this.memberRepo.save(member);
  }
}
