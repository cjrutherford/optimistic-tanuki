import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthGuard } from '../../../auth/auth.guard';
import { User, UserDetails } from '../../../decorators/user.decorator';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PostShareCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CreatePostShareDto,
  PostShareDto,
  SharePostRequestDto,
} from '@optimistic-tanuki/models';

@UseGuards(AuthGuard)
@ApiTags('post-shares')
@Controller('posts')
export class PostShareController {
  private readonly logger = new Logger(PostShareController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  @Post(':id/share')
  @ApiOperation({ summary: 'Share a post' })
  @ApiParam({ name: 'id', description: 'Post ID to share' })
  @ApiResponse({
    status: 201,
    description: 'Post shared successfully.',
    type: PostShareDto,
  })
  async sharePost(
    @Param('id') originalPostId: string,
    @Body() shareData: SharePostRequestDto,
    @User() user: UserDetails
  ): Promise<PostShareDto> {
    const createPostShareDto: CreatePostShareDto & { userId: string } = {
      originalPostId,
      sharedById: user.profileId,
      userId: user.userId,
      comment: shareData.comment,
      visibility: shareData.visibility,
      communityId: shareData.communityId,
    };
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PostShareCommands.CREATE },
        createPostShareDto
      )
    );
  }

  @Get(':id/shares')
  @ApiOperation({ summary: 'Get shares for a post' })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Post shares retrieved successfully.',
    type: [PostShareDto],
  })
  async getPostShares(
    @Param('id') originalPostId: string,
    @User() user: UserDetails
  ): Promise<PostShareDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PostShareCommands.FIND_BY_POST },
        { originalPostId, profileId: user.profileId, userId: user.userId }
      )
    );
  }

  @Get('profile/:profileId/shared')
  @ApiOperation({ summary: 'Get posts shared by a profile' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiResponse({
    status: 200,
    description: 'Shared posts retrieved successfully.',
    type: [PostShareDto],
  })
  async getSharedPosts(
    @Param('profileId') sharedById: string,
    @User() user: UserDetails
  ): Promise<PostShareDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PostShareCommands.FIND_BY_PROFILE },
        { sharedById, profileId: user.profileId, userId: user.userId }
      )
    );
  }

  @Delete('shares/:id')
  @ApiOperation({ summary: 'Delete a post share' })
  @ApiParam({ name: 'id', description: 'Share ID' })
  @ApiResponse({
    status: 200,
    description: 'Post share deleted successfully.',
  })
  async deleteShare(
    @Param('id') id: string,
    @User() user: UserDetails
  ): Promise<{ success: boolean }> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: PostShareCommands.DELETE },
        { id, sharedById: user.profileId }
      )
    );
  }
}
