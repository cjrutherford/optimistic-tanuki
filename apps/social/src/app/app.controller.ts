import { Controller, Get, Logger } from '@nestjs/common';

import { PostService } from './services/post.service';
import {
  AttachmentActor,
  AttachmentService,
} from './services/attachment.service';
import { CommentService } from './services/comment.service';
import { VoteService } from './services/vote.service';
import { ReactionService } from './services/reaction.service';
import { SocialComponentService } from './services/social-component.service';
import { CommunityService } from './services/community.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { ClientProxy } from '@nestjs/microservices';
import {
  AttachmentCommands,
  CommentCommands,
  LinkCommands,
  PostCommands,
  VoteCommands,
  ReactionCommands,
  FollowCommands,
  SocialComponentCommands,
  CommunityCommands,
  NotificationCommands,
  SearchCommands,
  PrivacyCommands,
  ActivityCommands,
  SavedItemCommands,
  PresenceCommands,
  ProfileAnalyticsCommands,
  PollCommands,
  PostShareCommands,
  SocialEventCommands as EventCommands,
  ScheduledPostCommands,
  ServiceTokens,
  ProfileCommands,
  GuardianContentCommands,
} from '@optimistic-tanuki/constants';
import { BusinessContentCommands } from '@optimistic-tanuki/social-contracts';
import {
  CreatePollDto,
  UpdatePollDto,
  VotePollDto,
  CreatePostShareDto,
  CreateEventDto,
  UpdateEventDto,
  EventStatus,
  CreateScheduledPostDto,
  UpdateScheduledPostDto,
  SocialComponentQueryDto,
  CreateCommunityDto,
  SearchCommunityDto,
  UpdateCommunityDto,
  JoinCommunityDto,
  InviteToCommunityDto,
  CommunityMemberRole,
  CreatePostDto,
  UpdatePostDto,
  SearchPostDto,
  SearchPostOptions,
  CreateCommentDto,
  UpdateCommentDto,
  SearchCommentDto,
  CreateAttachmentDto,
  UpdateAttachmentDto,
  SearchAttachmentDto,
  CreateLinkDto,
  UpdateLinkDto,
  CreateReactionDto,
  CreateSocialComponentDto,
  UpdateSocialComponentDto,
  QueryFollowsDto,
  UpdateFollowDto,
  CreateVoteDto,
} from '@optimistic-tanuki/models';
import { Post, postSearchDtoToFindManyOptions } from '../entities/post.entity';
import {
  PostVisibilityScope,
  applyVisiblePostScope,
  visiblePostWhere,
} from './common/post-visibility.util';
import { transformSearchCommentDtoToFindOptions } from '../entities/comment.entity';
import { Attachment, toFindOptions } from '../entities/attachment.entity';
import {
  FindManyOptions,
  FindOneOptions,
  FindOptions,
  FindOptionsWhere,
  In,
} from 'typeorm';
import FollowService from './services/follow.service';
import { NotificationService } from './services/notification.service';
import { SearchService } from './services/search.service';
import { PrivacyService } from './services/privacy.service';
import { ActivityService } from './services/activity.service';
import { PresenceService } from './services/presence.service';
import { PresenceStatus } from '../entities/user-presence.entity';
import { ProfileAnalyticsService } from './services/profile-analytics.service';
import { PollService } from './services/poll.service';
import { PostShareService } from './services/post-share.service';
import { EventService } from './services/event.service';
import { BusinessContentService } from './services/business-content.service';
import { LinkService } from './services/link.service';
import { GuardianContentService } from './services/guardian-content.service';
import { Optional } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';

interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: Date;
}

@Controller()
export class AppController {
  private readonly logger = new Logger('SocialAppController');
  constructor(
    private readonly postService: PostService,
    private readonly voteService: VoteService,
    private readonly reactionService: ReactionService,
    private readonly attachmentService: AttachmentService,
    private readonly commentService: CommentService,
    private readonly followService: FollowService,
    private readonly socialComponentService: SocialComponentService,
    private readonly communityService: CommunityService,
    private readonly notificationService: NotificationService,
    private readonly searchService: SearchService,
    private readonly privacyService: PrivacyService,
    private readonly activityService: ActivityService,
    private readonly presenceService: PresenceService,
    private readonly profileAnalyticsService: ProfileAnalyticsService,
    private readonly pollService: PollService,
    private readonly postShareService: PostShareService,
    private readonly eventService: EventService,
    private readonly linkService: LinkService,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    private readonly businessContentService: BusinessContentService,
    @Optional() private readonly guardianContentService?: GuardianContentService
  ) {}

  private guardianContent() {
    if (!this.guardianContentService)
      throw new RpcException('Guardian content service unavailable');
    return this.guardianContentService;
  }

  @MessagePattern({ cmd: GuardianContentCommands.ListPosts })
  listGuardianPosts(@Payload() data: any) {
    return this.guardianContent().listPosts(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.GetPost })
  getGuardianPost(@Payload() data: any) {
    return this.guardianContent().getPost(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.CreatePost })
  createGuardianPost(@Payload() data: any) {
    return this.guardianContent().createPost(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.UpdatePost })
  updateGuardianPost(@Payload() data: any) {
    return this.guardianContent().updatePost(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.DeletePost })
  deleteGuardianPost(@Payload() data: any) {
    return this.guardianContent().deletePost(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.ListComments })
  listGuardianComments(@Payload() data: any) {
    return this.guardianContent().listComments(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.GetComment })
  getGuardianComment(@Payload() data: any) {
    return this.guardianContent().getComment(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.CreateComment })
  createGuardianComment(@Payload() data: any) {
    return this.guardianContent().createComment(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.UpdateComment })
  updateGuardianComment(@Payload() data: any) {
    return this.guardianContent().updateComment(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.DeleteComment })
  deleteGuardianComment(@Payload() data: any) {
    return this.guardianContent().deleteComment(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.ResolvePublishedAssetGrant })
  resolvePublishedAssetGrant(@Payload() data: any) {
    return this.guardianContent().resolvePublishedAssetGrant(data);
  }

  @MessagePattern({ cmd: GuardianContentCommands.CheckPublishedAssetGrant })
  checkPublishedAssetGrant(@Payload() data: any) {
    return this.guardianContent().checkPublishedAssetGrant(data);
  }

  private async buildPostVisibilityScope(
    viewerProfileId: string
  ): Promise<PostVisibilityScope> {
    const [following, blocked, blockers, profile] = await Promise.all([
      this.followService.getFollowing(viewerProfileId),
      this.privacyService.getBlockedUsers(viewerProfileId),
      this.privacyService.getBlockersOf(viewerProfileId),
      firstValueFrom(
        this.profileClient
          .send({ cmd: ProfileCommands.Get }, { id: viewerProfileId })
          .pipe(timeout(3000))
      ).catch(() => null),
    ]);
    const accountId =
      profile?.id === viewerProfileId ? profile.userId : undefined;
    return {
      viewerProfileId,
      viewerAccountId: accountId,
      followedProfileIds: (following || []).map((f) => f.followeeId),
      blockedProfileIds: [
        ...(blocked || []).map((b) => b.blockedId),
        ...(blockers || []).map((b) => b.blockerId),
      ],
    };
  }

  private async buildAnonymousPostVisibilityScope(): Promise<PostVisibilityScope> {
    return {
      followedProfileIds: [],
      blockedProfileIds: [],
    };
  }

  private extractMentions(text: string): string[] {
    if (!text) return [];
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return [...new Set(mentions)];
  }

  private async processMentions(
    content: string,
    title: string,
    authorProfileId: string,
    postId: string
  ): Promise<void> {
    const textToParse = `${content || ''} ${title || ''}`;
    const mentionedNames = this.extractMentions(textToParse);

    if (mentionedNames.length === 0) return;

    this.logger.log(
      `Found mentions in post ${postId}: ${mentionedNames.join(', ')}`
    );

    for (const profileName of mentionedNames) {
      try {
        const profiles = await firstValueFrom(
          this.profileClient.send({ cmd: ProfileCommands.Get }, { profileName })
        );

        const profile = Array.isArray(profiles) ? profiles[0] : profiles;

        if (profile && profile.id && profile.id !== authorProfileId) {
          await this.notificationService.queueNotification({
            recipientId: profile.id,
            type: 'mention',
            title: 'You were mentioned',
            body: `Someone mentioned you in a post`,
            senderId: authorProfileId,
            resourceType: 'post',
            resourceId: postId,
            actionUrl: `/feed/post/${postId}`,
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to process mention ${profileName}:`, err);
      }
    }
  }

  @MessagePattern({ cmd: PostCommands.CREATE })
  async createPost(data: CreatePostDto) {
    const post = await this.postService.create(data);

    // Create activity log for post creation
    try {
      await this.activityService.createActivity({
        profileId: data.profileId,
        type: 'post' as any,
        description: 'You created a new post',
        resourceId: post.id,
        resourceType: 'post',
      });
    } catch (err) {
      this.logger.warn('Failed to create activity log for post:', err);
    }

    // Process mentions and send notifications
    this.processMentions(
      data.content,
      data.title,
      data.profileId,
      post.id
    ).catch((err) => this.logger.warn('Failed to process mentions:', err));

    return post;
  }

  @MessagePattern({ cmd: PostCommands.FIND_MANY })
  async findAllPosts(
    @Payload('criteria') data: SearchPostDto,
    @Payload('opts') opts?: SearchPostOptions,
    @Payload('viewerProfileId') viewerProfileId?: string
  ) {
    const searchOptions = postSearchDtoToFindManyOptions(data);

    // Apply pagination with defaults and max limits
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const limit = opts?.limit ? Math.min(opts.limit, MAX_LIMIT) : DEFAULT_LIMIT;

    searchOptions.take = limit;
    searchOptions.relations = {
      ...((searchOptions.relations as object) ?? {}),
      links: true,
    };

    if (opts) {
      if (opts.offset) {
        searchOptions.skip = opts.offset;
      }
      if (opts.orderBy) {
        searchOptions.order = { [opts.orderBy]: opts.orderDirection || 'ASC' };
      }
    }

    // Missing identity is an anonymous read, including public gateway routes.
    // Internal callers must not gain unrestricted access by omitting a viewer.
    const scope = viewerProfileId
      ? await this.buildPostVisibilityScope(viewerProfileId)
      : await this.buildAnonymousPostVisibilityScope();
    const baseWhere = (searchOptions.where as FindOptionsWhere<Post>) ?? {};
    searchOptions.where = visiblePostWhere(scope, baseWhere);

    const posts = await this.postService.findAll(searchOptions);

    for (const post of posts) {
      const votes = await this.voteService.findAll({
        where: { post: { id: post.id } },
      });

      const comments = await this.commentService.findAll({
        where: { post: { id: post.id } },
      });

      const attachments = await this.attachmentService.findAll({
        where: { post: { id: post.id } },
      });

      post.votes = votes || [];
      post.comments = comments || [];
      post.attachments = attachments || [];
    }

    return posts;
  }

  @MessagePattern({ cmd: PostCommands.FIND })
  async findOnePost(
    @Payload('id') id: string,
    @Payload('options') options?: SearchPostDto,
    @Payload('viewerProfileId') viewerProfileId?: string
  ) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      return undefined;
    }

    const search: FindOneOptions<Post> = options
      ? (postSearchDtoToFindManyOptions(options) as FindOneOptions<Post>)
      : {};

    const scope = viewerProfileId
      ? await this.buildPostVisibilityScope(viewerProfileId)
      : await this.buildAnonymousPostVisibilityScope();
    const baseWhere = (search.where as FindOptionsWhere<Post>) ?? {};
    search.where = visiblePostWhere(scope, baseWhere);

    return await this.postService.findOne(id, search);
  }

  @MessagePattern({ cmd: PostCommands.FIND_ASSET_AUDIENCES })
  async findAssetAudienceReferences(
    @Payload('assetId') assetId: string,
    @Payload('assetProfileId') assetProfileId: string
  ) {
    return this.postService.findAssetAudienceReferences(
      assetId,
      assetProfileId
    );
  }

  @MessagePattern({ cmd: PostCommands.UPDATE })
  async updatePost(
    @Payload('id') id: string,
    @Payload('data') data: UpdatePostDto,
    @Payload('userId') userId: string,
    @Payload('profileId') profileId?: string
  ) {
    return await this.postService.update(id, data, userId, profileId);
  }

  @MessagePattern({ cmd: PostCommands.DELETE })
  async removePost(
    @Payload('id') id: string,
    @Payload('userId') userId: string,
    @Payload('profileId') profileId?: string
  ) {
    console.log(`Removing post with ID: ${id}`);
    try {
      return await this.postService.remove(id, userId, profileId);
    } catch (error) {
      console.error(`Error in removePost: ${error.message}`);
      throw error;
    }
  }

  @MessagePattern({ cmd: VoteCommands.UPVOTE })
  async upvotePost(@Payload() voteDto: CreateVoteDto) {
    const { postId, userId, profileId } = voteDto;
    const { vote, changed } = await this.voteService.castVote(
      postId,
      profileId,
      userId,
      1
    );

    if (changed) {
      // Create activity log
      try {
        await this.activityService.createActivity({
          profileId,
          type: 'like' as any,
          description: 'You liked a post',
          resourceId: postId,
          resourceType: 'post',
        });
      } catch (err) {
        this.logger.warn('Failed to create activity log for upvote:', err);
      }

      // Get the post to find the author and send notification
      try {
        const post = await this.postService.findOne(postId);
        if (post && post.profileId && post.profileId !== profileId) {
          await this.notificationService.queueNotification({
            recipientId: post.profileId,
            type: 'like',
            title: 'New Like',
            body: 'Someone liked your post',
            senderId: profileId,
            resourceType: 'post',
            resourceId: postId,
            actionUrl: `/feed/post/${postId}`,
          });
        }
      } catch (err) {
        this.logger.warn('Failed to send notification for upvote:', err);
      }
    }

    return vote;
  }

  @MessagePattern({ cmd: VoteCommands.DOWNVOTE })
  async downvotePost(@Payload() voteDto: CreateVoteDto) {
    const { postId, userId, profileId } = voteDto;
    const { vote, changed } = await this.voteService.castVote(
      postId,
      profileId,
      userId,
      -1
    );

    if (changed) {
      // Create activity log for downvote
      try {
        await this.activityService.createActivity({
          profileId,
          type: 'like' as any,
          description: 'You downvoted a post',
          resourceId: postId,
          resourceType: 'post',
        });
      } catch (err) {
        this.logger.warn('Failed to create activity log for downvote:', err);
      }
    }

    return vote;
  }

  @MessagePattern({ cmd: VoteCommands.UNVOTE })
  async unvotePost(@Payload() voteDto: CreateVoteDto) {
    const { postId, profileId } = voteDto;
    return await this.voteService.removeVoteByPostAndProfile(postId, profileId);
  }

  @MessagePattern({ cmd: VoteCommands.GET })
  async getVote(
    @Payload('postid') postId?: string,
    @Payload('id') voteId?: string
  ) {
    if (voteId) {
      return await this.voteService.findOne(voteId, {
        relations: ['post', 'comment', 'comment.post'],
      });
    }
    if (!postId) return [];
    return await this.voteService.findAll({
      where: { post: { id: postId } },
      relations: ['post'],
    });
  }

  @MessagePattern({ cmd: ReactionCommands.ADD })
  async addReaction(data: CreateReactionDto) {
    if (data.postId) {
      const post = await this.postService.findOne(data.postId);
      if (
        post?.communityId &&
        !(await this.communityService.isMember(post.communityId, data.userId!))
      ) {
        throw new RpcException(
          'You must be a community member to react to this post'
        );
      }
    }

    // Check if user already has a reaction on this post/comment
    const existingReaction = await this.reactionService.findUserReaction(
      data.userId!,
      data.postId,
      data.commentId
    );

    if (existingReaction) {
      // Update existing reaction
      if (existingReaction.value === data.value) {
        // Same value - remove the reaction (toggle off)
        await this.reactionService.remove(existingReaction.id);
        return null;
      } else {
        // Different value - update the reaction
        await this.reactionService.update(existingReaction.id, {
          value: data.value,
        });
        return await this.reactionService.findOne(existingReaction.id);
      }
    }

    // Create new reaction
    return await this.reactionService.create(data);
  }

  @MessagePattern({ cmd: ReactionCommands.GET_BY_POST })
  async getReactionsByPost(@Payload('postId') postId: string) {
    return await this.reactionService.findByPostId(postId);
  }

  @MessagePattern({ cmd: ReactionCommands.GET_BY_COMMENT })
  async getReactionsByComment(@Payload('commentId') commentId: string) {
    return await this.reactionService.findByCommentId(commentId);
  }

  @MessagePattern({ cmd: ReactionCommands.GET_USER_REACTION })
  async getUserReaction(
    @Payload('userId') userId: string,
    @Payload('postId') postId?: string,
    @Payload('commentId') commentId?: string
  ) {
    return await this.reactionService.findUserReaction(
      userId,
      postId,
      commentId
    );
  }

  @MessagePattern({ cmd: ReactionCommands.GET })
  async getReactionCounts(@Payload('postId') postId: string) {
    return await this.reactionService.getReactionCounts(postId);
  }

  @MessagePattern({ cmd: CommentCommands.CREATE })
  async createComment(data: CreateCommentDto) {
    const comment = await this.commentService.create(data);

    // Get the post to find the author
    const post = await this.postService.findOne(data.postId);

    // Create activity log for comment
    try {
      await this.activityService.createActivity({
        profileId: data.profileId,
        type: 'comment' as any,
        description: 'You commented on a post',
        resourceId: comment.id,
        resourceType: 'post',
      });
    } catch (err) {
      this.logger.warn('Failed to create activity log for comment:', err);
    }

    // Send notification to post author (if not commenting on own post)
    if (post && post.profileId && post.profileId !== data.profileId) {
      this.notificationService
        .queueNotification({
          recipientId: post.profileId,
          type: 'comment',
          title: 'New Comment',
          body: 'Someone commented on your post',
          senderId: data.profileId,
          resourceType: 'post',
          resourceId: data.postId,
          actionUrl: `/feed/post/${data.postId}`,
        })
        .catch((err) => this.logger.warn('Failed to queue notification:', err));
    }

    // Process mentions in comment
    this.processMentions(data.content, '', data.profileId, data.postId).catch(
      (err) => this.logger.warn('Failed to process mentions in comment:', err)
    );

    return comment;
  }

  @MessagePattern({ cmd: CommentCommands.FIND_MANY })
  async findAllComments(
    @Payload() data: SearchCommentDto & { viewerProfileId?: string }
  ) {
    const { viewerProfileId, ...criteria } = data;
    const options = transformSearchCommentDtoToFindOptions(criteria);

    // Comments inherit their parent post's visibility: a comment is only
    // returned if the viewer is entitled to see the post it belongs to
    // (same rule as findAllPosts/findOnePost). Anonymous callers get the
    // unscoped anonymous branch of visiblePostWhere (public/visible/
    // unscheduled only).
    const scope: PostVisibilityScope = viewerProfileId
      ? await this.buildPostVisibilityScope(viewerProfileId)
      : await this.buildAnonymousPostVisibilityScope();

    return await this.commentService.findAllVisible(options, scope);
  }

  @MessagePattern({ cmd: CommentCommands.FIND })
  async findOneComment(
    @Payload('id') id: string,
    @Payload('options') options?: SearchCommentDto,
    @Payload('viewerProfileId') viewerProfileId?: string
  ) {
    const search = transformSearchCommentDtoToFindOptions(options);
    const scope: PostVisibilityScope = viewerProfileId
      ? await this.buildPostVisibilityScope(viewerProfileId)
      : await this.buildAnonymousPostVisibilityScope();

    return await this.commentService.findOneVisible(id, search, scope);
  }

  @MessagePattern({ cmd: CommentCommands.UPDATE })
  async updateComment(
    @Payload('id') id: string,
    @Payload('update') update: UpdateCommentDto,
    @Payload('userId') userId: string,
    @Payload('profileId') profileId: string
  ) {
    console.log('updateComment', id, update);
    await this.commentService.update(id, update, userId, profileId);
    return { success: true };
  }

  @MessagePattern({ cmd: CommentCommands.DELETE })
  async removeComment(
    @Payload('id') id: string,
    @Payload('userId') userId: string,
    @Payload('profileId') profileId: string
  ) {
    return await this.commentService.remove(id, userId, profileId);
  }

  @MessagePattern({ cmd: AttachmentCommands.CREATE })
  async createAttachment(
    @Payload('attachment') data: Omit<CreateAttachmentDto, 'postId'>,
    @Payload('postId') postId: string,
    @Payload('actor') actor: AttachmentActor
  ) {
    return this.attachmentService.create(data, postId, actor);
  }

  @MessagePattern({ cmd: AttachmentCommands.FIND_MANY })
  async findAllAttachments(
    @Payload() request: { criteria?: SearchAttachmentDto; appId?: string } = {}
  ) {
    if (typeof request?.appId !== 'string' || !request.appId.trim()) {
      throw new RpcException({
        statusCode: 403,
        code: 'ATTACHMENT_SCOPE_REQUIRED',
        message: 'A verified app scope is required to read attachments',
      });
    }
    const options = request?.criteria ?? {};
    const search = toFindOptions(options ?? {});
    return this.attachmentService.findAllForApp(
      { ...search, relations: ['post'] } as FindManyOptions<Attachment>,
      request.appId
    );
  }

  @MessagePattern({ cmd: AttachmentCommands.FIND })
  async findAttachment(
    @Payload('id') id: string,
    @Payload('options') opts: SearchAttachmentDto = {},
    @Payload('appId') appId?: string
  ) {
    if (typeof appId !== 'string' || !appId.trim()) {
      throw new RpcException({
        statusCode: 403,
        code: 'ATTACHMENT_SCOPE_REQUIRED',
        message: 'A verified app scope is required to read attachments',
      });
    }
    if (typeof id !== 'string' || id.trim().length === 0) {
      return undefined;
    }
    const search = toFindOptions(opts ?? {});
    const options = {
      ...search,
      relations: ['post'],
    } as FindOneOptions<Attachment>;
    return this.attachmentService.findOneForApp(id, appId, options);
  }

  @MessagePattern({ cmd: AttachmentCommands.UPDATE })
  async updateAttachment(
    @Payload('id') id: string,
    @Payload('update') update: UpdateAttachmentDto,
    @Payload('actor') actor: AttachmentActor
  ) {
    return this.attachmentService.update(id, update, actor);
  }

  @MessagePattern({ cmd: AttachmentCommands.DELETE })
  async deleteAttachment(
    @Payload('id') id: string,
    @Payload('actor') actor: AttachmentActor
  ) {
    await this.attachmentService.remove(id, actor);
    return { id, deleted: true };
  }

  @MessagePattern({ cmd: LinkCommands.CREATE })
  async createLink(
    @Payload()
    data: {
      dto?: CreateLinkDto;
      actor?: { accountId: string; profileId: string };
    }
  ) {
    if (!data?.dto || !data.actor)
      throw new RpcException({
        statusCode: 403,
        message: 'Link actor required',
      });
    return this.linkService.create(data.dto, data.actor);
  }

  @MessagePattern({ cmd: LinkCommands.UPDATE })
  async updateLink(
    @Payload('id') id: string,
    @Payload('link') dto: UpdateLinkDto
  ) {
    return this.linkService.update(Number(id), dto);
  }

  @MessagePattern({ cmd: LinkCommands.FIND })
  async findLink(@Payload('id') id: string) {
    return this.linkService.findOne(Number(id));
  }

  @MessagePattern({ cmd: LinkCommands.FIND_MANY })
  async findAllLinks(@Payload() options: FindOptions) {
    return this.linkService.findAll(options as FindManyOptions);
  }

  @MessagePattern({ cmd: FollowCommands.FOLLOW })
  async follow(@Payload() data: UpdateFollowDto) {
    const result = await this.followService.follow(
      data.followerId,
      data.followeeId
    );

    // Create activity log for follow
    try {
      await this.activityService.createActivity({
        profileId: data.followerId,
        type: 'follow' as any,
        description: 'You started following a user',
        resourceId: data.followeeId,
        resourceType: 'profile',
      });
    } catch (err) {
      this.logger.warn('Failed to create activity log for follow:', err);
    }

    // Send notification to the followed user
    try {
      await this.notificationService.queueNotification({
        recipientId: data.followeeId,
        type: 'follow',
        title: 'New Follower',
        body: 'Someone started following you',
        senderId: data.followerId,
        resourceType: 'profile',
        resourceId: data.followerId,
        actionUrl: `/profile/${data.followerId}`,
      });
    } catch (err) {
      this.logger.warn('Failed to send notification for follow:', err);
    }

    return result;
  }

  @MessagePattern({ cmd: FollowCommands.UNFOLLOW })
  async unfollow(@Payload() data: UpdateFollowDto) {
    const result = await this.followService.unfollow(
      data.followerId,
      data.followeeId
    );

    // Create activity log for unfollow
    try {
      await this.activityService.createActivity({
        profileId: data.followerId,
        type: 'follow' as any,
        description: 'You unfollowed a user',
        resourceId: data.followeeId,
        resourceType: 'profile',
      });
    } catch (err) {
      this.logger.warn('Failed to create activity log for unfollow:', err);
    }

    return result;
  }

  @MessagePattern({ cmd: FollowCommands.GET_FOLLOWERS })
  async getFollowers(@Payload() data: QueryFollowsDto) {
    return await this.followService.getFollowers(data.followeeId);
  }

  @MessagePattern({ cmd: FollowCommands.GET_FOLLOWING })
  async getFollowing(@Payload() data: QueryFollowsDto) {
    return await this.followService.getFollowing(data.followerId);
  }

  @MessagePattern({ cmd: FollowCommands.GET_MUTUALS })
  async getMutuals(@Payload() data: QueryFollowsDto) {
    return await this.followService.getMutuals(data.followerId);
  }

  @MessagePattern({ cmd: FollowCommands.GET_FOLLOWER_COUNT })
  async getFollowerCount(@Payload() data: QueryFollowsDto) {
    return await this.followService.getFollowerCount(data.followeeId);
  }

  @MessagePattern({ cmd: FollowCommands.GET_FOLLOWING_COUNT })
  async getFollowingCount(@Payload() data: QueryFollowsDto) {
    return await this.followService.getFollowingCount(data.followerId);
  }

  // Social Component endpoints
  @MessagePattern({ cmd: SocialComponentCommands.CREATE })
  async createSocialComponent(
    @Payload() createComponentDto: CreateSocialComponentDto
  ) {
    this.logger.log(
      `CREATE social component postId=${createComponentDto.postId} instanceId=${createComponentDto.instanceId}`
    );
    try {
      const res = await this.socialComponentService.create(createComponentDto);
      this.logger.log(`CREATED social component id=${res.id}`);
      return res;
    } catch (e) {
      this.logger.error(`CREATE social component failed: ${e?.message || e}`);
      throw e;
    }
  }

  @MessagePattern({ cmd: SocialComponentCommands.FIND_BY_POST })
  async getComponentsForPost(@Payload('postId') postId: string) {
    this.logger.log(`FIND_BY_POST social postId=${postId}`);
    try {
      const comps = await this.socialComponentService.findByPostId(postId);
      this.logger.log(`FIND_BY_POST social found=${comps.length}`);
      return comps;
    } catch (e) {
      this.logger.error(`FIND_BY_POST social failed: ${e?.message || e}`);
      throw e;
    }
  }

  @MessagePattern({ cmd: SocialComponentCommands.FIND })
  async findOneSocialComponent(@Payload('id') id: string) {
    this.logger.log(`FIND social id=${id}`);
    try {
      const comp = await this.socialComponentService.findOne(id);
      this.logger.log(`FIND social found=${!!comp}`);
      return comp;
    } catch (e) {
      this.logger.error(`FIND social failed: ${e?.message || e}`);
      throw e;
    }
  }

  @MessagePattern({ cmd: SocialComponentCommands.UPDATE })
  async updateSocialComponent(
    @Payload() data: { id: string; dto: UpdateSocialComponentDto }
  ) {
    this.logger.log(`UPDATE social id=${data.id}`);
    try {
      const res = await this.socialComponentService.update(data.id, data.dto);
      this.logger.log(`UPDATED social id=${res.id}`);
      return res;
    } catch (e) {
      this.logger.error(
        `UPDATE social failed id=${data.id}: ${e?.message || e}`
      );
      throw e;
    }
  }

  @MessagePattern({ cmd: SocialComponentCommands.DELETE })
  async deleteSocialComponent(@Payload('id') id: string) {
    this.logger.log(`DELETE social id=${id}`);
    try {
      const res = await this.socialComponentService.remove(id);
      this.logger.log(`DELETED social id=${id}`);
      return res;
    } catch (e) {
      this.logger.error(`DELETE social failed id=${id}: ${e?.message || e}`);
      throw e;
    }
  }

  @MessagePattern({ cmd: SocialComponentCommands.DELETE_BY_POST })
  async deleteComponentsByPost(@Payload('postId') postId: string) {
    this.logger.log(`DELETE_BY_POST social postId=${postId}`);
    try {
      const res = await this.socialComponentService.removeByPostId(postId);
      this.logger.log(`DELETED_BY_POST social postId=${postId}`);
      return res;
    } catch (e) {
      this.logger.error(
        `DELETE_BY_POST social failed postId=${postId}: ${e?.message || e}`
      );
      throw e;
    }
  }

  @MessagePattern({ cmd: SocialComponentCommands.FIND_BY_QUERY })
  async findComponentsByQuery(@Payload() query: SocialComponentQueryDto) {
    this.logger.log(
      `FIND_BY_QUERY social keys=${Object.keys(query || {}).join(',')}`
    );
    try {
      const comps = await this.socialComponentService.findByQuery(query);
      this.logger.log(`FIND_BY_QUERY social found=${comps.length}`);
      return comps;
    } catch (e) {
      this.logger.error(`FIND_BY_QUERY social failed: ${e?.message || e}`);
      throw e;
    }
  }

  // Community handlers
  @MessagePattern({ cmd: CommunityCommands.CREATE })
  async createCommunity(
    @Payload()
    data: {
      dto: CreateCommunityDto;
      userId: string;
      profileId: string;
      appScope?: string;
    }
  ) {
    return await this.communityService.create(
      data.dto,
      data.userId,
      data.profileId ||
        (data.dto as CreateCommunityDto & { ownerProfileId?: string })
          .ownerProfileId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: CommunityCommands.FIND })
  async findCommunity(
    @Payload('id') id: string,
    @Payload('requestingProfileId') requestingProfileId?: string
  ) {
    return await this.communityService.findOne(id, requestingProfileId);
  }

  @MessagePattern({ cmd: CommunityCommands.FIND_BY_SLUG })
  async findCommunityBySlug(
    @Payload() data: { slug: string; requestingProfileId?: string }
  ) {
    return await this.communityService.findBySlug(
      data.slug,
      data.requestingProfileId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.LIST_LOCALITY })
  async listLocalityCommunities(
    @Payload() data: { appScope?: string; localityType?: string }
  ) {
    return await this.communityService.listLocality(
      data.appScope,
      data.localityType
    );
  }

  @MessagePattern({ cmd: CommunityCommands.GET_SUB_COMMUNITIES })
  async getSubCommunities(@Payload() data: { parentId: string }) {
    return await this.communityService.getSubCommunities(data.parentId);
  }

  @MessagePattern({ cmd: CommunityCommands.FIND_MANY })
  async findAllCommunities(
    @Payload()
    data: {
      criteria: SearchCommunityDto;
      appScope: string;
      requestingProfileId?: string;
    }
  ) {
    return await this.communityService.findAll(
      data.criteria,
      data.appScope,
      data.requestingProfileId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.GET_TOP_ACTIVE })
  async getTopActiveCommunities(
    @Payload()
    data: {
      limit: number;
      appScope: string;
      requestingProfileId?: string;
    }
  ) {
    return await this.communityService.getTopActive(
      data.limit,
      data.appScope,
      data.requestingProfileId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.UPDATE })
  async updateCommunity(
    @Payload() data: { id: string; dto: UpdateCommunityDto; userId: string }
  ) {
    return await this.communityService.update(data.id, data.dto, data.userId);
  }

  @MessagePattern({ cmd: CommunityCommands.DELETE })
  async deleteCommunity(@Payload() data: { id: string; userId: string }) {
    await this.communityService.delete(data.id, data.userId);
    return { success: true };
  }

  @MessagePattern({ cmd: CommunityCommands.JOIN })
  async joinCommunity(
    @Payload()
    data: {
      dto: JoinCommunityDto;
      userId: string;
      profileId: string;
    }
  ) {
    return await this.communityService.join(
      data.dto,
      data.userId,
      data.profileId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.LEAVE })
  async leaveCommunity(
    @Payload() data: { communityId: string; userId: string }
  ) {
    await this.communityService.leave(data.communityId, data.userId);
    return { success: true };
  }

  @MessagePattern({ cmd: CommunityCommands.GET_CHAT_MEMBERSHIPS })
  async getChatMemberships(@Payload() data: { profileId: string }) {
    return this.communityService.getChatMemberships(data.profileId);
  }

  @MessagePattern({ cmd: CommunityCommands.GET_VISIBLE_MEMBERS })
  async getVisibleCommunityMembers(
    @Payload() data: { communityId: string; requestingProfileId?: string }
  ) {
    return this.communityService.getVisibleMembers(
      data.communityId,
      data.requestingProfileId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.GET_MEMBERS })
  async getCommunityMembers(@Payload('communityId') communityId: string) {
    return await this.communityService.getMembers(communityId);
  }

  @MessagePattern({ cmd: 'IS_COMMUNITY_MEMBER' })
  async isCommunityMember(
    @Payload() data: { communityId: string; userId: string }
  ) {
    return await this.communityService.isMember(data.communityId, data.userId);
  }

  @MessagePattern({ cmd: CommunityCommands.GET_USER_COMMUNITIES })
  async getUserCommunities(
    @Payload() data: { userId: string; appScope: string }
  ) {
    return await this.communityService.getUserCommunities(
      data.userId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: 'getCommunitiesByProfileId' })
  async getCommunitiesByProfileId(
    @Payload() data: { profileId: string; appScope: string }
  ) {
    return await this.communityService.getCommunitiesByProfileId(
      data.profileId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: CommunityCommands.INVITE })
  async inviteToCommunity(
    @Payload() data: { dto: InviteToCommunityDto; inviterId: string }
  ) {
    return await this.communityService.invite(data.dto, data.inviterId);
  }

  @MessagePattern({ cmd: CommunityCommands.INVITE_BY_EMAIL })
  async inviteToCommunityByEmail(
    @Payload()
    data: {
      dto: { communityId: string; email: string; inviteeUserId?: string };
      inviterId: string;
    }
  ) {
    return await this.communityService.inviteByEmail(data.dto, data.inviterId);
  }

  @MessagePattern({ cmd: CommunityCommands.ACCEPT_INVITE_BY_TOKEN })
  async acceptCommunityInviteByToken(
    @Payload() data: { token: string; userId: string; profileId: string }
  ) {
    return await this.communityService.acceptInviteByToken(
      data.token,
      data.userId,
      data.profileId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.FIND_INVITE_BY_TOKEN })
  async findCommunityInviteByToken(@Payload() data: { token: string }) {
    return await this.communityService.findInvitePreview(data.token);
  }

  @MessagePattern({ cmd: CommunityCommands.CANCEL_INVITE })
  async cancelInvite(@Payload() data: { inviteId: string; userId: string }) {
    await this.communityService.cancelInvite(data.inviteId, data.userId);
    return { success: true };
  }

  @MessagePattern({ cmd: CommunityCommands.FIND_MEMBER })
  async findCommunityMember(@Payload('id') id: string) {
    return this.communityService.findMember(id);
  }

  @MessagePattern({ cmd: CommunityCommands.FIND_INVITE })
  async findCommunityInvite(@Payload('id') id: string) {
    return this.communityService.findInvite(id);
  }

  @MessagePattern({ cmd: CommunityCommands.GET_PENDING_INVITES })
  async getPendingInvites(
    @Payload() data: { communityId: string; userId: string }
  ) {
    return await this.communityService.getPendingInvites(
      data.communityId,
      data.userId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.GET_PENDING_JOIN_REQUESTS })
  async getPendingJoinRequests(
    @Payload() data: { communityId: string; userId: string }
  ) {
    return await this.communityService.getPendingJoinRequests(
      data.communityId,
      data.userId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.APPROVE_MEMBER })
  async approveMember(
    @Payload() data: { memberId: string; approverId: string }
  ) {
    return await this.communityService.approveMember(
      data.memberId,
      data.approverId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.REJECT_MEMBER })
  async rejectMember(
    @Payload() data: { memberId: string; rejecterId: string }
  ) {
    await this.communityService.rejectMember(data.memberId, data.rejecterId);
    return { success: true };
  }

  @MessagePattern({ cmd: CommunityCommands.REMOVE_MEMBER })
  async removeMember(@Payload() data: { memberId: string; removerId: string }) {
    await this.communityService.removeMember(data.memberId, data.removerId);
    return { success: true };
  }

  @MessagePattern({ cmd: 'SUSPEND_COMMUNITY_MEMBER' })
  async suspendCommunityMember(
    @Payload()
    data: {
      memberId: string;
      suspenderId: string;
      workspaceContext?: unknown;
    }
  ) {
    return this.communityService.suspendMember(data.memberId, data.suspenderId);
  }

  @MessagePattern({ cmd: 'REACTIVATE_COMMUNITY_MEMBER' })
  async reactivateCommunityMember(
    @Payload()
    data: {
      memberId: string;
      reactivatorId: string;
      workspaceContext?: unknown;
    }
  ) {
    return this.communityService.reactivateMember(
      data.memberId,
      data.reactivatorId
    );
  }

  @MessagePattern({ cmd: 'GET_COMMUNITY_MEMBERSHIP_AUDIT' })
  async getCommunityMembershipAudit(
    @Payload()
    data: {
      memberId: string;
      requesterId: string;
      workspaceContext?: unknown;
    }
  ) {
    const member = await this.communityService.findMember(data.memberId);
    if (!member) {
      throw new RpcException('Member not found');
    }
    return this.communityService.getMembershipAudit(
      member.communityId,
      data.requesterId,
      member.profileId
    );
  }

  @MessagePattern({ cmd: 'UPDATE_COMMUNITY_MEMBER_ROLE' })
  async updateMemberRole(
    @Payload()
    data: {
      communityId: string;
      memberId: string;
      role: CommunityMemberRole;
      userId: string;
    }
  ) {
    return await this.communityService.updateMemberRole(
      data.memberId,
      data.role,
      data.userId
    );
  }

  @MessagePattern({ cmd: 'GET_COMMUNITY_CHAT_ROOM' })
  async getCommunityChatRoom(
    @Payload() data: { communityId: string; requestingProfileId?: string }
  ) {
    if (data.requestingProfileId)
      await this.communityService.assertChatMembership(
        data.communityId,
        data.requestingProfileId
      );
    return await this.communityService.getCommunityChatRoom(data.communityId);
  }

  @MessagePattern({ cmd: 'SET_COMMUNITY_CHAT_ROOM' })
  async setCommunityChatRoom(
    @Payload() data: { communityId: string; chatRoomId: string }
  ) {
    await this.communityService.setCommunityChatRoom(
      data.communityId,
      data.chatRoomId
    );
    return { success: true };
  }

  @MessagePattern({ cmd: CommunityCommands.GET_FEED })
  async getCommunityFeed(
    @Payload()
    data: {
      userId: string;
      profileId: string;
      appScope: string;
      includePublic?: boolean;
      includeFollowing?: boolean;
      includeCommunities?: boolean;
      communityIds?: string[];
      limit?: number;
      offset?: number;
    }
  ) {
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const limit = data.limit ? Math.min(data.limit, MAX_LIMIT) : DEFAULT_LIMIT;
    const offset = data.offset || 0;

    const following = await this.followService.getFollowing(data.profileId);
    const followingIds = following.map((f) => f.followeeId);

    const userCommunities = await this.communityService.getUserCommunities(
      data.userId,
      data.appScope
    );
    const selectedCommunityIds = new Set(data.communityIds || []);
    const communityIds = userCommunities
      .map((c) => c.id)
      .filter(
        (communityId) =>
          selectedCommunityIds.size === 0 ||
          selectedCommunityIds.has(communityId)
      );

    const postRepo = this.postService['postRepo'];
    const qb = postRepo.createQueryBuilder('post');

    const conditions: string[] = [];
    const params: any = { userId: data.userId, followingIds, communityIds };

    if (data.includePublic !== false) {
      conditions.push('post.visibility = :public');
      params.public = 'public';
    }

    if (data.includeFollowing && followingIds.length > 0) {
      conditions.push(
        '(post.profileId IN (:...followingIds) AND post.visibility = :followers)'
      );
      params.followers = 'followers';
    }

    if (data.includeCommunities && communityIds.length > 0) {
      conditions.push('post.communityId IN (:...communityIds)');
    }

    if (conditions.length === 0) {
      return [];
    }

    // Keep caller feed selection grouped before the mandatory visibility policy
    // is appended with AND; otherwise SQL precedence lets an OR arm bypass it.
    qb.where(`(${conditions.join(' OR ')})`, params);
    if (data.profileId) {
      const [blocked, muted] = await Promise.all([
        this.privacyService.getBlockedUsers(data.profileId),
        this.privacyService.getActiveMutedUsers(data.profileId),
      ]);
      const suppressedProfileIds = [
        ...new Set([
          ...(blocked || []).map((entry) => entry.blockedId),
          ...(muted || []).map((entry) => entry.mutedId),
        ]),
      ];
      if (suppressedProfileIds.length > 0) {
        qb.andWhere('post.profileId NOT IN (:...suppressedProfileIds)', {
          suppressedProfileIds,
        });
      }
    }
    const postScope = await this.buildPostVisibilityScope(data.profileId);
    applyVisiblePostScope(qb, postScope, 'post');
    qb.orderBy('post.createdAt', 'DESC');
    qb.skip(offset).take(limit);

    const posts = await qb.getMany();

    for (const post of posts) {
      const votes = await this.voteService.findAll({
        where: { post: { id: post.id } },
      });
      const comments = await this.commentService.findAll({
        where: { post: { id: post.id } },
      });
      const attachments = await this.attachmentService.findAll({
        where: { post: { id: post.id } },
      });
      post.votes = votes || [];
      post.comments = comments || [];
      post.attachments = attachments || [];
    }

    return posts;
  }

  @MessagePattern({ cmd: CommunityCommands.GET_MANAGER })
  async getCommunityManager(@Payload() data: { communityId: string }) {
    return await this.communityService.getCommunityManager(data.communityId);
  }

  @MessagePattern({ cmd: CommunityCommands.GET_ELECTION })
  async getCommunityElection(@Payload() data: { communityId: string }) {
    return await this.communityService.getActiveElection(data.communityId);
  }

  @MessagePattern({ cmd: CommunityCommands.START_ELECTION })
  async startElection(
    @Payload() data: { communityId: string; initiatedBy: string; endsAt?: Date }
  ) {
    return await this.communityService.startElection(
      data.communityId,
      data.initiatedBy,
      data.endsAt
    );
  }

  @MessagePattern({ cmd: CommunityCommands.NOMINATE })
  async nominateForElection(
    @Payload() data: { communityId: string; userId: string; profileId: string }
  ) {
    return await this.communityService.nominateForElection(
      data.communityId,
      data.userId,
      data.profileId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.VOTE })
  async voteInElection(
    @Payload()
    data: {
      communityId: string;
      voterId: string;
      voterProfileId: string;
      candidateId: string;
    }
  ) {
    return await this.communityService.voteInElection(
      data.communityId,
      data.voterId,
      data.voterProfileId,
      data.candidateId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.CLOSE_ELECTION })
  async closeElection(@Payload() data: { electionId: string }) {
    return await this.communityService.closeElection(data.electionId);
  }

  @MessagePattern({ cmd: CommunityCommands.WITHDRAW_CANDIDATE })
  async withdrawFromElection(
    @Payload() data: { communityId: string; userId: string }
  ) {
    return await this.communityService.withdrawCandidate(
      data.communityId,
      data.userId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.APPOINT_MANAGER })
  async appointManager(
    @Payload() data: { communityId: string; userId: string; profileId: string }
  ) {
    return await this.communityService.appointManager(
      data.communityId,
      data.userId,
      data.profileId
    );
  }

  @MessagePattern({ cmd: CommunityCommands.REVOKE_MANAGER })
  async revokeManager(@Payload() data: { communityId: string }) {
    return await this.communityService.revokeManager(data.communityId);
  }

  // Notification handlers
  @MessagePattern({ cmd: NotificationCommands.CREATE })
  async createNotification(
    @Payload()
    data: {
      recipientId: string;
      type: string;
      title: string;
      body: string;
      senderId?: string;
      resourceType?: string;
      resourceId?: string;
      actionUrl?: string;
    }
  ) {
    return await this.notificationService.create(data);
  }

  @MessagePattern({ cmd: NotificationCommands.FIND })
  async findNotification(@Payload('id') id: string) {
    return await this.notificationService.findOne(id);
  }

  @MessagePattern({ cmd: NotificationCommands.FIND_BY_RECIPIENT })
  async findNotificationsByRecipient(
    @Payload('recipientId') recipientId: string
  ) {
    return await this.notificationService.findByRecipient(recipientId);
  }

  @MessagePattern({ cmd: NotificationCommands.MARK_READ })
  async markNotificationRead(
    @Payload() payload?: { id?: string; recipientId?: string }
  ) {
    await this.notificationService.markAsRead(
      payload?.id as string,
      payload?.recipientId as string
    );
    return { success: true };
  }

  @MessagePattern({ cmd: NotificationCommands.MARK_ALL_READ })
  async markAllNotificationsRead(@Payload('recipientId') recipientId: string) {
    await this.notificationService.markAllAsRead(recipientId);
    return { success: true };
  }

  @MessagePattern({ cmd: NotificationCommands.DELETE })
  async deleteNotification(
    @Payload() payload?: { id?: string; recipientId?: string }
  ) {
    await this.notificationService.delete(
      payload?.id as string,
      payload?.recipientId as string
    );
    return { success: true };
  }

  @MessagePattern({ cmd: NotificationCommands.GET_UNREAD_COUNT })
  async getUnreadNotificationCount(
    @Payload('recipientId') recipientId: string
  ) {
    const count = await this.notificationService.getUnreadCount(recipientId);
    return { count };
  }

  // Search handlers
  @MessagePattern({ cmd: SearchCommands.SEARCH })
  async search(
    @Payload() data: { query: string; options: any; profileId?: string }
  ) {
    return await this.searchService.search(
      data.query,
      data.options,
      data.profileId
    );
  }

  @MessagePattern({ cmd: SearchCommands.GET_TRENDING })
  async getTrending(@Payload() data: { limit: number; profileId?: string }) {
    return await this.searchService.getTrending(data.limit, data.profileId);
  }

  @MessagePattern({ cmd: SearchCommands.GET_SUGGESTED_USERS })
  async getSuggestedUsers(
    @Payload() data: { limit: number; profileId: string }
  ) {
    return await this.searchService.getSuggestedUsers(
      data.limit,
      data.profileId
    );
  }

  @MessagePattern({ cmd: SearchCommands.GET_SUGGESTED_COMMUNITIES })
  async getSuggestedCommunities(@Payload() data: { limit: number }) {
    return await this.searchService.getSuggestedCommunities(data.limit);
  }

  @MessagePattern({ cmd: SearchCommands.GET_SEARCH_HISTORY })
  async getSearchHistory(
    @Payload() data: { profileId: string; limit: number }
  ) {
    return await this.searchService.getSearchHistory(
      data.profileId,
      data.limit
    );
  }

  // Privacy handlers
  @MessagePattern({ cmd: PrivacyCommands.BLOCK_USER })
  async blockUser(
    @Payload() data: { blockerId: string; blockedId: string; reason?: string }
  ) {
    return await this.privacyService.blockUser(
      data.blockerId,
      data.blockedId,
      data.reason
    );
  }

  @MessagePattern({ cmd: PrivacyCommands.UNBLOCK_USER })
  async unblockUser(@Payload() data: { blockerId: string; blockedId: string }) {
    await this.privacyService.unblockUser(data.blockerId, data.blockedId);
    return { success: true };
  }

  @MessagePattern({ cmd: PrivacyCommands.GET_BLOCKED_USERS })
  async getBlockedUsers(@Payload() data: { blockerId: string }) {
    return await this.privacyService.getBlockedUsers(data.blockerId);
  }

  @MessagePattern({ cmd: PrivacyCommands.IS_USER_BLOCKED })
  async isUserBlocked(
    @Payload() data: { blockerId: string; blockedId: string }
  ) {
    return await this.privacyService.isUserBlocked(
      data.blockerId,
      data.blockedId
    );
  }

  @MessagePattern({ cmd: PrivacyCommands.MUTE_USER })
  async muteUser(
    @Payload() data: { muterId: string; mutedId: string; duration?: number }
  ) {
    return await this.privacyService.muteUser(
      data.muterId,
      data.mutedId,
      data.duration
    );
  }

  @MessagePattern({ cmd: PrivacyCommands.UNMUTE_USER })
  async unmuteUser(@Payload() data: { muterId: string; mutedId: string }) {
    await this.privacyService.unmuteUser(data.muterId, data.mutedId);
    return { success: true };
  }

  @MessagePattern({ cmd: PrivacyCommands.GET_MUTED_USERS })
  async getMutedUsers(@Payload() data: { muterId: string }) {
    return await this.privacyService.getActiveMutedUsers(data.muterId);
  }

  @MessagePattern({ cmd: PrivacyCommands.REPORT_CONTENT })
  async reportContent(
    @Payload()
    data: {
      reporterId: string;
      contentType:
        | 'post'
        | 'comment'
        | 'profile'
        | 'community'
        | 'message'
        | 'classified'
        | 'seller';
      contentId: string;
      reason: string;
      description?: string;
      appScope?: string;
      workspaceId?: string | null;
    }
  ) {
    return await this.privacyService.reportContent(
      data.reporterId,
      data.contentType,
      data.contentId,
      data.reason as any,
      data.description,
      data.appScope,
      data.workspaceId
    );
  }

  @MessagePattern({ cmd: PrivacyCommands.GET_MY_REPORTS })
  async getMyReports(
    @Payload() data: { reporterId: string; appScope: string }
  ) {
    return await this.privacyService.getMyReports(
      data.reporterId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PrivacyCommands.GET_ALL_REPORTS })
  async getAllReports(
    @Payload() data: { workspaceId?: string | null; appScope: string }
  ) {
    return await this.privacyService.getAllReports(
      data.workspaceId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: PrivacyCommands.UPDATE_REPORT_STATUS })
  async updateReportStatus(
    @Payload()
    data: {
      id: string;
      status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
      adminNotes?: string;
      workspaceId?: string | null;
      appScope: string;
      moderatedBy: string;
    }
  ) {
    return await this.privacyService.updateReportStatus(
      data.id,
      data.status,
      data.adminNotes,
      data.workspaceId,
      data.appScope,
      data.moderatedBy
    );
  }

  @MessagePattern({ cmd: PrivacyCommands.MODERATE_CONTENT })
  async moderateContent(
    @Payload()
    data: {
      contentType: 'post' | 'comment';
      contentId: string;
      reportId: string;
      moderationStatus: 'visible' | 'hidden';
      moderatedBy: string;
      adminNotes?: string;
      workspaceId: string;
      appScope: string;
    }
  ) {
    return await this.privacyService.moderateContent(
      data.contentType,
      data.contentId,
      data.moderationStatus,
      data.moderatedBy,
      data.adminNotes,
      data.reportId,
      data.appScope,
      data.workspaceId
    );
  }

  // Activity handlers
  @MessagePattern({ cmd: ActivityCommands.CREATE })
  async createActivity(
    @Payload()
    data: {
      profileId: string;
      type: string;
      description: string;
      resourceId?: string;
      resourceType?: string;
    }
  ) {
    return await this.activityService.createActivity(data as any);
  }

  @MessagePattern({ cmd: ActivityCommands.FIND })
  async findActivity(@Payload('id') id: string) {
    return await this.activityService.findOne(id);
  }

  @MessagePattern({ cmd: ActivityCommands.FIND_BY_PROFILE })
  async findActivitiesByProfile(
    @Payload()
    data: {
      profileId: string;
      type?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    return await this.activityService.findByProfile(data.profileId, {
      type: data.type as any,
      limit: data.limit,
      offset: data.offset,
    });
  }

  @MessagePattern({ cmd: ActivityCommands.DELETE })
  async deleteActivity(@Payload('id') id: string) {
    await this.activityService.deleteActivity(id);
    return { success: true };
  }

  // SavedItem handlers
  @MessagePattern({ cmd: SavedItemCommands.SAVE })
  async saveItem(
    @Payload()
    data: {
      profileId: string;
      itemType: 'post' | 'comment';
      itemId: string;
      itemTitle?: string;
    }
  ) {
    return await this.activityService.saveItem(
      data.profileId,
      data.itemType,
      data.itemId,
      data.itemTitle
    );
  }

  @MessagePattern({ cmd: SavedItemCommands.UNSAVE })
  async unsaveItem(@Payload() data: { profileId: string; itemId: string }) {
    await this.activityService.unsaveItem(data.profileId, data.itemId);
    return { success: true };
  }

  @MessagePattern({ cmd: SavedItemCommands.FIND_SAVED })
  async findSavedItems(@Payload('profileId') profileId: string) {
    return await this.activityService.findSavedItems(profileId);
  }

  @MessagePattern({ cmd: SavedItemCommands.IS_SAVED })
  async isItemSaved(@Payload() data: { profileId: string; itemId: string }) {
    return await this.activityService.isItemSaved(data.profileId, data.itemId);
  }

  // Presence handlers
  @MessagePattern({ cmd: PresenceCommands.SET_PRESENCE })
  async setPresence(
    @Payload() data: { userId: string; status: PresenceStatus }
  ) {
    return await this.presenceService.setPresence(data.userId, data.status);
  }

  @MessagePattern({ cmd: PresenceCommands.GET_PRESENCE })
  async getPresence(@Payload('userId') userId: string) {
    return await this.presenceService.getPresence(userId);
  }

  @MessagePattern({ cmd: PresenceCommands.GET_PRESENCE_BATCH })
  async getPresenceBatch(@Payload('userIds') userIds: string[]) {
    return await this.presenceService.getPresenceBatch(userIds);
  }

  @MessagePattern({ cmd: PresenceCommands.GET_ONLINE_USERS })
  async getOnlineUsers(@Payload() data: { userIds?: string[] }) {
    return await this.presenceService.getOnlineUsers(data?.userIds ?? []);
  }

  @MessagePattern({ cmd: PresenceCommands.GET_CONVERSATION_PRESENCE })
  async getConversationPresence(
    @Payload()
    data: {
      actorProfileId: string;
      bindings: Array<{ profileId: string; accountId: string }>;
    }
  ) {
    return await this.presenceService.getConversationPresence(data);
  }

  @MessagePattern({ cmd: PresenceCommands.UPDATE_LAST_SEEN })
  async updateLastSeen(@Payload('userId') userId: string) {
    await this.presenceService.updateLastSeen(userId);
    return { success: true };
  }

  @MessagePattern({ cmd: PresenceCommands.SET_OFFLINE })
  async setOffline(@Payload('userId') userId: string) {
    await this.presenceService.setOffline(userId);
    return { success: true };
  }

  // Profile Analytics handlers
  @MessagePattern({ cmd: ProfileAnalyticsCommands.RECORD_VIEW })
  async recordProfileView(
    @Payload() data: { profileId: string; viewerId: string; source: string }
  ) {
    return await this.profileAnalyticsService.recordView(
      data.profileId,
      data.viewerId,
      data.source
    );
  }

  @MessagePattern({ cmd: ProfileAnalyticsCommands.GET_VIEW_STATS })
  async getProfileViewStats(@Payload('profileId') profileId: string) {
    return await this.profileAnalyticsService.getViewStats(profileId);
  }

  @MessagePattern({ cmd: ProfileAnalyticsCommands.GET_RECENT_VIEWERS })
  async getRecentProfileViewers(
    @Payload() data: { profileId: string; limit?: number }
  ) {
    return await this.profileAnalyticsService.getRecentViewers(
      data.profileId,
      data.limit
    );
  }

  // Poll handlers
  @MessagePattern({ cmd: PollCommands.CREATE })
  async createPoll(data: CreatePollDto) {
    return await this.pollService.create(data);
  }

  @MessagePattern({ cmd: PollCommands.UPDATE })
  async updatePoll(
    @Payload('id') id: string,
    @Payload('data') data: UpdatePollDto
  ) {
    return await this.pollService.update(id, data);
  }

  @MessagePattern({ cmd: PollCommands.DELETE })
  async deletePoll(@Payload('id') id: string) {
    await this.pollService.remove(id);
    return { success: true };
  }

  @MessagePattern({ cmd: PollCommands.FIND })
  async findPoll(@Payload('id') id: string) {
    return await this.pollService.findOne(id);
  }

  @MessagePattern({ cmd: PollCommands.FIND_MANY })
  async findManyPolls(@Payload('profileId') profileId?: string) {
    return await this.pollService.findMany(profileId);
  }

  @MessagePattern({ cmd: PollCommands.VOTE })
  async votePoll(data: VotePollDto) {
    return await this.pollService.vote(data);
  }

  @MessagePattern({ cmd: PollCommands.REMOVE_VOTE })
  async removeVotePoll(
    @Payload('pollId') pollId: string,
    @Payload('userId') userId: string
  ) {
    return await this.pollService.removeVote(pollId, userId);
  }

  // PostShare handlers
  @MessagePattern({ cmd: PostShareCommands.CREATE })
  async createPostShare(data: CreatePostShareDto & { userId: string }) {
    if (!data.sharedById || !data.userId) {
      throw new RpcException({
        statusCode: 403,
        message: 'Authenticated share identity is required',
      });
    }
    const scope = await this.buildPostVisibilityScope(data.sharedById);
    const source = await this.postService.findOne(data.originalPostId, {
      where: visiblePostWhere(scope),
    });
    if (!source)
      throw new RpcException({
        statusCode: 404,
        message: 'The original post is not available to share',
      });
    const sourceCommunity = source.communityId
      ? await this.communityService.findOne(source.communityId)
      : undefined;
    const sourceMemberOnly =
      !!source.communityId &&
      (!!sourceCommunity?.isPrivate ||
        source.visibility === 'community' ||
        (source.visibility === 'public' &&
          source.publicAudienceExplicit === false));
    const safeDefault = sourceMemberOnly
      ? 'community'
      : source.visibility === 'followers'
      ? 'followers'
      : 'public';
    const requestedVisibility = data.visibility ?? safeDefault;
    if (!['public', 'followers', 'community'].includes(requestedVisibility)) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid share visibility',
      });
    }
    if (
      requestedVisibility === 'public' &&
      (sourceMemberOnly || source.visibility === 'followers')
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'A restricted post cannot be shared publicly',
      });
    }
    if (requestedVisibility === 'community') {
      const targetCommunityId = data.communityId ?? source.communityId;
      if (!targetCommunityId) {
        throw new RpcException({
          statusCode: 400,
          message: 'Community shares require a target community',
        });
      }
      if (sourceMemberOnly && targetCommunityId !== source.communityId) {
        throw new RpcException({
          statusCode: 403,
          message: 'A member-only post can only be shared in its community',
        });
      }
      if (
        !(await this.communityService.isMember(targetCommunityId, data.userId))
      ) {
        throw new RpcException({
          statusCode: 403,
          message: 'Community membership is required to share here',
        });
      }
      data.communityId = targetCommunityId;
    } else {
      data.communityId = undefined;
    }
    data.visibility = requestedVisibility;
    return await this.postShareService.create(data);
  }

  @MessagePattern({ cmd: PostShareCommands.DELETE })
  async deletePostShare(
    @Payload('id') id: string,
    @Payload('sharedById') sharedById: string
  ) {
    await this.postShareService.remove(id, sharedById);
    return { success: true };
  }

  @MessagePattern({ cmd: PostShareCommands.FIND_BY_POST })
  async findPostSharesByPost(data: {
    originalPostId: string;
    profileId?: string;
    userId?: string;
  }) {
    return this.filterVisibleShares(
      await this.postShareService.findByPost(data.originalPostId),
      data.profileId,
      data.userId
    );
  }

  @MessagePattern({ cmd: PostShareCommands.FIND_BY_PROFILE })
  async findPostSharesByProfile(data: {
    sharedById: string;
    profileId?: string;
    userId?: string;
  }) {
    return this.filterVisibleShares(
      await this.postShareService.findByProfile(data.sharedById),
      data.profileId,
      data.userId
    );
  }

  private async filterVisibleShares(
    shares: any[],
    profileId?: string,
    userId?: string
  ) {
    if (!profileId || !userId) return [];
    const scope = await this.buildPostVisibilityScope(profileId);
    const visible: any[] = [];
    for (const share of shares) {
      if (scope.blockedProfileIds.includes(share.sharedById)) continue;
      const source = await this.postService.findOne(share.originalPostId, {
        where: visiblePostWhere(scope),
      });
      if (!source) continue;
      if (
        share.visibility === 'followers' &&
        share.sharedById !== profileId &&
        !scope.followedProfileIds.includes(share.sharedById)
      )
        continue;
      if (
        share.visibility === 'community' &&
        (!share.communityId ||
          !(await this.communityService.isMember(share.communityId, userId)))
      )
        continue;
      visible.push(share);
    }
    return visible;
  }

  // Event handlers
  @MessagePattern({ cmd: EventCommands.CREATE })
  async createEvent(data: CreateEventDto) {
    return await this.eventService.create(data);
  }

  @MessagePattern({ cmd: EventCommands.UPDATE })
  async updateEvent(
    @Payload('id') id: string,
    @Payload('data') data: UpdateEventDto
  ) {
    return await this.eventService.update(id, data);
  }

  @MessagePattern({ cmd: EventCommands.DELETE })
  async deleteEvent(@Payload('id') id: string) {
    await this.eventService.remove(id);
    return { success: true };
  }

  @MessagePattern({ cmd: EventCommands.FIND })
  async findEvent(@Payload('id') id: string) {
    return await this.eventService.findOne(id);
  }

  @MessagePattern({ cmd: EventCommands.FIND_MANY })
  async findManyEvents(
    @Payload()
    options?: {
      profileId?: string;
      communityId?: string;
      status?: EventStatus;
      upcoming?: boolean;
    }
  ) {
    return await this.eventService.findMany(options);
  }

  @MessagePattern({ cmd: EventCommands.FIND_UPCOMING })
  async findUpcomingEvents(@Payload('limit') limit: number = 10) {
    return await this.eventService.findUpcoming(limit);
  }

  @MessagePattern({ cmd: EventCommands.ATTEND })
  async attendEvent(
    @Payload('eventId') eventId: string,
    @Payload('profileId') profileId: string
  ) {
    return await this.eventService.attend(eventId, profileId);
  }

  @MessagePattern({ cmd: EventCommands.UNATTEND })
  async unattendEvent(
    @Payload('eventId') eventId: string,
    @Payload('profileId') profileId: string
  ) {
    return await this.eventService.unattend(eventId, profileId);
  }

  @MessagePattern({ cmd: EventCommands.IS_ATTENDING })
  async isAttendingEvent(
    @Payload('eventId') eventId: string,
    @Payload('profileId') profileId: string
  ) {
    return await this.eventService.isAttending(eventId, profileId);
  }

  // ScheduledPost handlers
  @MessagePattern({ cmd: ScheduledPostCommands.CREATE })
  async createScheduledPost(data: CreateScheduledPostDto) {
    return await this.postService.createScheduledPost({
      title: data.title,
      content: data.content,
      profileId: data.profileId,
      userId: data.userId,
      scheduledAt: new Date(data.scheduledAt),
      visibility: data.visibility,
      communityId: data.communityId,
      attachmentIds: data.attachmentIds,
    });
  }

  @MessagePattern({ cmd: ScheduledPostCommands.UPDATE })
  async updateScheduledPost(
    @Payload('id') id: string,
    @Payload('data') data: UpdateScheduledPostDto
  ) {
    return await this.postService.updateScheduledPost(id, {
      title: data.title,
      content: data.content,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      visibility: data.visibility,
      communityId: data.communityId,
    });
  }

  @MessagePattern({ cmd: ScheduledPostCommands.DELETE })
  async deleteScheduledPost(@Payload('id') id: string) {
    await this.postService.deleteScheduledPost(id);
    return { success: true };
  }

  @MessagePattern({ cmd: ScheduledPostCommands.FIND })
  async findScheduledPost(@Payload('id') id: string) {
    return await this.postService.findOne(id);
  }

  @MessagePattern({ cmd: ScheduledPostCommands.FIND_MANY })
  async findManyScheduledPosts(@Payload('profileId') profileId?: string) {
    return await this.postService.findScheduledPosts(profileId);
  }

  @MessagePattern({ cmd: ScheduledPostCommands.PUBLISH })
  async publishScheduledPost(@Payload('id') id: string) {
    return await this.postService.publishScheduledPost(id);
  }

  // Business content handlers (O13/E14 — social owns content reads)
  @MessagePattern({ cmd: BusinessContentCommands.PAGE_GET })
  async getBusinessPage(@Payload() data: { communityId: string }) {
    return await this.businessContentService.getBusinessPage(data.communityId);
  }

  @MessagePattern({ cmd: BusinessContentCommands.PAGE_CREATE })
  async createBusinessPage(
    @Payload()
    data: {
      communityId: string;
      ownerId: string;
      tier?: string;
      paymentsBusinessPageId?: string;
    }
  ) {
    return await this.businessContentService.createBusinessPage(data);
  }

  @MessagePattern({ cmd: BusinessContentCommands.PAGE_UPDATE })
  async updateBusinessPage(
    @Payload()
    data: {
      communityId: string;
      ownerId: string;
      data: Record<string, unknown>;
    }
  ) {
    return await this.businessContentService.updateBusinessPage(
      data.communityId,
      data.ownerId,
      data.data
    );
  }

  @MessagePattern({ cmd: BusinessContentCommands.PAGES_BY_COMMUNITIES })
  async getBusinessPagesByCommunities(
    @Payload() data: { communityIds: string[] }
  ) {
    return await this.businessContentService.getBusinessPagesByCommunityIds(
      data.communityIds ?? []
    );
  }

  @MessagePattern({ cmd: BusinessContentCommands.THEME_GET })
  async getBusinessTheme(@Payload() data: { businessPageId: string }) {
    return await this.businessContentService.getBusinessTheme(
      data.businessPageId
    );
  }

  @MessagePattern({ cmd: BusinessContentCommands.THEME_CREATE })
  async createBusinessTheme(
    @Payload()
    data: {
      businessPageId: string;
      personalityId?: string;
      primaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      customCss?: string;
      customFontFamily?: string;
    }
  ) {
    return await this.businessContentService.createBusinessTheme(data);
  }

  @MessagePattern({ cmd: BusinessContentCommands.SPONSORSHIP_ACTIVE })
  async getActiveSponsorships(@Payload() data: { communityId: string }) {
    return await this.businessContentService.getActiveSponsorships(
      data.communityId
    );
  }

  @MessagePattern({ cmd: BusinessContentCommands.SPONSORSHIP_USER })
  async getUserSponsorships(@Payload() data: { userId: string }) {
    return await this.businessContentService.getUserSponsorships(data.userId);
  }

  @MessagePattern({ cmd: BusinessContentCommands.SPONSORSHIP_CREATE })
  async createSponsorship(
    @Payload()
    data: {
      communityId: string;
      businessPageId?: string;
      userId: string;
      type: string;
      adContent?: string;
      months?: number;
      paymentsSponsorshipId?: string;
    }
  ) {
    return await this.businessContentService.createSponsorship(data);
  }
}
