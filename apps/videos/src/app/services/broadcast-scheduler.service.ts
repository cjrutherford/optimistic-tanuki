import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PaymentCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { ChannelFeedDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import {
  PlaylistDecision,
  PlaylistGenerator,
} from './playlist-generator.service';
import { BroadcastService } from './broadcast.service';

export interface SchedulerRunResult {
  processedFeeds: number;
  liveFeeds: number;
  scheduledFeeds: number;
  replayFeeds: number;
  offlineFeeds: number;
  decisions: PlaylistDecision[];
}

export interface BroadcastSchedulerOptions {
  enabled?: boolean;
  intervalMs?: number;
  fillerVideoId?: string | null;
}

export const BROADCAST_SCHEDULER_OPTIONS = 'BROADCAST_SCHEDULER_OPTIONS';

@Injectable()
export class BroadcastSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BroadcastSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly options: Required<BroadcastSchedulerOptions>;

  constructor(
    private readonly broadcastService: BroadcastService,
    @Inject(PlaylistGenerator)
    private readonly playlistGenerator: PlaylistGenerator,
    @Optional()
    @Inject(BROADCAST_SCHEDULER_OPTIONS)
    options?: BroadcastSchedulerOptions,
    @Optional()
    @Inject(ServiceTokens.PAYMENTS_SERVICE)
    private readonly paymentService?: ClientProxy
  ) {
    this.options = {
      enabled:
        options?.enabled ??
        process.env['BROADCAST_SCHEDULER_ENABLED'] !== 'false',
      intervalMs:
        options?.intervalMs ??
        Number.parseInt(
          process.env['BROADCAST_SCHEDULER_INTERVAL_MS'] || '15000',
          10
        ),
      fillerVideoId:
        options?.fillerVideoId ??
        process.env['BROADCAST_FILLER_VIDEO_ID'] ??
        null,
    };
  }

  onModuleInit(): void {
    if (!this.options.enabled) {
      this.logger.log('Broadcast scheduler disabled');
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) => {
        this.logger.error('Broadcast scheduler tick failed', error);
      });
    }, Math.max(1000, this.options.intervalMs));
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce(now = new Date()): Promise<SchedulerRunResult> {
    const feeds = await this.broadcastService.refreshAllFeeds(now);
    const counts = feeds.reduce(
      (result, feed) => {
        result[`${feed.currentMode}Feeds` as keyof typeof result] += 1;
        return result;
      },
      {
        liveFeeds: 0,
        scheduledFeeds: 0,
        replayFeeds: 0,
        offlineFeeds: 0,
      }
    );

    return {
      processedFeeds: feeds.length,
      ...counts,
      decisions: await Promise.all(
        feeds.map(async (feed) => {
          const decision = await this.buildDecision(feed);
          await this.broadcastService.persistPlaylistDecision(
            feed.id,
            decision,
            now
          );
          return decision;
        })
      ),
    };
  }

  private async buildDecision(feed: ChannelFeedDto): Promise<PlaylistDecision> {
    const ad = await this.findAdCandidate(feed);
    return this.playlistGenerator.buildDecision({
      liveSessionId:
        feed.currentMode === 'live' ? feed.activeLiveSessionId : null,
      scheduledBlockId:
        feed.currentMode === 'scheduled' ? feed.activeProgramBlockId : null,
      scheduledVideoId:
        feed.currentMode === 'scheduled' ? feed.activeVideoId : null,
      replayVideoId: feed.currentMode === 'replay' ? feed.activeVideoId : null,
      fillerVideoId: this.options.fillerVideoId,
      ad,
    });
  }

  private async findAdCandidate(feed: ChannelFeedDto) {
    if (
      !this.paymentService ||
      feed.currentMode === 'live' ||
      feed.currentMode === 'offline'
    ) {
      return null;
    }

    const placementType: 'pre-roll' | 'post-roll' =
      feed.currentMode === 'scheduled' ? 'pre-roll' : 'post-roll';
    try {
      const candidates = await firstValueFrom(
        this.paymentService.send(
          { cmd: PaymentCommands.GET_ELIGIBLE_PLAYBACK_CAMPAIGNS },
          {
            channelId: feed.channelId,
            communityId: feed.communityId,
            placementType,
          }
        )
      );
      const candidate = candidates?.[0];
      return candidate?.mediaUrl
        ? {
            placementType,
            mediaUrl: candidate.mediaUrl,
          }
        : null;
    } catch (error) {
      this.logger.warn(
        `Unable to load playback campaigns for ${feed.channelId}: ${String(
          error
        )}`
      );
      return null;
    }
  }
}
