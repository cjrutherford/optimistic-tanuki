import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { LocalCommunityEntity } from './entities/local-community.entity';
import { LocalCommunityMembershipEntity } from './entities/local-community-membership.entity';

@Injectable()
export class LocalCommunityService {
  private readonly logger = new Logger(LocalCommunityService.name);

  constructor(
    @InjectRepository(LocalCommunityEntity)
    private readonly communityRepo: Repository<LocalCommunityEntity>,
    @InjectRepository(LocalCommunityMembershipEntity)
    private readonly membershipRepo: Repository<LocalCommunityMembershipEntity>
  ) {}

  async list(): Promise<LocalCommunityEntity[]> {
    return this.communityRepo.find({
      order: { memberCount: 'DESC', name: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<LocalCommunityEntity> {
    const community = await this.communityRepo.findOne({ where: { slug } });
    if (!community) {
      throw new RpcException(`Community '${slug}' not found`);
    }
    return community;
  }

  async join(
    communityId: string,
    userId: string,
    profileId: string
  ): Promise<void> {
    const community = await this.communityRepo.findOne({
      where: { id: communityId },
    });
    if (!community) {
      throw new RpcException(`Community ${communityId} not found`);
    }

    const existing = await this.membershipRepo.findOne({
      where: { communityId, userId },
    });
    if (existing) {
      return; // already a member — idempotent
    }

    const membership = this.membershipRepo.create({
      communityId,
      userId,
      profileId,
    });
    await this.membershipRepo.save(membership);
    await this.communityRepo.increment({ id: communityId }, 'memberCount', 1);
    this.logger.log(`User ${userId} joined community ${communityId}`);
  }

  async leave(communityId: string, userId: string): Promise<void> {
    const membership = await this.membershipRepo.findOne({
      where: { communityId, userId },
    });
    if (!membership) {
      return; // not a member — idempotent
    }
    await this.membershipRepo.remove(membership);
    await this.communityRepo.decrement({ id: communityId }, 'memberCount', 1);
    this.logger.log(`User ${userId} left community ${communityId}`);
  }

  async isMember(communityId: string, userId: string): Promise<boolean> {
    const membership = await this.membershipRepo.findOne({
      where: { communityId, userId },
    });
    return !!membership;
  }
}
