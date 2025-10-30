import {
  Body,
  Controller,
  Inject,
  Post,
  Put,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AttachmentCommands,
  CommentCommands,
  PostCommands,
  ServiceTokens,
  VoteCommands,
} from '@optimistic-tanuki/constants';
import {
  AttachmentDto,
  CommentDto,
  CreateAttachmentDto,
  CreateCommentDto,
  CreatePostDto,
  CreateVoteDto,
  PostDto,
  SearchAttachmentDto,
  SearchCommentDto,
  SearchPostDto,
  SearchPostOptions,
  UpdateAttachmentDto,
  UpdateCommentDto,
  UpdatePostDto,
  VoteDto,
} from '@optimistic-tanuki/models';
import { Get, Param } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';

@UseGuards(AuthGuard, PermissionsGuard)
@ApiTags('social')
@Controller('social')
export class SocialController {
  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  @UseGuards(AuthGuard)
  @ApiTags('post')
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({
    status: 201,
    description: 'The post has been successfully created.',
    type: PostDto,
  })
  @Post('post')
  @RequirePermissions('social:post:create')
  async post(@User() user, @Body() postDto: CreatePostDto) {
    console.log(user);
    postDto.userId = user.userId;
    console.log('Updated Post Data  ', postDto);
    return await firstValueFrom(
      this.socialClient.send({ cmd: PostCommands.CREATE }, postDto)
    );
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
  @RequirePermissions('social:vote:create')
  async vote(@User() user: UserDetails, @Body() voteDto: CreateVoteDto) {
    voteDto.userId = user.userId;
    const commandMap = {
      '-1': VoteCommands.DOWNVOTE,
      '0': VoteCommands.UNVOTE,
      '1': VoteCommands.UPVOTE,
    };
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: commandMap[voteDto.value.toString()] },
        voteDto
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
  @RequirePermissions('social:comment:create')
  async comment(
    @User() user: UserDetails,
    @Body() commentDto: CreateCommentDto
  ) {
    const finalComment: CreateCommentDto = {
      ...commentDto,
      userId: user.userId,
    };
    console.log('🚀 ~ SocialController ~ comment ~ commentDto:', finalComment);
    return await firstValueFrom(
      this.socialClient.send({ cmd: CommentCommands.CREATE }, finalComment)
    );
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

  @UseGuards(AuthGuard)
  @ApiTags('post')
  @ApiOperation({ summary: 'Search for posts' })
  @ApiResponse({
    status: 200,
    description: 'The posts have been successfully retrieved.',
    type: [PostDto],
  })
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
  @ApiTags('comment')
  @ApiOperation({ summary: 'Search for comments' })
  @ApiResponse({
    status: 200,
    description: 'The comments have been successfully retrieved.',
    type: [CommentDto],
  })
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
  @RequirePermissions('social:post:update')
  async updatePost(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto
  ): Promise<PostDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PostCommands.UPDATE },
        { id, data: updatePostDto }
      )
    );
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
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: CommentCommands.UPDATE },
        { id, data: updateCommentDto }
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
  async deletePost(@Param('id') id: string): Promise<void> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: PostCommands.DELETE }, { id })
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('comment')
  @ApiOperation({ summary: 'Delete a comment by ID' })
  @ApiResponse({
    status: 200,
    description: 'The comment has been successfully deleted.',
  })
  @Delete('comment/:id')
  async deleteComment(@Param('id') id: string): Promise<void> {
    return await firstValueFrom(
      this.socialClient.send({ cmd: CommentCommands.DELETE }, { id })
    );
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
