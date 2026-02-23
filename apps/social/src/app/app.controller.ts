import { Controller, Get, Logger } from '@nestjs/common';

import { PostService } from './services/post.service';
import { AttachmentService } from './services/attachment.service';
import { CommentService } from './services/comment.service';
import { VoteService } from './services/vote.service';
import { SocialComponentService } from './services/social-component.service';
import { CommunityService } from './services/community.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import {
  AttachmentCommands,
  CommentCommands,
  LinkCommands,
  PostCommands,
  VoteCommands,
  FollowCommands,
  SocialComponentCommands,
  CommunityCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateAttachmentDto,
  CreateCommentDto,
  CreateLinkDto,
  CreatePostDto,
  QueryFollowsDto,
  SearchAttachmentDto,
  SearchCommentDto,
  SearchPostDto,
  SearchPostOptions,
  UpdateAttachmentDto,
  UpdateCommentDto,
  UpdateFollowDto,
  UpdateLinkDto,
  UpdatePostDto,
  CreateSocialComponentDto,
  UpdateSocialComponentDto,
  SocialComponentQueryDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  SearchCommunityDto,
  JoinCommunityDto,
  InviteToCommunityDto,
} from '@optimistic-tanuki/models';
import { postSearchDtoToFindManyOptions } from '../entities/post.entity';
import { transformSearchCommentDtoToFindOptions } from '../entities/comment.entity';
import { Attachment, toFindOptions } from '../entities/attachment.entity';
import { FindManyOptions, FindOneOptions, FindOptions, In } from 'typeorm';
import FollowService from './services/follow.service';

@Controller()
export class AppController {
  private readonly logger = new Logger('SocialAppController');
  constructor(
    private readonly postService: PostService,
    private readonly voteService: VoteService,
    private readonly attachmentService: AttachmentService,
    private readonly commentService: CommentService,
    private readonly followService: FollowService,
    private readonly socialComponentService: SocialComponentService,
    private readonly communityService: CommunityService
  ) {}

  @MessagePattern({ cmd: PostCommands.CREATE })
  async createPost(data: CreatePostDto) {
    return await this.postService.create(data);
  }

  @MessagePattern({ cmd: PostCommands.FIND_MANY })
  async findAllPosts(
    @Payload('criteria') data: SearchPostDto,
    @Payload('opts') opts?: SearchPostOptions
  ) {
    const searchOptions = postSearchDtoToFindManyOptions(data);

    // Apply pagination with defaults and max limits
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const limit = opts?.limit ? Math.min(opts.limit, MAX_LIMIT) : DEFAULT_LIMIT;

    searchOptions.take = limit;

    if (opts) {
      if (opts.offset) {
        searchOptions.skip = opts.offset;
      }
      if (opts.orderBy) {
        searchOptions.order = { [opts.orderBy]: opts.orderDirection || 'ASC' };
      }
    }
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

      const links = []; // Assuming links are not implemented yet

      post.votes = votes || [];
      post.comments = comments || [];
      post.attachments = attachments || [];
      post.links = links || [];
    }

    return posts;
  }

  @MessagePattern({ cmd: PostCommands.FIND })
  async findOnePost(
    @Payload('id') id: string,
    @Payload('options') options?: SearchPostDto
  ) {
    const search = options ? postSearchDtoToFindManyOptions(options) : {};
    return await this.postService.findOne(id, search);
  }

  @MessagePattern({ cmd: PostCommands.UPDATE })
  async updatePost(
    @Payload('id') id: string,
    @Payload('data') data: UpdatePostDto,
    @Payload('userId') userId: string
  ) {
    return await this.postService.update(id, data, userId);
  }

  @MessagePattern({ cmd: PostCommands.DELETE })
  async removePost(
    @Payload('id') id: string,
    @Payload('userId') userId: string
  ) {
    console.log(`Removing post with ID: ${id}`);
    try {
      return await this.postService.remove(id, userId);
    } catch (error) {
      console.error(`Error in removePost: ${error.message}`);
      throw error;
    }
  }

  @MessagePattern({ cmd: VoteCommands.UPVOTE })
  async upvotePost(
    @Payload('id') id: string,
    @Payload('userId') userId: string,
    @Payload('profileId') profileId: string
  ) {
    return await this.voteService.create({
      postId: id,
      value: 1,
      userId,
      profileId,
    });
  }

  @MessagePattern({ cmd: VoteCommands.DOWNVOTE })
  async downvotePost(
    @Payload('id') id: string,
    @Payload('userId') userId: string,
    @Payload('profileId') profileId: string
  ) {
    return await this.voteService.create({
      postId: id,
      value: -1,
      userId,
      profileId,
    });
  }

  @MessagePattern({ cmd: VoteCommands.UNVOTE })
  async unvotePost(@Payload('id') id: string) {
    return await this.voteService.remove(id);
  }

  @MessagePattern({ cmd: VoteCommands.GET })
  async getVote(@Payload('postid') id: string) {
    return await this.voteService.findAll({ where: { post: { id } } });
  }

  @MessagePattern({ cmd: CommentCommands.CREATE })
  async createComment(data: CreateCommentDto) {
    return await this.commentService.create(data);
  }

  @MessagePattern({ cmd: CommentCommands.FIND_MANY })
  async findAllComments(@Payload() data: SearchCommentDto) {
    const options = transformSearchCommentDtoToFindOptions(data);
    return await this.commentService.findAll(options);
  }

  @MessagePattern({ cmd: CommentCommands.FIND })
  async findOneComment(
    @Payload('id') id: string,
    @Payload('options') options?: SearchCommentDto
  ) {
    const search = transformSearchCommentDtoToFindOptions(options);
    return await this.commentService.findOne(id, search);
  }

  @MessagePattern({ cmd: CommentCommands.UPDATE })
  async updateComment(
    @Payload('id') id: string,
    @Payload('update') update: UpdateCommentDto
  ) {
    console.log('updateComment', id, update);
    return await this.commentService.update(id, update);
  }

  @MessagePattern({ cmd: CommentCommands.DELETE })
  async removeComment(@Payload('id') id: string) {
    return await this.commentService.remove(id);
  }

  @MessagePattern({ cmd: AttachmentCommands.CREATE })
  async createAttachment(
    @Payload('attachment') data: CreateAttachmentDto,
    @Payload('postId') postId: string
  ) {
    const post = await this.postService.findOne(postId);
    return await this.attachmentService.create(data, post);
  }

  @MessagePattern({ cmd: AttachmentCommands.FIND_MANY })
  async findAllAttachments(@Payload() options: SearchAttachmentDto) {
    const search = toFindOptions(options);
    return await this.attachmentService.findAll(
      search as FindManyOptions<Attachment>
    );
  }

  @MessagePattern({ cmd: AttachmentCommands.FIND })
  async findAttachment(
    @Payload('id') id: string,
    @Payload('options') opts: SearchAttachmentDto
  ) {
    const search = toFindOptions(opts);
    return await this.attachmentService.findOne(
      id,
      search as FindOneOptions<Attachment>
    );
  }

  @MessagePattern({ cmd: AttachmentCommands.UPDATE })
  async updateAttachment(
    @Payload('id') id: string,
    @Payload('update') update: UpdateAttachmentDto
  ) {
    return await this.attachmentService.update(id, update);
  }

  @MessagePattern({ cmd: AttachmentCommands.DELETE })
  async deleteAttachment(@Payload('id') id: string) {
    return await this.attachmentService.remove(id);
  }

  @MessagePattern({ cmd: LinkCommands.CREATE })
  async createLink(@Payload() dto: CreateLinkDto) {
    throw new RpcException('Link Object Not implemented');
  }

  @MessagePattern({ cmd: LinkCommands.UPDATE })
  async updateLink(
    @Payload('id') id: string,
    @Payload('link') dto: UpdateLinkDto
  ) {
    throw new Error('Link Object Not Implemented');
  }

  @MessagePattern({ cmd: LinkCommands.FIND })
  async findLink(@Payload('id') id: string) {
    throw new Error('Link Object Not Implemented');
  }

  @MessagePattern({ cmd: LinkCommands.FIND_MANY })
  async findAllLinks(@Payload() options: FindOptions) {
    throw new Error('Link Object Not Implemented');
  }

  @MessagePattern({ cmd: FollowCommands.FOLLOW })
  async follow(@Payload() data: UpdateFollowDto) {
    return await this.followService.follow(data.followerId, data.followeeId);
  }

  @MessagePattern({ cmd: FollowCommands.UNFOLLOW })
  async unfollow(@Payload() data: UpdateFollowDto) {
    return await this.followService.unfollow(data.followerId, data.followeeId);
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
      data.profileId,
      data.appScope
    );
  }

  @MessagePattern({ cmd: CommunityCommands.FIND })
  async findCommunity(@Payload('id') id: string) {
    return await this.communityService.findOne(id);
  }

  @MessagePattern({ cmd: CommunityCommands.FIND_MANY })
  async findAllCommunities(
    @Payload() data: { criteria: SearchCommunityDto; appScope: string }
  ) {
    return await this.communityService.findAll(data.criteria, data.appScope);
  }

  @MessagePattern({ cmd: CommunityCommands.GET_TOP_ACTIVE })
  async getTopActiveCommunities(
    @Payload() data: { limit: number; appScope: string }
  ) {
    return await this.communityService.getTopActive(data.limit, data.appScope);
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

  @MessagePattern({ cmd: CommunityCommands.GET_MEMBERS })
  async getCommunityMembers(@Payload('communityId') communityId: string) {
    return await this.communityService.getMembers(communityId);
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

  @MessagePattern({ cmd: CommunityCommands.INVITE })
  async inviteToCommunity(
    @Payload() data: { dto: InviteToCommunityDto; inviterId: string }
  ) {
    return await this.communityService.invite(data.dto, data.inviterId);
  }

  @MessagePattern({ cmd: CommunityCommands.CANCEL_INVITE })
  async cancelInvite(@Payload() data: { inviteId: string; userId: string }) {
    await this.communityService.cancelInvite(data.inviteId, data.userId);
    return { success: true };
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

  @MessagePattern({ cmd: CommunityCommands.GET_FEED })
  async getCommunityFeed(
    @Payload()
    data: {
      userId: string;
      appScope: string;
      includePublic?: boolean;
      includeFollowing?: boolean;
      includeCommunities?: boolean;
      limit?: number;
      offset?: number;
    }
  ) {
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const limit = data.limit ? Math.min(data.limit, MAX_LIMIT) : DEFAULT_LIMIT;
    const offset = data.offset || 0;

    const following = await this.followService.getFollowing(data.userId);
    const followingIds = following.map((f) => f.followeeId);

    const userCommunities = await this.communityService.getUserCommunities(
      data.userId,
      data.appScope
    );
    const communityIds = userCommunities.map((c) => c.id);

    const postRepo = this.postService['postRepo'];
    const qb = postRepo.createQueryBuilder('post');

    const conditions: string[] = [];
    const params: any = { userId: data.userId, followingIds, communityIds };

    if (data.includePublic !== false) {
      conditions.push(
        '(post.visibility = :public AND post.communityId IS NULL)'
      );
      params.public = 'public';
    }

    if (data.includeFollowing && followingIds.length > 0) {
      conditions.push(
        '(post.userId IN (:...followingIds) AND post.visibility = :followers)'
      );
      params.followers = 'followers';
    }

    if (data.includeCommunities && communityIds.length > 0) {
      conditions.push('post.communityId IN (:...communityIds)');
    }

    if (conditions.length === 0) {
      return [];
    }

    qb.where(conditions.join(' OR '), params);
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
}
