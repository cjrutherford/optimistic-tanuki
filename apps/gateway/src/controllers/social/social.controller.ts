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
} from '@optimistic-tanuki/constants';
import { SocialGateway } from '../../app/social-gateway/social.gateway';
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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { AppScope } from '../../decorators/appscope.decorator';
import { Public } from '../../decorators/public.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { Throttle } from '@nestjs/throttler';

@UseGuards(AuthGuard, PermissionsGuard)
@ApiTags('social')
@Controller('social')
export class SocialController {
  private readonly l = new Logger(SocialController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Optional() private readonly socialGateway?: SocialGateway
  ) { }

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
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // Increased for E2E
  async post(@User() user, @Body() postDto: CreatePostDto) {
    this.l.log(`Creating post for user: ${user.userId}`);
    postDto.userId = user.userId;
    this.l.log(`Post Data: ${JSON.stringify(postDto)}`);
    const result = await firstValueFrom(
      this.socialClient.send({ cmd: PostCommands.CREATE }, postDto)
    );

    // Broadcast post created event via WebSocket
    if (this.socialGateway && result) {
      this.socialGateway.broadcastPostCreated(result);
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
  @RequirePermissions('social.vote.create')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 votes per minute
  async vote(@User() user: UserDetails, @Body() voteDto: CreateVoteDto) {
    this.l.debug("Vote Received. Vote DTO: " + JSON.stringify(voteDto));
    voteDto.userId = user.userId;
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
      this.socialGateway.broadcastVoteUpdated(result);
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
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 reactions per minute
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
    @Param('postId') postId: string
  ): Promise<ReactionDto[]> {
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
    @Param('postId') postId: string
  ): Promise<{ [value: number]: number }> {
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
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 comments per minute
  async comment(
    @User() user: UserDetails,
    @Body() commentDto: CreateCommentDto
  ) {
    const finalComment: CreateCommentDto = {
      ...commentDto,
      userId: user.userId,
    };
    console.log('🚀 ~ SocialController ~ comment ~ commentDto:', finalComment);
    const result = await firstValueFrom(
      this.socialClient.send({ cmd: CommentCommands.CREATE }, finalComment)
    );

    // Broadcast comment created event via WebSocket
    if (this.socialGateway && result) {
      this.socialGateway.broadcastCommentCreated(result);
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
  async attachment(@User() user, @Body() attachmentDto: CreateAttachmentDto) {
    return await firstValueFrom(
      this.socialClient.send({ cmd: AttachmentCommands.CREATE }, attachmentDto)
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
  async getPost(@Param('id') id: string): Promise<PostDto> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: PostCommands.FIND }, { id })
    );
  }

  @ApiTags('post')
  @ApiOperation({ summary: 'Get a shared post by ID (public)' })
  @ApiResponse({
    status: 200,
    description: 'The shared post has been successfully retrieved.',
    type: PostDto,
  })
  @Get('post/:id/shared')
  async getSharedPost(@Param('id') id: string): Promise<PostDto> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: PostCommands.FIND }, { id })
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
  async getComment(@Param('id') id: string): Promise<CommentDto> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: CommentCommands.FIND }, { id })
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
  async getVote(@Param('id') id: string): Promise<VoteDto> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: VoteCommands.GET }, { id })
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
  async getAttachment(@Param('id') id: string): Promise<AttachmentDto> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: AttachmentCommands.FIND }, { id })
    );
  }

  @ApiTags('post')
  @ApiOperation({ summary: 'Search for posts' })
  @ApiResponse({
    status: 200,
    description: 'The posts have been successfully retrieved.',
    type: [PostDto],
  })
  @Public()
  @Post('post/find')
  async searchPosts(
    @Body('criteria') searchCriteria: SearchPostDto,
    @Body('opts') opts?: SearchPostOptions
  ): Promise<PostDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PostCommands.FIND_MANY },
        { criteria: searchCriteria, opts: opts }
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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<PostDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommunityCommands.GET_FEED },
        {
          userId: user.userId,
          appScope,
          includePublic: includePublic !== 'false',
          includeFollowing: includeFollowing === 'true',
          includeCommunities: includeCommunities !== 'false',
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
  @Public()
  @Post('comments/find')
  async searchComments(
    @Body() searchCriteria: SearchCommentDto
  ): Promise<CommentDto[]> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: CommentCommands.FIND_MANY }, searchCriteria)
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
    @Body() searchCriteria: SearchAttachmentDto
  ): Promise<AttachmentDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: AttachmentCommands.FIND_MANY },
        searchCriteria
      )
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
    const result = await firstValueFrom(
      this.socialClient.send(
        { cmd: PostCommands.UPDATE },
        { id, data: updatePostDto, userId: user.userId }
      )
    );

    // Broadcast post updated event via WebSocket
    if (this.socialGateway && result) {
      this.socialGateway.broadcastPostUpdated(result);
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
    @Body() updateCommentDto: UpdateCommentDto
  ): Promise<CommentDto> {
    const result = await firstValueFrom(
      this.socialClient.send(
        { cmd: CommentCommands.UPDATE },
        { id, data: updateCommentDto }
      )
    );

    // Broadcast comment updated event via WebSocket
    if (this.socialGateway && result) {
      this.socialGateway.broadcastCommentUpdated(result);
    }

    return result;
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
    @Body() updateAttachmentDto: UpdateAttachmentDto
  ): Promise<AttachmentDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: AttachmentCommands.UPDATE },
        { id, data: updateAttachmentDto }
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
        { id, userId: user.userId }
      )
    );

    // Broadcast post deleted event via WebSocket
    if (this.socialGateway) {
      this.socialGateway.broadcastPostDeleted(id);
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
    @Query('postId') postId?: string
  ): Promise<void> {
    // If postId not provided, fetch comment first to get postId for broadcast
    let commentPostId = postId;
    if (!commentPostId) {
      try {
        const comment = await firstValueFrom(
          this.socialClient.send({ cmd: CommentCommands.FIND }, { id })
        );
        commentPostId = comment?.postId;
      } catch (error) {
        // Comment not found or error, continue with deletion
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.l.error(
          `Error fetching comment for WebSocket broadcast: ${errorMessage}`
        );
      }
    }

    const result = await firstValueFrom(
      this.socialClient.send({ cmd: CommentCommands.DELETE }, { id })
    );

    // Broadcast comment deleted event via WebSocket
    if (this.socialGateway && commentPostId) {
      this.socialGateway.broadcastCommentDeleted(id, commentPostId);
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
  async deleteAttachment(@Param('id') id: string): Promise<void> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: AttachmentCommands.DELETE }, { id })
    );
  }
}
