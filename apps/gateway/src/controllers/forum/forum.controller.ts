import {
  Body,
  Controller,
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
import { User } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('forum')
@Controller('forum')
export class ForumController {
  private readonly logger = new Logger(ForumController.name);

  constructor(
    @Inject(ServiceTokens.FORUM_SERVICE)
    private readonly forumClient: ClientProxy
  ) { }

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
  async createTopic(@User() user, @Body() topicDto: CreateTopicDto) {
    this.logger.log(`Creating topic for user: ${user.userId}`);
    topicDto.userId = user.userId;
    return await firstValueFrom(
      this.forumClient.send({ cmd: TopicCommands.CREATE }, topicDto)
    );
  }

  @ApiTags('topic')
  @ApiOperation({ summary: 'Get a topic by ID' })
  @ApiResponse({
    status: 200,
    description: 'The topic has been successfully retrieved.',
    type: TopicDto,
  })
  @Get('topic/:id')
  async getTopic(@Param('id') id: string): Promise<TopicDto> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: TopicCommands.FIND }, { id })
    );
  }

  @Get('topic/:topicId/threads')
  @ApiTags('topic')
  @ApiOperation({ summary: 'Get all threads for a topic' })
  @ApiResponse({
    status: 200,
    description: 'The threads have been successfully retrieved.',
    type: [ThreadDto],
  })
  async getThreadsByTopic(
    @Param('topicId') topicId: string
  ): Promise<ThreadDto[]> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: ThreadCommands.FIND_MANY }, { where: { topicId } })
    );
  }

  @ApiTags('topic')
  @ApiOperation({ summary: 'Get all topics' })
  @ApiResponse({
    status: 200,
    description: 'The topics have been successfully retrieved.',
    type: [TopicDto],
  })
  @Get('topics')
  async getAllTopics(): Promise<TopicDto[]> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: TopicCommands.FIND_MANY }, {})
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
    @Body() updateTopicDto: UpdateTopicDto
  ): Promise<TopicDto> {
    return await firstValueFrom(
      this.forumClient.send(
        { cmd: TopicCommands.UPDATE },
        { id, data: updateTopicDto }
      )
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
  async deleteTopic(@Param('id') id: string): Promise<void> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: TopicCommands.DELETE }, { id })
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
  async createThread(@User() user, @Body() threadDto: CreateThreadDto) {
    this.logger.log(`Creating thread for user: ${user.userId}`);
    threadDto.userId = user.userId;
    return await firstValueFrom(
      this.forumClient.send({ cmd: ThreadCommands.CREATE }, threadDto)
    );
  }

  @ApiTags('thread')
  @ApiOperation({ summary: 'Get a thread by ID' })
  @ApiResponse({
    status: 200,
    description: 'The thread has been successfully retrieved.',
    type: ThreadDto,
  })
  @Get('thread/:id')
  async getThread(@Param('id') id: string): Promise<ThreadDto> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: ThreadCommands.FIND }, { id })
    );
  }

  @ApiTags('thread')
  @ApiOperation({ summary: 'Get posts for a thread' })
  @ApiResponse({
    status: 200,
    description: 'The posts have been successfully retrieved.',
    type: [ForumPostDto],
  })
  @Get('thread/:threadId/posts')
  async getPostsByThread(
    @Param('threadId') threadId: string
  ): Promise<ForumPostDto[]> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: ForumPostCommands.FIND_MANY }, { where: { threadId } })
    );
  }

  @ApiTags('thread')
  @ApiOperation({ summary: 'Get all threads' })
  @ApiResponse({
    status: 200,
    description: 'The threads have been successfully retrieved.',
    type: [ThreadDto],
  })
  @Get('threads')
  async getAllThreads(): Promise<ThreadDto[]> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: ThreadCommands.FIND_MANY }, {})
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
    @Body() updateThreadDto: UpdateThreadDto
  ): Promise<ThreadDto> {
    return await firstValueFrom(
      this.forumClient.send(
        { cmd: ThreadCommands.UPDATE },
        { id, data: updateThreadDto }
      )
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
  async deleteThread(@Param('id') id: string): Promise<void> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: ThreadCommands.DELETE }, { id })
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
  async createForumPost(@User() user, @Body() postDto: CreateForumPostDto) {
    this.logger.log(`Creating forum post for user: ${user.userId}`);
    postDto.userId = user.userId;
    return await firstValueFrom(
      this.forumClient.send({ cmd: ForumPostCommands.CREATE }, postDto)
    );
  }

  @ApiTags('forum-post')
  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiResponse({
    status: 200,
    description: 'The post has been successfully retrieved.',
    type: ForumPostDto,
  })
  @Get('post/:id')
  async getForumPost(@Param('id') id: string): Promise<ForumPostDto> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: ForumPostCommands.FIND }, { id })
    );
  }

  @ApiTags('forum-post')
  @ApiOperation({ summary: 'Get all posts' })
  @ApiResponse({
    status: 200,
    description: 'The posts have been successfully retrieved.',
    type: [ForumPostDto],
  })
  @Get('posts')
  async getAllForumPosts(): Promise<ForumPostDto[]> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: ForumPostCommands.FIND_MANY }, {})
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
    @Body() updatePostDto: UpdateForumPostDto
  ): Promise<ForumPostDto> {
    return await firstValueFrom(
      this.forumClient.send(
        { cmd: ForumPostCommands.UPDATE },
        { id, data: updatePostDto }
      )
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
  async deleteForumPost(@Param('id') id: string): Promise<void> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: ForumPostCommands.DELETE }, { id })
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
  @Get('search/topics')
  async searchTopics(@Query() query: Partial<TopicDto>): Promise<TopicDto[]> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: TopicCommands.FIND_MANY }, { where:  query })
    );
  }

  @ApiTags('search')
  @ApiOperation({ summary: 'Search threads by query' })
  @ApiResponse({
    status: 200,
    description: 'The search results have been successfully retrieved.',
    type: [ThreadDto],
  })
  @Get('search/threads')
  async searchThreads(@Query() query: Partial<ThreadDto>): Promise<ThreadDto[]> {
    return await firstValueFrom(
      this.forumClient.send({ cmd: ThreadCommands.FIND_MANY }, { where: query })
    );
  }

}
