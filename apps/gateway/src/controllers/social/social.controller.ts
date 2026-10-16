import {
  Body,
  Controller,
  Inject,
  Post,
  Put,
  Delete,
  UseGuards,
  Req,
  Optional,
  Query,
  Logger,
  Get,
  Param,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AttachmentCommands,
  CommentCommands,
  PostCommands,
  ServiceTokens,
  VoteCommands,
  ReactionCommands,
  CommunityCommands,
  GuardianContentCommands,
} from '@optimistic-tanuki/constants';
import { SocialGateway } from '../../app/social-gateway/social.gateway';
import {
  CreateGuardianCommentDto,
  CreateGuardianPostDto,
  UpdateGuardianCommentDto,
  UpdateGuardianPostDto,
} from './dto/guardian-content.dto';
import {
  AttachmentDto,
  CommentDto,
  CreateAttachmentDto,
  CreateCommentDto,
  CreatePostDto,
  CreateReactionDto,
  CreateVoteDto,
  PostDto,
  ReactionDto,
  SearchAttachmentDto,
  SearchCommentDto,
  SearchPostDto,
  SearchPostOptions,
  UpdateAttachmentDto,
  UpdateCommentDto,
  UpdatePostDto,
  VoteDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { AppScope } from '../../decorators/appscope.decorator';
import { Public } from '../../decorators/public.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import {
  PermissionTarget,
  RequirePermissions,
} from '../../decorators/permissions.decorator';
import { Throttle } from '@nestjs/throttler';
import { IdentityThrottlerGuard } from '../learning/identity-throttler.guard';
import { gatewayWriteLimit } from '../../app/throttler-config';

// IMPORTANT: overrides must be keyed to a throttler NAME configured in the
// gateway's ThrottlerModule (`short`/`medium`/`long` in app.module.ts). The
// guard only consults metadata for configured names, so `{ default: ... }`
// is silently ignored here. We override `long` (the 60s window throttler).
const VOTE_THROTTLE = {
  long: {
    limit: gatewayWriteLimit('THROTTLE_SOCIAL_VOTE_LIMIT', 20, 500, 2000),
    ttl: 60000,
  },
};
const POST_THROTTLE = {
  long: {
    limit: gatewayWriteLimit('THROTTLE_SOCIAL_POST_LIMIT', 30, 500, 2000),
    ttl: 60000,
  },
};
const REACTION_THROTTLE = {
  long: {
    limit: gatewayWriteLimit('THROTTLE_SOCIAL_REACTION_LIMIT', 60, 1000, 2000),
    ttl: 60000,
  },
};
const COMMENT_THROTTLE = {
  long: {
    limit: gatewayWriteLimit('THROTTLE_SOCIAL_COMMENT_LIMIT', 20, 500, 2000),
    ttl: 60000,
  },
};

@UseGuards(AuthGuard, PermissionsGuard)
@ApiTags('social')
@Controller('social')
export class SocialController {
  private readonly l = new Logger(SocialController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Optional() private readonly socialGateway?: SocialGateway
  ) {}

  private invalidateSocialContent(): void {
    void Promise.resolve(
      this.socialGateway?.broadcastSocialContentInvalidated()
    )
      .catch(() => this.l.warn('Live social invalidation unavailable'));
  }

  private async requireVisiblePost(postId: string, viewerProfileId?: string) {
    if (typeof postId !== 'string' || postId.trim().length === 0) {
      throw new NotFoundException('Post not found');
    }
    const post = await firstValueFrom(
      this.socialClient.send(
        { cmd: PostCommands.FIND },
        { id: postId, viewerProfileId }
      )
    );
    if (!post || post.id !== postId) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  @UseGuards(AuthGuard)
  @ApiTags('post')
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({
    status: 201,
    description: 'The post has been successfully created.',
    type: PostDto,
  })
  @Post('post')
  @RequirePermissions('social.post.create')
  @PermissionTarget('body', 'communityId')
  @UseGuards(IdentityThrottlerGuard)
  @Throttle(POST_THROTTLE)
  async post(@User() user, @Body() postDto: CreatePostDto) {
    if (!user?.userId || !user?.profileId || !user?.appId) {
      throw new ForbiddenException('A verified Social application session is required');
    }
    this.l.log(`Creating post for user: ${user.userId}`);
    postDto.userId = user.userId;
    postDto.profileId = user.profileId;
    postDto.appScope = user.appId;
    this.l.log(`Post Data: ${JSON.stringify(postDto)}`);
    const result = await firstValueFrom(
      this.socialClient.send({ cmd: PostCommands.CREATE }, postDto)
    );

    // Broadcast post created event via WebSocket
    if (this.socialGateway && result) {
      await Promise.resolve(this.socialGateway.broadcastPostCreated(result))
        .catch(() => this.l.warn('Live post delivery unavailable'));
    }

    return result;
  }

  @UseGuards(AuthGuard)
  @ApiTags('vote')
  @ApiOperation({
    summary: 'Create a new vote',
    description:
      'Value can be -1, 0, or 1, -1 for down, 0 for delete vote, and 1 for an up vote',
  })
  @ApiResponse({
    status: 201,
    description: 'The vote has been successfully created.',
    type: VoteDto,
  })
  @Post('vote')
  @UseGuards(IdentityThrottlerGuard)
  @RequirePermissions('social.vote.create')
  @Throttle(VOTE_THROTTLE)
  async vote(@User() user: UserDetails, @Body() voteDto: CreateVoteDto) {
    this.l.debug('Vote Received. Vote DTO: ' + JSON.stringify(voteDto));
    await this.requireVisiblePost(voteDto.postId, user.profileId);
    voteDto.userId = user.userId;
    voteDto.profileId = user.profileId;
    const commandMap = {
      '-1': VoteCommands.DOWNVOTE,
      '0': VoteCommands.UNVOTE,
      '1': VoteCommands.UPVOTE,
    };
    const result = await firstValueFrom(
      this.socialClient.send(
        { cmd: commandMap[voteDto.value.toString()] },
        voteDto
      )
    );

    // Broadcast vote updated event via WebSocket
    if (this.socialGateway && result) {
      await Promise.resolve(this.socialGateway.broadcastVoteUpdated(result))
        .catch(() => this.l.warn('Live vote delivery unavailable'));
    }

    return result;
  }

  @UseGuards(AuthGuard)
  @ApiTags('reaction')
  @ApiOperation({ summary: 'Add or update a reaction' })
  @ApiResponse({
    status: 201,
    description: 'The reaction has been successfully added/updated.',
    type: ReactionDto,
  })
  @Post('reaction')
  @UseGuards(IdentityThrottlerGuard)
  @Throttle(REACTION_THROTTLE)
  async reaction(
    @User() user: UserDetails,
    @Body() reactionDto: CreateReactionDto
  ) {
    reactionDto.userId = user.userId;
    const result = await firstValueFrom(
      this.socialClient.send({ cmd: ReactionCommands.ADD }, reactionDto)
    );
    return result;
  }

  @ApiTags('reaction')
  @ApiOperation({ summary: 'Get reactions for a post' })
  @ApiResponse({
    status: 200,
    description: 'The reactions have been successfully retrieved.',
    type: [ReactionDto],
  })
  @Public()
  @Get('reactions/post/:postId')
  async getReactionsByPost(
    @Param('postId') postId: string,
    @Req() req?: { user?: { profileId?: string } }
  ): Promise<ReactionDto[]> {
    await this.requireVisiblePost(postId, req?.user?.profileId);
    return await firstValueFrom(
      this.socialClient.send({ cmd: ReactionCommands.GET_BY_POST }, { postId })
    );
  }

  @ApiTags('reaction')
  @ApiOperation({ summary: 'Get reaction counts for a post' })
  @ApiResponse({
    status: 200,
    description: 'The reaction counts have been successfully retrieved.',
  })
  @Public()
  @Get('reactions/post/:postId/counts')
  async getReactionCounts(
    @Param('postId') postId: string,
    @Req() req?: { user?: { profileId?: string } }
  ): Promise<{ [value: number]: number }> {
    await this.requireVisiblePost(postId, req?.user?.profileId);
    return await firstValueFrom(
      this.socialClient.send({ cmd: ReactionCommands.GET }, { postId })
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('reaction')
  @ApiOperation({ summary: 'Get current user reaction for a post' })
  @ApiResponse({
    status: 200,
    description: 'The user reaction has been successfully retrieved.',
    type: ReactionDto,
  })
  @Get('reaction/post/:postId/user')
  async getUserReaction(
    @Param('postId') postId: string,
    @User() user: UserDetails
  ): Promise<ReactionDto | null> {
    await this.requireVisiblePost(postId, user.profileId);
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: ReactionCommands.GET_USER_REACTION },
        { userId: user.userId, postId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('comment')
  @ApiOperation({ summary: 'Create a new comment' })
  @ApiResponse({
    status: 201,
    description: 'The comment has been successfully created.',
    type: CommentDto,
  })
  @Post('comment')
  @RequirePermissions('social.comment.create')
  @UseGuards(IdentityThrottlerGuard)
  @Throttle(COMMENT_THROTTLE)
  async comment(
    @User() user: UserDetails,
    @Body() commentDto: CreateCommentDto
  ) {
    await this.requireVisiblePost(commentDto.postId, user.profileId);
    const finalComment: CreateCommentDto = {
      ...commentDto,
      userId: user.userId,
      profileId: user.profileId,
    };
    console.log('🚀 ~ SocialController ~ comment ~ commentDto:', finalComment);
    const result = await firstValueFrom(
      this.socialClient.send({ cmd: CommentCommands.CREATE }, finalComment)
    );

    // Broadcast comment created event via WebSocket
    if (this.socialGateway && result) {
      await Promise.resolve(this.socialGateway.broadcastCommentCreated(result))
        .catch(() => this.l.warn('Live comment delivery unavailable'));
    }

    return result;
  }

  @UseGuards(AuthGuard)
  @ApiTags('attachment')
  @ApiOperation({ summary: 'Create a new attachment' })
  @ApiResponse({
    status: 201,
    description: 'The attachment has been successfully created.',
    type: AttachmentDto,
  })
  @Post('attachment')
  async attachment(
    @User() user: UserDetails,
    @Body() attachmentDto: CreateAttachmentDto
  ) {
    const { postId, ...attachment } = attachmentDto;
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: AttachmentCommands.CREATE },
        {
          attachment,
          postId,
          actor: this.attachmentActor(user),
        }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('post')
  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiResponse({
    status: 200,
    description: 'The post has been successfully retrieved.',
    type: PostDto,
  })
  @Get('post/:id')
  async getPost(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<PostDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PostCommands.FIND },
        { id, viewerProfileId: user?.profileId }
      )
    );
  }

  @ApiTags('post')
  @ApiOperation({ summary: 'Get a shared post by ID (public)' })
  @ApiResponse({
    status: 200,
    description: 'The shared post has been successfully retrieved.',
    type: PostDto,
  })
  // Public so anonymous viewers and shared-by-link access still work, but the
  // class-level AuthGuard still runs to OPTIONALLY attach a signature-verified
  // `request.user` when a valid token is present. We read the viewer id from
  // that guard-verified context — never from the `@User()` decorator, which
  // decodes the token WITHOUT verifying its signature and would let a forged
  // `profileId` unlock another owner's private/unlisted post.
  @Public()
  @Get('post/:id/shared')
  async getSharedPost(
    @Param('id') id: string,
    @Req() req?: { user?: { profileId?: string } }
  ): Promise<PostDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PostCommands.FIND },
        { id, viewerProfileId: req?.user?.profileId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('comment')
  @ApiOperation({ summary: 'Get a comment by ID' })
  @ApiResponse({
    status: 200,
    description: 'The comment has been successfully retrieved.',
    type: CommentDto,
  })
  @Get('comment/:id')
  async getComment(
    @Param('id') id: string,
    @User() user?: UserDetails
  ): Promise<CommentDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommentCommands.FIND },
        { id, viewerProfileId: user?.profileId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('vote')
  @ApiOperation({ summary: 'Get a vote by ID' })
  @ApiResponse({
    status: 200,
    description: 'The vote has been successfully retrieved.',
    type: VoteDto,
  })
  @Get('vote/:id')
  async getVote(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<VoteDto> {
    const vote = await firstValueFrom(
      this.socialClient.send({ cmd: VoteCommands.GET }, { id })
    );
    if (!vote) throw new NotFoundException('Vote not found');
    const parentPostId = vote.post?.id ?? vote.postId ?? vote.comment?.post?.id;
    await this.requireVisiblePost(parentPostId, user.profileId);
    return vote;
  }

  @UseGuards(AuthGuard)
  @ApiTags('vote')
  @ApiOperation({
    summary: 'Find votes for a post or the current user vote for a post',
  })
  @ApiResponse({
    status: 200,
    description: 'Votes have been successfully retrieved.',
  })
  @Post('vote/find')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        postId: { type: 'string' },
        userId: { type: 'string' },
        profileId: { type: 'string' },
      },
    },
  })
  async findVotes(
    @User() user: UserDetails,
    @Body() body: { postId?: string; userId?: string; profileId?: string }
  ): Promise<VoteDto[] | VoteDto | null> {
    if (!body?.postId) {
      return [];
    }

    await this.requireVisiblePost(body.postId, user.profileId);

    const votes = await firstValueFrom(
      this.socialClient.send({ cmd: VoteCommands.GET }, { postid: body.postId })
    );

    if (!body.userId && !body.profileId) {
      return votes;
    }

    const requestedProfileId = body.profileId || body.userId || user.profileId;
    return (
      votes.find(
        (vote: VoteDto & { profileId?: string; userId?: string }) =>
          vote.profileId === requestedProfileId ||
          vote.userId === body.userId ||
          vote.userId === user.userId
      ) || null
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('attachment')
  @ApiOperation({ summary: 'Get an attachment by ID' })
  @ApiResponse({
    status: 200,
    description: 'The attachment has been successfully retrieved.',
    type: AttachmentDto,
  })
  @Get('attachment/:id')
  async getAttachment(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<AttachmentDto> {
    const attachment = await firstValueFrom(
      this.socialClient.send(
        { cmd: AttachmentCommands.FIND },
        { id, appId: user.appId }
      )
    );
    if (!attachment) throw new NotFoundException('Attachment not found');
    const parentPostId = attachment.post?.id ?? attachment.postId;
    await this.requireVisiblePost(parentPostId, user.profileId);
    return attachment;
  }

  @ApiTags('post')
  @ApiOperation({ summary: 'Search for posts' })
  @ApiResponse({
    status: 200,
    description: 'The posts have been successfully retrieved.',
    type: [PostDto],
  })
  // Public + guard-verified-optional identity, same rationale as
  // getSharedPost above: never trust the raw `@User()` decode for the
  // viewer-scoped visibility filter applied by the social service.
  @Public()
  @Post('post/find')
  @ApiExtraModels(SearchPostDto, SearchPostOptions)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        criteria: { $ref: getSchemaPath(SearchPostDto) },
        opts: { $ref: getSchemaPath(SearchPostOptions) },
      },
      required: ['criteria'],
    },
  })
  async searchPosts(
    @Body() body: { criteria: SearchPostDto; opts?: SearchPostOptions },
    @Req() req?: { user?: { profileId?: string } }
  ): Promise<PostDto[]> {
    const searchCriteria = body?.criteria;
    const opts = body?.opts;
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PostCommands.FIND_MANY },
        {
          criteria: searchCriteria,
          opts: opts,
          viewerProfileId: req?.user?.profileId,
        }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('feed')
  @ApiOperation({ summary: 'Get personalized feed' })
  @ApiResponse({
    status: 200,
    description: 'The feed has been successfully retrieved.',
    type: [PostDto],
  })
  @Get('feed')
  async getFeed(
    @User() user: UserDetails,
    @AppScope() appScope: string,
    @Query('includePublic') includePublic?: string,
    @Query('includeFollowing') includeFollowing?: string,
    @Query('includeCommunities') includeCommunities?: string,
    @Query('communityIds') communityIds?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<PostDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.GET_FEED },
        {
          userId: user.userId,
          profileId: user.profileId,
          appScope,
          includePublic: includePublic !== 'false',
          includeFollowing: includeFollowing === 'true',
          includeCommunities: includeCommunities !== 'false',
          communityIds: communityIds
            ? communityIds.split(',').filter(Boolean)
            : undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
          offset: offset ? parseInt(offset, 10) : undefined,
        }
      )
    );
  }

  @ApiTags('comment')
  @ApiOperation({ summary: 'Search for comments' })
  @ApiResponse({
    status: 200,
    description: 'The comments have been successfully retrieved.',
    type: [CommentDto],
  })
  // Public + guard-verified-optional identity, same rationale as
  // getSharedPost above: never trust the raw `@User()` decode for the
  // viewer-scoped visibility filter applied by the social service.
  @Public()
  @Post('comments/find')
  async searchComments(
    @Body() searchCriteria: SearchCommentDto,
    @Req() req?: { user?: { profileId?: string } }
  ): Promise<CommentDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommentCommands.FIND_MANY },
        { ...searchCriteria, viewerProfileId: req?.user?.profileId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('attachment')
  @ApiOperation({ summary: 'Search for attachments' })
  @ApiResponse({
    status: 200,
    description: 'The attachments have been successfully retrieved.',
    type: [AttachmentDto],
  })
  @Post('attachments/find')
  async searchAttachments(
    @Body() searchCriteria: SearchAttachmentDto,
    @User() user: UserDetails
  ): Promise<AttachmentDto[]> {
    const attachments = await firstValueFrom(
      this.socialClient.send(
        { cmd: AttachmentCommands.FIND_MANY },
        { criteria: searchCriteria, appId: user.appId }
      )
    );
    const visible = await Promise.all(
      (attachments ?? []).map(async (attachment) => {
        try {
          const parentPostId = attachment.post?.id ?? attachment.postId;
          await this.requireVisiblePost(parentPostId, user.profileId);
          return attachment;
        } catch {
          return null;
        }
      })
    );
    return visible.filter(
      (attachment): attachment is AttachmentDto => !!attachment
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('post')
  @ApiOperation({ summary: 'Update a post by ID' })
  @ApiResponse({
    status: 200,
    description: 'The post has been successfully updated.',
    type: PostDto,
  })
  @Put('post/update/:id')
  @RequirePermissions('social.post.update')
  async updatePost(
    @Param('id') id: string,
    @User() user: UserDetails,
    @Body() updatePostDto: UpdatePostDto
  ): Promise<PostDto> {
    await this.requireVisiblePost(id, user.profileId);
    const result = await firstValueFrom(
      this.socialClient.send(
        { cmd: PostCommands.UPDATE },
        {
          id,
          data: updatePostDto,
          userId: user.userId,
          profileId: user.profileId,
        }
      )
    );

    // Broadcast post updated event via WebSocket
    if (this.socialGateway && result) {
      await Promise.resolve(this.socialGateway.broadcastPostUpdated(result))
        .catch(() => this.l.warn('Live post delivery unavailable'));
    }

    return result;
  }

  @UseGuards(AuthGuard)
  @ApiTags('comment')
  @ApiOperation({ summary: 'Update a comment by ID' })
  @ApiResponse({
    status: 200,
    description: 'The comment has been successfully updated.',
    type: CommentDto,
  })
  @Put('comment/update/:id')
  async updateComment(
    @Param('id') id: string,
    @User() user: UserDetails,
    @Body() updateCommentDto: UpdateCommentDto
  ): Promise<CommentDto> {
    const comment = await firstValueFrom(
      this.socialClient.send(
        { cmd: CommentCommands.FIND },
        { id, viewerProfileId: user.profileId }
      )
    );
    if (!comment) throw new NotFoundException('Comment not found');
    await this.requireVisiblePost(
      comment.post?.id ?? comment.postId,
      user.profileId
    );
    await firstValueFrom(
      this.socialClient.send(
        { cmd: CommentCommands.UPDATE },
        { id, update: updateCommentDto, userId: user.userId, profileId: user.profileId }
      )
    );

    this.invalidateSocialContent();
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommentCommands.FIND },
        { id, viewerProfileId: user.profileId }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('attachment')
  @ApiOperation({ summary: 'Update an attachment by ID' })
  @ApiResponse({
    status: 200,
    description: 'The attachment has been successfully updated.',
    type: AttachmentDto,
  })
  @Put('attachment/update/:id')
  async updateAttachment(
    @Param('id') id: string,
    @User() user: UserDetails,
    @Body() updateAttachmentDto: UpdateAttachmentDto
  ): Promise<AttachmentDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: AttachmentCommands.UPDATE },
        {
          id,
          update: updateAttachmentDto,
          actor: this.attachmentActor(user),
        }
      )
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('post')
  @ApiOperation({ summary: 'Delete a post by ID' })
  @ApiResponse({
    status: 200,
    description: 'The post has been successfully deleted.',
  })
  @Delete('post/:id')
  async deletePost(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<void> {
    const result = await firstValueFrom(
      this.socialClient.send(
        { cmd: PostCommands.DELETE },
        { id, userId: user.userId, profileId: user.profileId }
      )
    );

    // Broadcast post deleted event via WebSocket
    if (this.socialGateway) {
      await Promise.resolve(this.socialGateway.broadcastPostDeleted(id))
        .catch(() => this.l.warn('Live post delivery unavailable'));
    }

    return result;
  }

  @UseGuards(AuthGuard)
  @ApiTags('comment')
  @ApiOperation({
    summary: 'Delete a comment by ID',
    description:
      'Deletes a comment. Optional postId query parameter can be provided to avoid an additional API call for WebSocket broadcasting.',
  })
  @ApiResponse({
    status: 200,
    description: 'The comment has been successfully deleted.',
  })
  @Delete('comment/:id')
  async deleteComment(
    @Param('id') id: string,
    @User() user: UserDetails,
    @Query('postId') _postId?: string
  ): Promise<void> {
    let commentPostId: string | undefined;
    try {
      const comment = await firstValueFrom(
        this.socialClient.send(
          { cmd: CommentCommands.FIND },
          { id, viewerProfileId: user.profileId }
        )
      );
      commentPostId = comment?.post?.id ?? comment?.postId;
    } catch (error) {
      this.l.warn('Unable to resolve comment parent before deletion');
    }

    const result = await firstValueFrom(
      this.socialClient.send({ cmd: CommentCommands.DELETE }, { id, userId: user.userId, profileId: user.profileId })
    );

    // Broadcast comment deleted event via WebSocket
    if (this.socialGateway) {
      if (commentPostId) {
        await Promise.resolve(
          this.socialGateway.broadcastCommentDeleted(id, commentPostId)
        )
          .catch(() => this.l.warn('Live comment delivery unavailable'));
      } else {
        this.invalidateSocialContent();
      }
    }

    return result;
  }

  @UseGuards(AuthGuard)
  @ApiTags('attachment')
  @ApiOperation({ summary: 'Delete an attachment by ID' })
  @ApiResponse({
    status: 200,
    description: 'The attachment has been successfully deleted.',
  })
  @Delete('attachment/:id')
  async deleteAttachment(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<{ id: string; deleted: true }> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: AttachmentCommands.DELETE },
        { id, actor: this.attachmentActor(user) }
      )
    );
  }

  private attachmentActor(user: UserDetails) {
    if (!user?.userId || !user?.profileId || !user?.appId) {
      throw new ForbiddenException('A verified Social application session is required');
    }
    return {
      userId: user.userId,
      profileId: user.profileId,
      appId: user.appId,
    };
  }

  private guardianActor(user: UserDetails, targetProfileId: string) {
    if (!user?.userId || !['client-interface', 'local-hub'].includes(user.appId ?? '')) {
      throw new ForbiddenException('A verified guardian application context is required');
    }
    return { actorUserId: user.userId, targetProfileId, appId: user.appId };
  }

  @UseGuards(AuthGuard)
  @Get('guardian/content/profiles/:profileId/posts')
  async listGuardianPosts(@Param('profileId') profileId: string, @User() user: UserDetails) {
    return firstValueFrom(this.socialClient.send({ cmd: GuardianContentCommands.ListPosts }, this.guardianActor(user, profileId)));
  }

  @UseGuards(AuthGuard)
  @Get('guardian/content/profiles/:profileId/posts/:postId')
  async getGuardianPost(@Param('profileId') profileId: string, @Param('postId') postId: string, @User() user: UserDetails) {
    const post = await firstValueFrom(this.socialClient.send({ cmd: GuardianContentCommands.GetPost }, { ...this.guardianActor(user, profileId), id: postId }));
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  @UseGuards(AuthGuard)
  @Post('guardian/content/profiles/:profileId/posts')
  async createGuardianPost(@Param('profileId') profileId: string, @User() user: UserDetails, @Body() data: CreateGuardianPostDto) {
    return firstValueFrom(this.socialClient.send({ cmd: GuardianContentCommands.CreatePost }, { ...this.guardianActor(user, profileId), data }));
  }

  @UseGuards(AuthGuard)
  @Put('guardian/content/profiles/:profileId/posts/:postId')
  async updateGuardianPost(@Param('profileId') profileId: string, @Param('postId') postId: string, @User() user: UserDetails, @Body() data: UpdateGuardianPostDto) {
    const post = await firstValueFrom(this.socialClient.send({ cmd: GuardianContentCommands.UpdatePost }, { ...this.guardianActor(user, profileId), id: postId, data }));
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  @UseGuards(AuthGuard)
  @Delete('guardian/content/profiles/:profileId/posts/:postId')
  async deleteGuardianPost(@Param('profileId') profileId: string, @Param('postId') postId: string, @User() user: UserDetails) {
    const result = await firstValueFrom(this.socialClient.send({ cmd: GuardianContentCommands.DeletePost }, { ...this.guardianActor(user, profileId), id: postId }));
    if (!result) throw new NotFoundException('Post not found');
    return result;
  }

  @UseGuards(AuthGuard)
  @Get('guardian/content/profiles/:profileId/posts/:postId/comments')
  async listGuardianComments(@Param('profileId') profileId: string, @Param('postId') postId: string, @User() user: UserDetails) {
    return firstValueFrom(this.socialClient.send({ cmd: GuardianContentCommands.ListComments }, { ...this.guardianActor(user, profileId), postId }));
  }

  @UseGuards(AuthGuard)
  @Get('guardian/content/profiles/:profileId/comments/:commentId')
  async getGuardianComment(@Param('profileId') profileId: string, @Param('commentId') commentId: string, @User() user: UserDetails) {
    const comment = await firstValueFrom(this.socialClient.send({ cmd: GuardianContentCommands.GetComment }, { ...this.guardianActor(user, profileId), id: commentId }));
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  @UseGuards(AuthGuard)
  @Post('guardian/content/profiles/:profileId/posts/:postId/comments')
  async createGuardianComment(@Param('profileId') profileId: string, @Param('postId') postId: string, @User() user: UserDetails, @Body() data: CreateGuardianCommentDto) {
    return firstValueFrom(this.socialClient.send({ cmd: GuardianContentCommands.CreateComment }, { ...this.guardianActor(user, profileId), data: { ...data, postId } }));
  }

  @UseGuards(AuthGuard)
  @Put('guardian/content/profiles/:profileId/comments/:commentId')
  async updateGuardianComment(@Param('profileId') profileId: string, @Param('commentId') commentId: string, @User() user: UserDetails, @Body() data: UpdateGuardianCommentDto) {
    const comment = await firstValueFrom(this.socialClient.send({ cmd: GuardianContentCommands.UpdateComment }, { ...this.guardianActor(user, profileId), id: commentId, data }));
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  @UseGuards(AuthGuard)
  @Delete('guardian/content/profiles/:profileId/comments/:commentId')
  async deleteGuardianComment(@Param('profileId') profileId: string, @Param('commentId') commentId: string, @User() user: UserDetails) {
    const result = await firstValueFrom(this.socialClient.send({ cmd: GuardianContentCommands.DeleteComment }, { ...this.guardianActor(user, profileId), id: commentId }));
    if (!result) throw new NotFoundException('Comment not found');
    return result;
  }
}
