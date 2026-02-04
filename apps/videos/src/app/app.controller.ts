import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { VideoCommands } from '@optimistic-tanuki/constants';
import {
  CreateChannelDto,
  UpdateChannelDto,
  CreateVideoDto,
  UpdateVideoDto,
  CreateChannelSubscriptionDto,
  RecordVideoViewDto,
} from '@optimistic-tanuki/models';
import { ChannelService } from './services/channel.service';
import { VideoService } from './services/video.service';
import { SubscriptionService } from './services/subscription.service';
import { VideoViewService } from './services/video-view.service';

@Controller()
export class AppController {
  constructor(
    private readonly channelService: ChannelService,
    private readonly videoService: VideoService,
    private readonly subscriptionService: SubscriptionService,
    private readonly videoViewService: VideoViewService
  ) {}

  // Channel endpoints
  @MessagePattern({ cmd: VideoCommands.CREATE_CHANNEL })
  async createChannel(@Payload() createChannelDto: CreateChannelDto) {
    return this.channelService.create(createChannelDto);
  }

  @MessagePattern({ cmd: VideoCommands.FIND_ALL_CHANNELS })
  async findAllChannels() {
    return this.channelService.findAll();
  }

  @MessagePattern({ cmd: VideoCommands.FIND_ONE_CHANNEL })
  async findOneChannel(@Payload() id: string) {
    return this.channelService.findOne(id);
  }

  @MessagePattern({ cmd: VideoCommands.FIND_CHANNELS_BY_USER })
  async findChannelsByUser(@Payload() userId: string) {
    return this.channelService.findByUser(userId);
  }

  @MessagePattern({ cmd: VideoCommands.UPDATE_CHANNEL })
  async updateChannel(
    @Payload() payload: { id: string; updateChannelDto: UpdateChannelDto }
  ) {
    return this.channelService.update(payload.id, payload.updateChannelDto);
  }

  @MessagePattern({ cmd: VideoCommands.DELETE_CHANNEL })
  async deleteChannel(@Payload() id: string) {
    return this.channelService.remove(id);
  }

  // Video endpoints
  @MessagePattern({ cmd: VideoCommands.CREATE_VIDEO })
  async createVideo(@Payload() createVideoDto: CreateVideoDto) {
    return this.videoService.create(createVideoDto);
  }

  @MessagePattern({ cmd: VideoCommands.FIND_ALL_VIDEOS })
  async findAllVideos() {
    return this.videoService.findAll();
  }

  @MessagePattern({ cmd: VideoCommands.FIND_ONE_VIDEO })
  async findOneVideo(@Payload() id: string) {
    return this.videoService.findOne(id);
  }

  @MessagePattern({ cmd: VideoCommands.FIND_VIDEOS_BY_CHANNEL })
  async findVideosByChannel(@Payload() channelId: string) {
    return this.videoService.findByChannel(channelId);
  }

  @MessagePattern({ cmd: VideoCommands.FIND_RECOMMENDED_VIDEOS })
  async findRecommendedVideos(@Payload() limit?: number) {
    return this.videoService.findRecommended(limit);
  }

  @MessagePattern({ cmd: VideoCommands.FIND_TRENDING_VIDEOS })
  async findTrendingVideos(@Payload() limit?: number) {
    return this.videoService.findTrending(limit);
  }

  @MessagePattern({ cmd: VideoCommands.UPDATE_VIDEO })
  async updateVideo(
    @Payload() payload: { id: string; updateVideoDto: UpdateVideoDto }
  ) {
    return this.videoService.update(payload.id, payload.updateVideoDto);
  }

  @MessagePattern({ cmd: VideoCommands.INCREMENT_VIEW_COUNT })
  async incrementViewCount(@Payload() id: string) {
    return this.videoService.incrementViewCount(id);
  }

  @MessagePattern({ cmd: VideoCommands.INCREMENT_LIKE_COUNT })
  async incrementLikeCount(@Payload() id: string) {
    return this.videoService.incrementLikeCount(id);
  }

  @MessagePattern({ cmd: VideoCommands.DECREMENT_LIKE_COUNT })
  async decrementLikeCount(@Payload() id: string) {
    return this.videoService.decrementLikeCount(id);
  }

  @MessagePattern({ cmd: VideoCommands.DELETE_VIDEO })
  async deleteVideo(@Payload() id: string) {
    return this.videoService.remove(id);
  }

  // Subscription endpoints
  @MessagePattern({ cmd: VideoCommands.SUBSCRIBE_TO_CHANNEL })
  async subscribeToChannel(
    @Payload() createSubscriptionDto: CreateChannelSubscriptionDto
  ) {
    return this.subscriptionService.subscribe(createSubscriptionDto);
  }

  @MessagePattern({ cmd: VideoCommands.UNSUBSCRIBE_FROM_CHANNEL })
  async unsubscribeFromChannel(
    @Payload() payload: { channelId: string; userId: string }
  ) {
    return this.subscriptionService.unsubscribe(
      payload.channelId,
      payload.userId
    );
  }

  @MessagePattern({ cmd: VideoCommands.FIND_USER_SUBSCRIPTIONS })
  async findUserSubscriptions(@Payload() userId: string) {
    return this.subscriptionService.findUserSubscriptions(userId);
  }

  @MessagePattern({ cmd: VideoCommands.FIND_CHANNEL_SUBSCRIBERS })
  async findChannelSubscribers(@Payload() channelId: string) {
    return this.subscriptionService.findChannelSubscribers(channelId);
  }

  // Video view endpoints
  @MessagePattern({ cmd: VideoCommands.RECORD_VIDEO_VIEW })
  async recordVideoView(
    @Payload() payload: { dto: RecordVideoViewDto; ipAddress?: string }
  ) {
    return this.videoViewService.recordView(payload.dto, payload.ipAddress);
  }

  @MessagePattern({ cmd: VideoCommands.FIND_VIDEO_VIEWS })
  async findVideoViews(@Payload() videoId: string) {
    return this.videoViewService.findVideoViews(videoId);
  }
}
