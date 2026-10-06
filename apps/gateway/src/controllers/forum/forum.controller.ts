import {
  Body,
  BadRequestException,
  Controller,
  HttpException,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ServiceTokens,
  TopicCommands,
  ThreadCommands,
  ForumPostCommands,
  ForumModerationCommands,
} from '@optimistic-tanuki/constants';
import {
  TopicDto,
  CreateTopicDto,
  UpdateTopicDto,
  ThreadDto,
  CreateThreadDto,
  UpdateThreadDto,
  ForumPostDto,
  CreateForumPostDto,
  UpdateForumPostDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { AppScope } from '../../decorators/appscope.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { Public } from '../../decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

interface ReportForumContentDto {
  contentType: 'thread' | 'post';
  contentId: string;
  reason: string;
  description?: string;
}

interface UpdateForumReportStatusDto {
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  adminNotes?: string;
}

interface ModerateForumContentDto {
  moderationStatus: 'visible' | 'hidden';
  adminNotes?: string;
}

@ApiTags('forum')
@Controller('forum')
export class ForumController {
  private readonly logger = new Logger(ForumController.name);

  constructor(
    @Inject(ServiceTokens.FORUM_SERVICE)
    private readonly forumClient: ClientProxy
  ) {}

  private async forward(
    pattern: { cmd: string },
    payload: unknown
  ): Promise<any> {
    try {
      return await firstValueFrom(this.forumClient.send(pattern, payload));
    } catch (error) {
      throw new HttpException(
        { message: error?.message ?? 'Discussion unavailable' },
        error?.statusCode ?? 503
      );
    }
  }

  private requireAppScope(appScope: string | null): string {
    if (!appScope) {
      throw new BadRequestException('x-ot-appscope header is required');
    }

    return appScope;
  }

  // Topic endpoints
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('topic')
  @ApiOperation({ summary: 'Create a new topic' })
  @ApiResponse({
    status: 201,
    description: 'The topic has been successfully created.',
    type: TopicDto,
  })
  @Post('topic')
  @RequirePermissions('forum.topic.create')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createTopic(
    @User() user,
    @Body() topicDto: CreateTopicDto,
    @AppScope() appScope: string
  ) {
    this.logger.log(`Creating topic for user: ${user.userId}`);
    topicDto.userId = user.userId;
    topicDto.profileId = user.profileId;
    topicDto.appScope = this.requireAppScope(appScope);
    return await this.forward({ cmd: TopicCommands.CREATE }, topicDto);
  }

  @ApiTags('topic')
  @ApiOperation({ summary: 'Get a topic by ID' })
  @ApiResponse({
    status: 200,
    description: 'The topic has been successfully retrieved.',
    type: TopicDto,
  })
  @Public()
  @UseGuards(AuthGuard)
  @Get('topic/:id')
  async getTopic(
    @Param('id') id: string,
    @AppScope() appScope: string,
    @User() user?: UserDetails
  ): Promise<TopicDto> {
    appScope = this.requireAppScope(appScope);
    return await this.forward(
      { cmd: TopicCommands.FIND },
      { id, appScope, requestingProfileId: user?.profileId }
    );
  }

  @Public()
  @UseGuards(AuthGuard)
  @Get('topic/:topicId/threads')
  @ApiTags('topic')
  @ApiOperation({ summary: 'Get all threads for a topic' })
  @ApiResponse({
    status: 200,
    description: 'The threads have been successfully retrieved.',
    type: [ThreadDto],
  })
  async getThreadsByTopic(
    @Param('topicId') topicId: string,
    @AppScope() appScope: string,
    @User() user?: UserDetails
  ): Promise<ThreadDto[]> {
    appScope = this.requireAppScope(appScope);
    return await this.forward(
      { cmd: ThreadCommands.FIND_MANY },
      { where: { topicId, appScope }, requestingProfileId: user?.profileId }
    );
  }

  @ApiTags('topic')
  @ApiOperation({ summary: 'Get all topics' })
  @ApiResponse({
    status: 200,
    description: 'The topics have been successfully retrieved.',
    type: [TopicDto],
  })
  @Public()
  @UseGuards(AuthGuard)
  @Get('topics')
  async getAllTopics(
    @AppScope() appScope: string,
    @User() user?: UserDetails
  ): Promise<TopicDto[]> {
    appScope = this.requireAppScope(appScope);
    return await this.forward(
      { cmd: TopicCommands.FIND_MANY },
      { where: { appScope }, requestingProfileId: user?.profileId }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('topic')
  @ApiOperation({ summary: 'Update a topic by ID' })
  @ApiResponse({
    status: 200,
    description: 'The topic has been successfully updated.',
    type: TopicDto,
  })
  @Put('topic/:id')
  @RequirePermissions('forum.topic.update')
  async updateTopic(
    @Param('id') id: string,
    @Body() updateTopicDto: UpdateTopicDto,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<TopicDto> {
    return await this.forward(
      { cmd: TopicCommands.UPDATE },
      {
        id,
        data: updateTopicDto,
        userId: user.userId,
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('topic')
  @ApiOperation({ summary: 'Delete a topic by ID' })
  @ApiResponse({
    status: 200,
    description: 'The topic has been successfully deleted.',
  })
  @Delete('topic/:id')
  @RequirePermissions('forum.topic.delete')
  async deleteTopic(
    @Param('id') id: string,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<void> {
    return await this.forward(
      { cmd: TopicCommands.DELETE },
      {
        id,
        userId: user.userId,
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
      }
    );
  }

  // Thread endpoints
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('thread')
  @ApiOperation({ summary: 'Create a new thread' })
  @ApiResponse({
    status: 201,
    description: 'The thread has been successfully created.',
    type: ThreadDto,
  })
  @Post('thread')
  @RequirePermissions('forum.thread.create')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createThread(
    @User() user,
    @Body() threadDto: CreateThreadDto,
    @AppScope() appScope: string
  ) {
    this.logger.log(`Creating thread for user: ${user.userId}`);
    threadDto.userId = user.userId;
    threadDto.profileId = user.profileId;
    threadDto.appScope = this.requireAppScope(appScope);
    return await this.forward({ cmd: ThreadCommands.CREATE }, threadDto);
  }

  @ApiTags('thread')
  @ApiOperation({ summary: 'Get a thread by ID' })
  @ApiResponse({
    status: 200,
    description: 'The thread has been successfully retrieved.',
    type: ThreadDto,
  })
  @Public()
  @UseGuards(AuthGuard)
  @Get('thread/:id')
  async getThread(
    @Param('id') id: string,
    @AppScope() appScope: string,
    @User() user?: UserDetails
  ): Promise<ThreadDto> {
    appScope = this.requireAppScope(appScope);
    return await this.forward(
      { cmd: ThreadCommands.FIND },
      { id, appScope, requestingProfileId: user?.profileId }
    );
  }

  @ApiTags('thread')
  @ApiOperation({ summary: 'Get posts for a thread' })
  @ApiResponse({
    status: 200,
    description: 'The posts have been successfully retrieved.',
    type: [ForumPostDto],
  })
  @Public()
  @UseGuards(AuthGuard)
  @Get('thread/:threadId/posts')
  async getPostsByThread(
    @Param('threadId') threadId: string,
    @AppScope() appScope: string,
    @User() user?: UserDetails
  ): Promise<ForumPostDto[]> {
    appScope = this.requireAppScope(appScope);
    return await this.forward(
      { cmd: ForumPostCommands.FIND_MANY },
      { where: { threadId, appScope }, requestingProfileId: user?.profileId }
    );
  }

  @ApiTags('thread')
  @ApiOperation({ summary: 'Get all threads' })
  @ApiResponse({
    status: 200,
    description: 'The threads have been successfully retrieved.',
    type: [ThreadDto],
  })
  @Public()
  @UseGuards(AuthGuard)
  @Get('threads')
  async getAllThreads(
    @AppScope() appScope: string,
    @User() user?: UserDetails
  ): Promise<ThreadDto[]> {
    return await this.forward(
      { cmd: ThreadCommands.FIND_MANY },
      {
        where: { appScope: this.requireAppScope(appScope) },
        requestingProfileId: user?.profileId,
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('thread')
  @ApiOperation({ summary: 'Update a thread by ID' })
  @ApiResponse({
    status: 200,
    description: 'The thread has been successfully updated.',
    type: ThreadDto,
  })
  @Put('thread/:id')
  @RequirePermissions('forum.thread.update')
  async updateThread(
    @Param('id') id: string,
    @Body() updateThreadDto: UpdateThreadDto,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<ThreadDto> {
    return await this.forward(
      { cmd: ThreadCommands.UPDATE },
      {
        id,
        data: updateThreadDto,
        userId: user.userId,
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('thread')
  @ApiOperation({ summary: 'Delete a thread by ID' })
  @ApiResponse({
    status: 200,
    description: 'The thread has been successfully deleted.',
  })
  @Delete('thread/:id')
  @RequirePermissions('forum.thread.delete')
  async deleteThread(
    @Param('id') id: string,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<void> {
    return await this.forward(
      { cmd: ThreadCommands.DELETE },
      {
        id,
        userId: user.userId,
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
      }
    );
  }

  // Forum Post endpoints
  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('forum-post')
  @ApiOperation({ summary: 'Create a new forum post' })
  @ApiResponse({
    status: 201,
    description: 'The post has been successfully created.',
    type: ForumPostDto,
  })
  @Post('post')
  @RequirePermissions('forum.post.create')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  async createForumPost(
    @User() user,
    @Body() postDto: CreateForumPostDto,
    @AppScope() appScope: string
  ) {
    this.logger.log(`Creating forum post for user: ${user.userId}`);
    postDto.userId = user.userId;
    postDto.profileId = user.profileId;
    postDto.appScope = this.requireAppScope(appScope);
    return await this.forward({ cmd: ForumPostCommands.CREATE }, postDto);
  }

  @ApiTags('forum-post')
  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiResponse({
    status: 200,
    description: 'The post has been successfully retrieved.',
    type: ForumPostDto,
  })
  @Public()
  @UseGuards(AuthGuard)
  @Get('post/:id')
  async getForumPost(
    @Param('id') id: string,
    @AppScope() appScope: string,
    @User() user?: UserDetails
  ): Promise<ForumPostDto> {
    return await this.forward(
      { cmd: ForumPostCommands.FIND },
      {
        id,
        appScope: this.requireAppScope(appScope),
        requestingProfileId: user?.profileId,
      }
    );
  }

  @ApiTags('forum-post')
  @ApiOperation({ summary: 'Get all posts' })
  @ApiResponse({
    status: 200,
    description: 'The posts have been successfully retrieved.',
    type: [ForumPostDto],
  })
  @Public()
  @UseGuards(AuthGuard)
  @Get('posts')
  async getAllForumPosts(
    @AppScope() appScope: string,
    @User() user?: UserDetails
  ): Promise<ForumPostDto[]> {
    return await this.forward(
      { cmd: ForumPostCommands.FIND_MANY },
      {
        where: { appScope: this.requireAppScope(appScope) },
        requestingProfileId: user?.profileId,
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('forum-post')
  @ApiOperation({ summary: 'Update a post by ID' })
  @ApiResponse({
    status: 200,
    description: 'The post has been successfully updated.',
    type: ForumPostDto,
  })
  @Put('post/:id')
  @RequirePermissions('forum.post.update')
  async updateForumPost(
    @Param('id') id: string,
    @Body() updatePostDto: UpdateForumPostDto,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<ForumPostDto> {
    return await this.forward(
      { cmd: ForumPostCommands.UPDATE },
      {
        id,
        data: updatePostDto,
        userId: user.userId,
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('forum-post')
  @ApiOperation({ summary: 'Delete a post by ID' })
  @ApiResponse({
    status: 200,
    description: 'The post has been successfully deleted.',
  })
  @Delete('post/:id')
  @RequirePermissions('forum.post.delete')
  async deleteForumPost(
    @Param('id') id: string,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ): Promise<void> {
    return await this.forward(
      { cmd: ForumPostCommands.DELETE },
      {
        id,
        userId: user.userId,
        profileId: user.profileId,
        appScope: this.requireAppScope(appScope),
      }
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('forum-moderation')
  @ApiOperation({ summary: 'Report forum content for moderation review' })
  @Post('report')
  async reportForumContent(
    @Body() dto: ReportForumContentDto,
    @User() user: UserDetails
  ) {
    return await this.forward(
      { cmd: ForumModerationCommands.REPORT_CONTENT },
      {
        reporterId: user.profileId,
        contentType: dto.contentType,
        contentId: dto.contentId,
        reason: dto.reason,
        description: dto.description,
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('forum-moderation')
  @ApiOperation({ summary: 'Get all forum moderation reports' })
  @Get('admin/reports')
  @RequirePermissions('community.manage')
  async getForumReports() {
    return await this.forward(
      { cmd: ForumModerationCommands.GET_ALL_REPORTS },
      {}
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('forum-moderation')
  @ApiOperation({ summary: 'Update a forum moderation report status' })
  @Put('admin/reports/:id')
  @RequirePermissions('community.manage')
  async updateForumReportStatus(
    @Param('id') id: string,
    @Body() dto: UpdateForumReportStatusDto
  ) {
    return await this.forward(
      { cmd: ForumModerationCommands.UPDATE_REPORT_STATUS },
      {
        id,
        status: dto.status,
        adminNotes: dto.adminNotes,
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('forum-moderation')
  @ApiOperation({ summary: 'Soft moderate a forum thread' })
  @Put('admin/thread/:id/moderation')
  @RequirePermissions('community.manage')
  async moderateForumThread(
    @Param('id') id: string,
    @Body() dto: ModerateForumContentDto,
    @User() user: UserDetails
  ) {
    return await this.forward(
      { cmd: ForumModerationCommands.MODERATE_THREAD },
      {
        id,
        moderationStatus: dto.moderationStatus,
        adminNotes: dto.adminNotes,
        moderatedBy: user.profileId,
      }
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @ApiTags('forum-moderation')
  @ApiOperation({ summary: 'Soft moderate a forum post' })
  @Put('admin/post/:id/moderation')
  @RequirePermissions('community.manage')
  async moderateForumPost(
    @Param('id') id: string,
    @Body() dto: ModerateForumContentDto,
    @User() user: UserDetails
  ) {
    return await this.forward(
      { cmd: ForumModerationCommands.MODERATE_POST },
      {
        id,
        moderationStatus: dto.moderationStatus,
        adminNotes: dto.adminNotes,
        moderatedBy: user.profileId,
      }
    );
  }

  // Search Routes.

  @ApiTags('search')
  @ApiOperation({ summary: 'Search topics by query' })
  @ApiResponse({
    status: 200,
    description: 'The search results have been successfully retrieved.',
    type: [TopicDto],
  })
  @Public()
  @UseGuards(AuthGuard)
  @Get('search/topics')
  async searchTopics(
    @Query() query: Partial<TopicDto>,
    @AppScope() appScope: string,
    @User() user?: UserDetails
  ): Promise<TopicDto[]> {
    return await this.forward(
      { cmd: TopicCommands.FIND_MANY },
      {
        where: {
          ...(query.title ? { title: query.title } : {}),
          appScope: this.requireAppScope(appScope),
        },
        requestingProfileId: user?.profileId,
      }
    );
  }

  @ApiTags('search')
  @ApiOperation({ summary: 'Search threads by query' })
  @ApiResponse({
    status: 200,
    description: 'The search results have been successfully retrieved.',
    type: [ThreadDto],
  })
  @Public()
  @UseGuards(AuthGuard)
  @Get('search/threads')
  async searchThreads(
    @Query() query: Partial<ThreadDto>,
    @AppScope() appScope: string,
    @User() user?: UserDetails
  ): Promise<ThreadDto[]> {
    return await this.forward(
      { cmd: ThreadCommands.FIND_MANY },
      {
        where: {
          ...(query.title ? { title: query.title } : {}),
          appScope: this.requireAppScope(appScope),
        },
        requestingProfileId: user?.profileId,
      }
    );
  }
}
