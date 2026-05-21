import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateChannelDto,
  UpdateChannelDto,
} from '@optimistic-tanuki/models';
import { randomUUID } from 'crypto';
import { Channel } from '../../entities/channel.entity';
import { ChannelFeed } from '../../entities/channel-feed.entity';

@Injectable()
export class ChannelService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelFeed)
    private readonly feedRepository: Repository<ChannelFeed>
  ) {}

  async create(createChannelDto: CreateChannelDto): Promise<Channel> {
    const channel = this.channelRepository.create({
      ...createChannelDto,
      communityId: createChannelDto.communityId ?? randomUUID(),
      communitySlug:
        createChannelDto.communitySlug ?? this.slugify(createChannelDto.name),
      joinPolicy: createChannelDto.joinPolicy ?? 'public',
      appScope: 'video-client',
      memberCount: 1,
      isPublic: true,
      timezone: createChannelDto.timezone ?? 'UTC',
    });
    const savedChannel = await this.channelRepository.save(channel);
    await this.feedRepository.save(
      this.feedRepository.create({
        channelId: savedChannel.id,
        communityId: savedChannel.communityId,
        timezone: savedChannel.timezone ?? 'UTC',
        currentMode: 'offline',
        activeProgramBlockId: null,
        activeLiveSessionId: null,
        activeVideoId: null,
        lastTransitionAt: new Date(),
      })
    );
    return this.findOne(savedChannel.id);
  }

  async findAll(): Promise<Channel[]> {
    return this.channelRepository.find({
      relations: ['videos', 'subscriptions', 'feed'],
    });
  }

  async findOne(id: string): Promise<Channel> {
    return this.channelRepository.findOne({
      where: { id },
      relations: ['videos', 'subscriptions', 'feed'],
    });
  }

  async findByUser(userId: string): Promise<Channel[]> {
    return this.channelRepository.find({
      where: { userId },
      relations: ['videos', 'subscriptions', 'feed'],
    });
  }

  async findBySlugOrId(slugOrId: string): Promise<Channel | null> {
    const bySlug = await this.channelRepository.findOne({
      where: { communitySlug: slugOrId },
      relations: ['videos', 'subscriptions', 'feed'],
    });
    if (bySlug) {
      return bySlug;
    }

    return this.channelRepository.findOne({
      where: { id: slugOrId },
      relations: ['videos', 'subscriptions', 'feed'],
    });
  }

  async update(
    id: string,
    updateChannelDto: UpdateChannelDto
  ): Promise<Channel> {
    const channel = await this.findOne(id);
    if (!channel) {
      throw new Error(`Channel with ID ${id} not found`);
    }
    await this.channelRepository.update(id, {
      ...updateChannelDto,
      communitySlug:
        updateChannelDto.communitySlug ??
        (updateChannelDto.name ? this.slugify(updateChannelDto.name) : undefined),
      updatedAt: new Date(),
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.channelRepository.delete(id);
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }
}
