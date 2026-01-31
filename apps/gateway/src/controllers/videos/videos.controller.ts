import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { VideoCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CreateChannelDto,
  UpdateChannelDto,
  CreateVideoDto,
  UpdateVideoDto,
  CreateChannelSubscriptionDto,
  RecordVideoViewDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';

@Controller('videos')
export class VideosController {
  constructor(
    @Inject(ServiceTokens.VIDEOS_SERVICE)
    private readonly videosService: ClientProxy
  ) {}

  // ===== Channel Endpoints =====

  @RequirePermissions('videos.channel.create')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('channels')
  async createChannel(@Body() createChannelDto: CreateChannelDto) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.CREATE_CHANNEL },
        createChannelDto
      )
    );
  }

  @Public()
  @Get('channels')
  async findAllChannels() {
    return await firstValueFrom(
      this.videosService.send({ cmd: VideoCommands.FIND_ALL_CHANNELS }, {})
    );
  }

  @Public()
  @Get('channels/:id')
  async findOneChannel(@Param('id') id: string) {
    return await firstValueFrom(
      this.videosService.send({ cmd: VideoCommands.FIND_ONE_CHANNEL }, id)
    );
  }

  @UseGuards(AuthGuard)
  @Get('channels/user/:userId')
  async findChannelsByUser(@Param('userId') userId: string) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.FIND_CHANNELS_BY_USER },
        userId
      )
    );
  }

  @RequirePermissions('videos.channel.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put('channels/:id')
  async updateChannel(
    @Param('id') id: string,
    @Body() updateChannelDto: UpdateChannelDto
  ) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.UPDATE_CHANNEL },
        { id, updateChannelDto }
      )
    );
  }

  @RequirePermissions('videos.channel.delete')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Delete('channels/:id')
  async deleteChannel(@Param('id') id: string) {
    return await firstValueFrom(
      this.videosService.send({ cmd: VideoCommands.DELETE_CHANNEL }, id)
    );
  }

  // ===== Video Endpoints =====

  @RequirePermissions('videos.video.create')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Post('/')
  async createVideo(@Body() createVideoDto: CreateVideoDto) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.CREATE_VIDEO },
        createVideoDto
      )
    );
  }

  @Public()
  @Get('/')
  async findAllVideos() {
    return await firstValueFrom(
      this.videosService.send({ cmd: VideoCommands.FIND_ALL_VIDEOS }, {})
    );
  }

  @Public()
  @Get('recommended')
  async findRecommendedVideos(@Query('limit') limit?: number) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.FIND_RECOMMENDED_VIDEOS },
        limit
      )
    );
  }

  @Public()
  @Get('trending')
  async findTrendingVideos(@Query('limit') limit?: number) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.FIND_TRENDING_VIDEOS },
        limit
      )
    );
  }

  @Public()
  @Get('channel/:channelId')
  async findVideosByChannel(@Param('channelId') channelId: string) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.FIND_VIDEOS_BY_CHANNEL },
        channelId
      )
    );
  }

  @Public()
  @Get(':id')
  async findOneVideo(@Param('id') id: string) {
    return await firstValueFrom(
      this.videosService.send({ cmd: VideoCommands.FIND_ONE_VIDEO }, id)
    );
  }

  @RequirePermissions('videos.video.update')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Put(':id')
  async updateVideo(
    @Param('id') id: string,
    @Body() updateVideoDto: UpdateVideoDto
  ) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.UPDATE_VIDEO },
        { id, updateVideoDto }
      )
    );
  }

  @Public()
  @Post(':id/view')
  async incrementViewCount(@Param('id') id: string) {
    return await firstValueFrom(
      this.videosService.send({ cmd: VideoCommands.INCREMENT_VIEW_COUNT }, id)
    );
  }

  @UseGuards(AuthGuard)
  @Post(':id/like')
  async incrementLikeCount(@Param('id') id: string) {
    return await firstValueFrom(
      this.videosService.send({ cmd: VideoCommands.INCREMENT_LIKE_COUNT }, id)
    );
  }

  @UseGuards(AuthGuard)
  @Delete(':id/like')
  async decrementLikeCount(@Param('id') id: string) {
    return await firstValueFrom(
      this.videosService.send({ cmd: VideoCommands.DECREMENT_LIKE_COUNT }, id)
    );
  }

  @RequirePermissions('videos.video.delete')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Delete(':id')
  async deleteVideo(@Param('id') id: string) {
    return await firstValueFrom(
      this.videosService.send({ cmd: VideoCommands.DELETE_VIDEO }, id)
    );
  }

  // ===== Subscription Endpoints =====

  @UseGuards(AuthGuard)
  @Post('subscriptions')
  async subscribeToChannel(
    @Body() createSubscriptionDto: CreateChannelSubscriptionDto
  ) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.SUBSCRIBE_TO_CHANNEL },
        createSubscriptionDto
      )
    );
  }

  @UseGuards(AuthGuard)
  @Delete('subscriptions/:channelId')
  async unsubscribeFromChannel(
    @Param('channelId') channelId: string,
    @Body() body: { userId: string }
  ) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.UNSUBSCRIBE_FROM_CHANNEL },
        { channelId, userId: body.userId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @Get('subscriptions/user/:userId')
  async findUserSubscriptions(@Param('userId') userId: string) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.FIND_USER_SUBSCRIPTIONS },
        userId
      )
    );
  }

  @Public()
  @Get('subscriptions/channel/:channelId')
  async findChannelSubscribers(@Param('channelId') channelId: string) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.FIND_CHANNEL_SUBSCRIBERS },
        channelId
      )
    );
  }

  // ===== Video View Endpoints =====

  @Public()
  @Post('views')
  async recordVideoView(@Body() recordVideoViewDto: RecordVideoViewDto) {
    return await firstValueFrom(
      this.videosService.send(
        { cmd: VideoCommands.RECORD_VIDEO_VIEW },
        { dto: recordVideoViewDto }
      )
    );
  }

  @Public()
  @Get('views/:videoId')
  async findVideoViews(@Param('videoId') videoId: string) {
    return await firstValueFrom(
      this.videosService.send({ cmd: VideoCommands.FIND_VIDEO_VIEWS }, videoId)
    );
  }
}
