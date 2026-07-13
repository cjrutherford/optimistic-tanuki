import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import {
  ChannelFeedDto,
  CreateProgramBlockDto,
  LiveHandoffDto,
  LivePlaybackTokenDto,
  LivePlaybackTokenValidationDto,
  LiveSessionDto,
  ProgramBlockDto,
  StartLiveSessionDto,
} from '@optimistic-tanuki/models';
import { ChannelFeed } from '../../entities/channel-feed.entity';
import { LiveSession } from '../../entities/live-session.entity';
import { ProgramBlock } from '../../entities/program-block.entity';
import { PlaylistDecisionHistory } from '../../entities/playlist-decision-history.entity';
import { LiveMediaTransportService } from './live-media-transport.service';
import type { PlaylistDecision } from './playlist-generator.service';

interface LiveTokenClaims {
  audience: 'metrocast-live';
  communityId: string;
  sessionId: string;
  expiresAt: number;
  issuedAt: number;
  nonce: string;
}

@Injectable()
export class BroadcastService {
  constructor(
    @InjectRepository(ChannelFeed)
    private readonly feedRepository: Repository<ChannelFeed>,
    @InjectRepository(ProgramBlock)
    private readonly blockRepository: Repository<ProgramBlock>,
    @InjectRepository(LiveSession)
    private readonly sessionRepository: Repository<LiveSession>,
    private readonly liveMediaTransport: LiveMediaTransportService,
    @Optional()
    @InjectRepository(PlaylistDecisionHistory)
    private readonly playlistHistoryRepository?: Repository<PlaylistDecisionHistory>
  ) {}

  async getFeedByCommunityId(
    communityId: string
  ): Promise<ChannelFeedDto | null> {
    const feed = await this.feedRepository.findOne({ where: { communityId } });
    if (!feed) {
      return null;
    }

    const resolvedFeed = await this.resolveFeedState(feed);
    return this.hydrateFeedDto(resolvedFeed);
  }

  async getScheduleByCommunityId(
    communityId: string
  ): Promise<ProgramBlockDto[]> {
    return this.loadResolvedBlocks(communityId);
  }

  async refreshAllFeeds(now = new Date()): Promise<ChannelFeedDto[]> {
    const feeds = await this.feedRepository.find({
      order: { communityId: 'ASC' },
    });
    const refreshedFeeds: ChannelFeedDto[] = [];

    for (const feed of feeds) {
      const resolvedFeed = await this.resolveFeedState(feed, now);
      refreshedFeeds.push(await this.hydrateFeedDto(resolvedFeed));
    }

    return refreshedFeeds;
  }

  async persistPlaylistDecision(
    feedId: string,
    decision: PlaylistDecision,
    decidedAt = new Date()
  ): Promise<void> {
    const feed = await this.feedRepository.findOne({ where: { id: feedId } });
    if (!feed) {
      return;
    }

    if (
      feed.activePlaylistKind === decision.kind &&
      feed.activePlaylistReason === decision.reason &&
      feed.activePlaylistSessionId === (decision.sessionId ?? null) &&
      feed.activePlaylistBlockId === (decision.blockId ?? null) &&
      feed.activePlaylistVideoId === (decision.videoId ?? null) &&
      feed.activePlaylistPlacementType === (decision.placementType ?? null) &&
      feed.activePlaylistMediaUrl === (decision.mediaUrl ?? null)
    ) {
      return;
    }

    feed.activePlaylistKind = decision.kind;
    feed.activePlaylistReason = decision.reason;
    feed.activePlaylistSessionId = decision.sessionId ?? null;
    feed.activePlaylistBlockId = decision.blockId ?? null;
    feed.activePlaylistVideoId = decision.videoId ?? null;
    feed.activePlaylistPlacementType = decision.placementType ?? null;
    feed.activePlaylistMediaUrl = decision.mediaUrl ?? null;
    feed.activePlaylistDecidedAt = decidedAt;
    await this.feedRepository.save(feed);
    if (this.playlistHistoryRepository) {
      await this.playlistHistoryRepository.save(
        this.playlistHistoryRepository.create({
          feedId,
          kind: decision.kind,
          reason: decision.reason,
          sessionId: decision.sessionId ?? null,
          blockId: decision.blockId ?? null,
          videoId: decision.videoId ?? null,
          placementType: decision.placementType ?? null,
          mediaUrl: decision.mediaUrl ?? null,
          decidedAt,
        })
      );
    }
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

    feed.activeLiveSessionId = null;
    await this.resolveFeedState(feed, now);

    return savedSession;
  }

  async issueLiveToken(communityId: string): Promise<LivePlaybackTokenDto> {
    const feed = await this.feedRepository.findOne({ where: { communityId } });
    if (!feed?.activeLiveSessionId || feed.currentMode !== 'live') {
      return {
        status: 'unavailable',
        sessionId: null,
        playbackUrl: null,
        token: null,
        expiresAt: null,
      };
    }

    const session = await this.sessionRepository.findOne({
      where: { id: feed.activeLiveSessionId },
    });
    if (!session || session.status !== 'live' || session.endedAt) {
      return {
        status: 'unavailable',
        sessionId: null,
        playbackUrl: null,
        token: null,
        expiresAt: null,
      };
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    return {
      status: 'ready',
      sessionId: session.id,
      playbackUrl: session.liveSourceUrl ?? null,
      mediaTransport: this.liveMediaTransport.createConnection({
        communityId,
        sessionId: session.id,
        expiresAt,
      }),
      token: this.signLiveToken({
        audience: 'metrocast-live',
        communityId,
        sessionId: session.id,
        expiresAt: Math.floor(expiresAt.getTime() / 1000),
        issuedAt: Math.floor(Date.now() / 1000),
        nonce: randomUUID(),
      }),
      expiresAt,
    };
  }

  async validateLiveToken(
    communityId: string,
    token: string
  ): Promise<LivePlaybackTokenValidationDto> {
    const claims = this.readLiveToken(token);
    if (
      !claims ||
      claims.audience !== 'metrocast-live' ||
      claims.communityId !== communityId ||
      claims.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return { valid: false };
    }

    const feed = await this.feedRepository.findOne({ where: { communityId } });
    if (
      !feed ||
      feed.currentMode !== 'live' ||
      feed.activeLiveSessionId !== claims.sessionId
    ) {
      return { valid: false };
    }

    const session = await this.sessionRepository.findOne({
      where: { id: claims.sessionId },
    });
    if (!session || session.status !== 'live' || session.endedAt) {
      return { valid: false };
    }

    return {
      valid: true,
      sessionId: session.id,
      playbackUrl: session.liveSourceUrl ?? null,
      mediaTransport: this.liveMediaTransport.createConnection({
        communityId,
        sessionId: session.id,
        expiresAt: new Date(claims.expiresAt * 1000),
      }),
      expiresAt: new Date(claims.expiresAt * 1000),
    };
  }

  private signLiveToken(claims: LiveTokenClaims): string {
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'OT-LIVE' })
    ).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const unsignedToken = `${header}.${payload}`;
    const signature = createHmac('sha256', this.liveTokenSecret())
      .update(unsignedToken)
      .digest('base64url');
    return `${unsignedToken}.${signature}`;
  }

  private readLiveToken(token: string): LiveTokenClaims | null {
    const [header, payload, signature, ...extra] = token.split('.');
    if (!header || !payload || !signature || extra.length > 0) {
      return null;
    }

    const expectedSignature = createHmac('sha256', this.liveTokenSecret())
      .update(`${header}.${payload}`)
      .digest('base64url');
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      return null;
    }

    try {
      const claims = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8')
      ) as LiveTokenClaims;
      return this.isLiveTokenClaims(claims) ? claims : null;
    } catch {
      return null;
    }
  }

  private liveTokenSecret(): string {
    const configuredSecret =
      process.env['LIVE_PLAYBACK_TOKEN_SECRET'] || process.env['JWT_SECRET'];
    if (configuredSecret) {
      return configuredSecret;
    }
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'LIVE_PLAYBACK_TOKEN_SECRET must be configured in production'
      );
    }
    return 'development-only-live-playback-token-secret';
  }

  private isLiveTokenClaims(value: unknown): value is LiveTokenClaims {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const claims = value as Partial<LiveTokenClaims>;
    return (
      claims.audience === 'metrocast-live' &&
      typeof claims.communityId === 'string' &&
      typeof claims.sessionId === 'string' &&
      typeof claims.expiresAt === 'number' &&
      typeof claims.issuedAt === 'number' &&
      typeof claims.nonce === 'string'
    );
  }

  private async resolveFeedState(
    feed: ChannelFeed,
    now = new Date()
  ): Promise<ChannelFeed> {
    if (feed.activeLiveSessionId) {
      const session = await this.sessionRepository.findOne({
        where: { id: feed.activeLiveSessionId },
      });
      if (session?.status === 'live' && !session.endedAt) {
        return feed;
      }

      feed.activeLiveSessionId = null;
    }

    const blocks = await this.loadResolvedBlocks(feed.communityId, now);
    const liveBlock = blocks.find((block) => block.status === 'live') ?? null;
    const replayBlock =
      liveBlock === null
        ? [...blocks]
            .reverse()
            .find(
              (block) =>
                block.blockType === 'prerecorded' &&
                !!block.videoId &&
                block.status === 'completed'
            ) ?? null
        : null;

    if (liveBlock) {
      feed.currentMode = 'scheduled';
      feed.activeProgramBlockId = liveBlock.id;
      feed.activeVideoId = liveBlock.videoId ?? null;
    } else if (replayBlock) {
      feed.currentMode = 'replay';
      feed.activeProgramBlockId = replayBlock.id;
      feed.activeVideoId = replayBlock.videoId ?? null;
    } else {
      feed.currentMode = 'offline';
      feed.activeProgramBlockId = null;
      feed.activeVideoId = null;
    }

    feed.lastTransitionAt = now;
    return this.feedRepository.save(feed);
  }

  private async hydrateFeedDto(feed: ChannelFeed): Promise<ChannelFeedDto> {
    const activeLiveSession = feed.activeLiveSessionId
      ? await this.sessionRepository.findOne({
          where: { id: feed.activeLiveSessionId },
        })
      : null;

    return {
      ...feed,
      activePlaylistItem: {
        kind: feed.activePlaylistKind,
        reason: feed.activePlaylistReason,
        sessionId: feed.activePlaylistSessionId,
        blockId: feed.activePlaylistBlockId,
        videoId: feed.activePlaylistVideoId,
        placementType: feed.activePlaylistPlacementType,
        mediaUrl: feed.activePlaylistMediaUrl,
        decidedAt: feed.activePlaylistDecidedAt,
      },
      activeLiveSession,
      liveHandoff: this.buildLiveHandoff(feed, activeLiveSession),
    };
  }

  private buildLiveHandoff(
    feed: ChannelFeed,
    activeLiveSession: LiveSession | null
  ): LiveHandoffDto {
    if (feed.currentMode === 'live' && activeLiveSession?.status === 'live') {
      return {
        status: 'ready',
        playbackPath: null,
        requiresAuth: false,
        tokenContract: 'gateway-token-exchange',
        localityPolicy: 'planned-channel-anchor',
      };
    }

    if (feed.currentMode === 'scheduled') {
      return {
        status: 'standby',
        playbackPath: null,
        requiresAuth: false,
        tokenContract: 'gateway-token-exchange',
        localityPolicy: 'planned-channel-anchor',
      };
    }

    if (feed.currentMode === 'replay') {
      return {
        status: 'ended',
        playbackPath: null,
        requiresAuth: false,
        tokenContract: 'none',
        localityPolicy: 'none',
      };
    }

    return {
      status: 'idle',
      playbackPath: null,
      requiresAuth: false,
      tokenContract: 'none',
      localityPolicy: 'none',
    };
  }

  private async loadResolvedBlocks(
    communityId: string,
    now = new Date()
  ): Promise<ProgramBlock[]> {
    const blocks = await this.blockRepository.find({
      where: { communityId },
      order: { startsAt: 'ASC' },
    });
    const changedBlocks: ProgramBlock[] = [];

    for (const block of blocks) {
      const nextStatus = this.resolveBlockStatus(block, now);
      if (block.status !== nextStatus) {
        block.status = nextStatus;

        if (nextStatus === 'live' && !block.actualStartAt) {
          block.actualStartAt = now;
        }
        if (nextStatus === 'completed' && !block.actualEndAt) {
          block.actualEndAt = now;
        }

        changedBlocks.push(block);
      }
    }

    for (const block of changedBlocks) {
      await this.blockRepository.save(block);
    }

    return blocks;
  }

  private resolveBlockStatus(
    block: ProgramBlock,
    now: Date
  ): ProgramBlock['status'] {
    if (block.status === 'cancelled' || block.status === 'interrupted') {
      return block.status;
    }

    const startsAt =
      block.startsAt instanceof Date
        ? block.startsAt
        : new Date(block.startsAt);
    const endsAt =
      block.endsAt instanceof Date ? block.endsAt : new Date(block.endsAt);

    if (now >= endsAt) {
      return 'completed';
    }

    if (now >= startsAt && now < endsAt) {
      return 'live';
    }

    return 'scheduled';
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
