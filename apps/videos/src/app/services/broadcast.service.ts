import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  ChannelFeedDto,
  CreateProgramBlockDto,
  LiveSessionDto,
  ProgramBlockDto,
  StartLiveSessionDto,
} from '@optimistic-tanuki/models';
import { ChannelFeed } from '../../entities/channel-feed.entity';
import { LiveSession } from '../../entities/live-session.entity';
import { ProgramBlock } from '../../entities/program-block.entity';

@Injectable()
export class BroadcastService {
  constructor(
    @InjectRepository(ChannelFeed)
    private readonly feedRepository: Repository<ChannelFeed>,
    @InjectRepository(ProgramBlock)
    private readonly blockRepository: Repository<ProgramBlock>,
    @InjectRepository(LiveSession)
    private readonly sessionRepository: Repository<LiveSession>
  ) {}

  async getFeedByCommunityId(communityId: string): Promise<ChannelFeedDto | null> {
    return this.feedRepository.findOne({ where: { communityId } });
  }

  async getScheduleByCommunityId(
    communityId: string
  ): Promise<ProgramBlockDto[]> {
    return this.blockRepository.find({
      where: { communityId },
      order: { startsAt: 'ASC' },
    });
  }

  async createProgramBlock(
    createProgramBlockDto: CreateProgramBlockDto
  ): Promise<ProgramBlockDto> {
    await this.ensureFeed({
      communityId: createProgramBlockDto.communityId,
      channelId: createProgramBlockDto.channelId,
      timezone: 'UTC',
    });

    const block = this.blockRepository.create({
      ...createProgramBlockDto,
      videoId: createProgramBlockDto.videoId ?? null,
      description: createProgramBlockDto.description ?? null,
      startsAt: new Date(createProgramBlockDto.startsAt),
      endsAt: new Date(createProgramBlockDto.endsAt),
      status: 'scheduled',
      actualStartAt: null,
      actualEndAt: null,
    });

    return this.blockRepository.save(block);
  }

  async startLiveSession(
    startLiveSessionDto: StartLiveSessionDto
  ): Promise<LiveSessionDto> {
    const feed = await this.ensureFeed({
      communityId: startLiveSessionDto.communityId,
      channelId: startLiveSessionDto.channelId ?? null,
      timezone: 'UTC',
    });
    const now = new Date();

    if (feed.activeProgramBlockId) {
      const block = await this.blockRepository.findOne({
        where: { id: feed.activeProgramBlockId },
      });
      if (block && block.blockType === 'prerecorded') {
        block.status = 'interrupted';
        block.actualEndAt = now;
        await this.blockRepository.save(block);
      }
    }

    const liveSession = this.sessionRepository.create({
      id: randomUUID(),
      ...startLiveSessionDto,
      channelId: startLiveSessionDto.channelId ?? feed.channelId ?? null,
      description: startLiveSessionDto.description ?? null,
      thumbnailAssetId: startLiveSessionDto.thumbnailAssetId ?? null,
      liveSourceUrl: startLiveSessionDto.liveSourceUrl ?? null,
      status: 'live',
      startedAt: now,
      endedAt: null,
    });
    const savedSession = await this.sessionRepository.save(liveSession);

    feed.currentMode = 'live';
    feed.activeProgramBlockId = null;
    feed.activeLiveSessionId = savedSession.id;
    feed.activeVideoId = null;
    feed.lastTransitionAt = now;
    await this.feedRepository.save(feed);

    return savedSession;
  }

  async stopLiveSession(communityId: string): Promise<LiveSessionDto | null> {
    const feed = await this.feedRepository.findOne({ where: { communityId } });
    if (!feed?.activeLiveSessionId) {
      return null;
    }

    const session = await this.sessionRepository.findOne({
      where: { id: feed.activeLiveSessionId },
    });
    if (!session) {
      return null;
    }

    const now = new Date();
    session.status = 'ended';
    session.endedAt = now;
    const savedSession = await this.sessionRepository.save(session);

    feed.currentMode = 'offline';
    feed.activeLiveSessionId = null;
    feed.lastTransitionAt = now;
    await this.feedRepository.save(feed);

    return savedSession;
  }

  private async ensureFeed(input: {
    communityId: string;
    channelId?: string | null;
    timezone?: string | null;
  }): Promise<ChannelFeed> {
    const existingFeed = await this.feedRepository.findOne({
      where: { communityId: input.communityId },
    });
    if (existingFeed) {
      return existingFeed;
    }

    const feed = this.feedRepository.create({
      communityId: input.communityId,
      channelId: input.channelId ?? randomUUID(),
      timezone: input.timezone ?? 'UTC',
      currentMode: 'offline',
      activeProgramBlockId: null,
      activeLiveSessionId: null,
      activeVideoId: null,
      lastTransitionAt: new Date(),
    });
    return this.feedRepository.save(feed);
  }
}
