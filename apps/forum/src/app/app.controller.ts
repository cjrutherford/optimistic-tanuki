import {
  ForumAccessService,
  ForumActor,
} from './services/forum-access.service';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  TopicCommands,
  ThreadCommands,
  ForumPostCommands,
  ForumModerationCommands,
  ForumCommands,
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
import { ForumModerationService } from './services/forum-moderation.service';
import { FindManyOptions } from 'typeorm';
import { ForumPost, ForumReport, Thread, Topic } from '../entities';
import { ForumSeedService } from './services/forum-seed.service';

@Controller()
export class AppController {
  constructor(
    private readonly topicService: TopicService,
    private readonly threadService: ThreadService,
    private readonly forumPostService: ForumPostService,
    private readonly forumModerationService: ForumModerationService,
    private readonly forumSeedService: ForumSeedService,
    private readonly access: ForumAccessService
  ) {}

  @MessagePattern({ cmd: ForumCommands.SEED_DEMO_TOPICS })
  async seedDemoTopics() {
    return await this.forumSeedService.seedDemoTopics();
  }

  @MessagePattern({ cmd: ForumCommands.SEED_PRODUCTION_TOPICS })
  async seedProductionTopics() {
    return await this.forumSeedService.seedProductionTopics();
  }

  // Topic endpoints
  @MessagePattern({ cmd: TopicCommands.CREATE })
  async createTopic(@Payload() data: CreateTopicDto) {
    return await this.topicService.create(data);
  }

  @MessagePattern({ cmd: TopicCommands.FIND_MANY })
  async findAllTopics(@Payload() options?: FindManyOptions<Topic>) {
    return await this.access.list('topic', options);
  }

  @MessagePattern({ cmd: TopicCommands.FIND })
  async findOneTopic(@Payload() data: { id: string } & ForumActor) {
    return this.access.read('topic', data.id, data);
  }

  @MessagePattern({ cmd: TopicCommands.UPDATE })
  async updateTopic(
    @Payload() data: { id: string; data: UpdateTopicDto } & ForumActor
  ) {
    await this.access.owner('topic', data.id, data);
    return this.topicService.update(data.id, data.data);
  }

  @MessagePattern({ cmd: TopicCommands.DELETE })
  async removeTopic(@Payload() data: { id: string } & ForumActor) {
    await this.access.owner('topic', data.id, data);
    return this.topicService.remove(data.id);
  }

  @MessagePattern({ cmd: ThreadCommands.CREATE })
  async createThread(@Payload() data: CreateThreadDto) {
    await this.access.parent('topic', data.topicId, data);
    return await this.threadService.create(data);
  }

  @MessagePattern({ cmd: ThreadCommands.FIND_MANY })
  async findAllThreads(@Payload() options?: FindManyOptions<Thread>) {
    return await this.access.list('thread', options);
  }

  @MessagePattern({ cmd: ThreadCommands.FIND })
  async findOneThread(@Payload() data: { id: string } & ForumActor) {
    return this.access.read('thread', data.id, data, true);
  }

  @MessagePattern({ cmd: ThreadCommands.UPDATE })
  async updateThread(
    @Payload() data: { id: string; data: UpdateThreadDto } & ForumActor
  ) {
    await this.access.owner('thread', data.id, data);
    return this.threadService.update(data.id, data.data);
  }

  @MessagePattern({ cmd: ThreadCommands.DELETE })
  async removeThread(@Payload() data: { id: string } & ForumActor) {
    await this.access.owner('thread', data.id, data);
    return this.threadService.remove(data.id);
  }

  @MessagePattern({ cmd: ForumPostCommands.CREATE })
  async createForumPost(@Payload() data: CreateForumPostDto) {
    await this.access.parent('thread', data.threadId, data);
    return await this.forumPostService.create(data);
  }

  @MessagePattern({ cmd: ForumPostCommands.FIND_MANY })
  async findAllForumPosts(@Payload() options?: FindManyOptions<ForumPost>) {
    return await this.access.list('post', options);
  }

  @MessagePattern({ cmd: ForumPostCommands.FIND })
  async findOneForumPost(@Payload() data: { id: string } & ForumActor) {
    return this.access.read('post', data.id, data);
  }

  @MessagePattern({ cmd: ForumPostCommands.FIND_ASSET_AUDIENCES })
  async findAssetAudienceReferences(@Payload('assetId') assetId: string) {
    return this.access.findAssetAudienceReferences(assetId);
  }

  @MessagePattern({ cmd: ForumPostCommands.UPDATE })
  async updateForumPost(
    @Payload() data: { id: string; data: UpdateForumPostDto } & ForumActor
  ) {
    await this.access.owner('post', data.id, data);
    return this.forumPostService.update(data.id, data.data);
  }

  @MessagePattern({ cmd: ForumPostCommands.DELETE })
  async removeForumPost(@Payload() data: { id: string } & ForumActor) {
    await this.access.owner('post', data.id, data);
    return this.forumPostService.remove(data.id);
  }

  @MessagePattern({ cmd: ForumModerationCommands.REPORT_CONTENT })
  async reportForumContent(
    @Payload()
    data: {
      reporterId: string;
      contentType: 'thread' | 'post';
      contentId: string;
      reason: string;
      description?: string;
    }
  ) {
    return await this.forumModerationService.reportContent(data);
  }

  @MessagePattern({ cmd: ForumModerationCommands.GET_ALL_REPORTS })
  async getAllForumReports(): Promise<ForumReport[]> {
    return await this.forumModerationService.getAllReports();
  }

  @MessagePattern({ cmd: ForumModerationCommands.UPDATE_REPORT_STATUS })
  async updateForumReportStatus(
    @Payload('id') id: string,
    @Payload('status')
    status: 'pending' | 'reviewed' | 'actioned' | 'dismissed',
    @Payload('adminNotes') adminNotes?: string
  ) {
    return await this.forumModerationService.updateReportStatus(
      id,
      status,
      adminNotes
    );
  }

  @MessagePattern({ cmd: ForumModerationCommands.MODERATE_THREAD })
  async moderateForumThread(
    @Payload('id') id: string,
    @Payload('moderationStatus') moderationStatus: 'visible' | 'hidden',
    @Payload('moderatedBy') moderatedBy: string,
    @Payload('adminNotes') adminNotes?: string
  ) {
    return await this.forumModerationService.moderateThread(
      id,
      moderationStatus,
      moderatedBy,
      adminNotes
    );
  }

  @MessagePattern({ cmd: ForumModerationCommands.MODERATE_POST })
  async moderateForumPost(
    @Payload('id') id: string,
    @Payload('moderationStatus') moderationStatus: 'visible' | 'hidden',
    @Payload('moderatedBy') moderatedBy: string,
    @Payload('adminNotes') adminNotes?: string
  ) {
    return await this.forumModerationService.moderatePost(
      id,
      moderationStatus,
      moderatedBy,
      adminNotes
    );
  }
}
