import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  TopicCommands,
  ThreadCommands,
  ForumPostCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateTopicDto,
  UpdateTopicDto,
  CreateThreadDto,
  UpdateThreadDto,
  CreateForumPostDto,
  UpdateForumPostDto,
} from '@optimistic-tanuki/models';
import { TopicService } from './services/topic.service';
import { ThreadService } from './services/thread.service';
import { ForumPostService } from './services/forum-post.service';

@Controller()
export class AppController {
  constructor(
    private readonly topicService: TopicService,
    private readonly threadService: ThreadService,
    private readonly forumPostService: ForumPostService
  ) {}

  // Topic endpoints
  @MessagePattern({ cmd: TopicCommands.CREATE })
  async createTopic(@Payload() data: CreateTopicDto) {
    return await this.topicService.create(data);
  }

  @MessagePattern({ cmd: TopicCommands.FIND_MANY })
  async findAllTopics(@Payload() options?: any) {
    return await this.topicService.findAll(options);
  }

  @MessagePattern({ cmd: TopicCommands.FIND })
  async findOneTopic(@Payload('id') id: string) {
    return await this.topicService.findOne(id);
  }

  @MessagePattern({ cmd: TopicCommands.UPDATE })
  async updateTopic(
    @Payload('id') id: string,
    @Payload('data') data: UpdateTopicDto
  ) {
    return await this.topicService.update(id, data);
  }

  @MessagePattern({ cmd: TopicCommands.DELETE })
  async removeTopic(@Payload('id') id: string) {
    return await this.topicService.remove(id);
  }

  // Thread endpoints
  @MessagePattern({ cmd: ThreadCommands.CREATE })
  async createThread(@Payload() data: CreateThreadDto) {
    return await this.threadService.create(data);
  }

  @MessagePattern({ cmd: ThreadCommands.FIND_MANY })
  async findAllThreads(@Payload() options?: any) {
    return await this.threadService.findAll(options);
  }

  @MessagePattern({ cmd: ThreadCommands.FIND })
  async findOneThread(@Payload('id') id: string) {
    return await this.threadService.findOne(id);
  }

  @MessagePattern({ cmd: ThreadCommands.UPDATE })
  async updateThread(
    @Payload('id') id: string,
    @Payload('data') data: UpdateThreadDto
  ) {
    return await this.threadService.update(id, data);
  }

  @MessagePattern({ cmd: ThreadCommands.DELETE })
  async removeThread(@Payload('id') id: string) {
    return await this.threadService.remove(id);
  }

  // Forum Post endpoints
  @MessagePattern({ cmd: ForumPostCommands.CREATE })
  async createForumPost(@Payload() data: CreateForumPostDto) {
    return await this.forumPostService.create(data);
  }

  @MessagePattern({ cmd: ForumPostCommands.FIND_MANY })
  async findAllForumPosts(@Payload() options?: any) {
    return await this.forumPostService.findAll(options);
  }

  @MessagePattern({ cmd: ForumPostCommands.FIND })
  async findOneForumPost(@Payload('id') id: string) {
    return await this.forumPostService.findOne(id);
  }

  @MessagePattern({ cmd: ForumPostCommands.UPDATE })
  async updateForumPost(
    @Payload('id') id: string,
    @Payload('data') data: UpdateForumPostDto
  ) {
    return await this.forumPostService.update(id, data);
  }

  @MessagePattern({ cmd: ForumPostCommands.DELETE })
  async removeForumPost(@Payload('id') id: string) {
    return await this.forumPostService.remove(id);
  }
}
