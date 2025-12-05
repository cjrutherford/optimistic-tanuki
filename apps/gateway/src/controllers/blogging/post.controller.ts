import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BlogPostCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  BlogPostQueryDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('post')
export class PostController {
  constructor(
    @Inject(ServiceTokens.BLOG_SERVICE)
    private readonly postService: ClientProxy,
    private readonly l: Logger
  ) {
    this.l.log('PostController initialized');
    console.log('PostController connecting to postService...');
    this.postService
      .connect()
      .then(() => {
        this.l.log('PostController connected to postService');
      })
      .catch((e) => this.l.error('Error connecting to postService', e));
  }

  /**
   * Extract and validate profile ID from user token
   * @throws HttpException if profileId is not found
   */
  private getProfileId(user: UserDetails): string {
    const profileId = user?.profileId;
    if (!profileId) {
      throw new HttpException('Profile ID not found in token', 401);
    }
    return profileId;
  }

  @Post()
  @RequirePermissions('blog.post.create')
  async createPost(@Body() createPost: CreateBlogPostDto) {
    try {
      const post = await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.CREATE }, createPost)
      );
      this.l.log('Post created successfully');
      return post;
    } catch (error) {
      this.l.error('Error creating post', error);
      throw new HttpException(
        'Failed to create post: [' + error.message + ']',
        500
      );
    }
  }

  @Post('/find')
  // @RequirePermissions('blog.post.read')
  async findAllPosts(@Body() query: BlogPostQueryDto) {
    try {
      const posts = await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.FIND_ALL }, query)
      );
      this.l.log('Posts retrieved successfully');
      return posts;
    } catch (error) {
      this.l.error('Error retrieving posts', error);
      throw new HttpException(
        'Failed to retrieve posts: [' + error.message + ']',
        500
      );
    }
  }

  /**
   * Get all published posts (public access)
   */
  @Get('/published')
  async getPublishedPosts() {
    try {
      const posts = await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.FIND_PUBLISHED }, {})
      );
      this.l.log('Published posts retrieved successfully');
      return posts;
    } catch (error) {
      this.l.error('Error retrieving published posts', error);
      throw new HttpException(
        'Failed to retrieve published posts: [' + error.message + ']',
        500
      );
    }
  }

  /**
   * Get drafts for a specific author
   */
  @Get('/drafts/:authorId')
  @RequirePermissions('blog.post.read')
  async getDraftsByAuthor(@Param('authorId') authorId: string) {
    try {
      const posts = await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.FIND_DRAFTS_BY_AUTHOR }, authorId)
      );
      this.l.log(`Drafts for author ${authorId} retrieved successfully`);
      return posts;
    } catch (error) {
      this.l.error(`Error retrieving drafts for author ${authorId}`, error);
      throw new HttpException(
        'Failed to retrieve drafts: [' + error.message + ']',
        500
      );
    }
  }

  /**
   * Publish a draft post
   */
  @Post('/:id/publish')
  @RequirePermissions('blog.post.update')
  async publishPost(@Param('id') id: string, @User() user: UserDetails) {
    try {
      const requestingAuthorId = this.getProfileId(user);
      
      const publishedPost = await firstValueFrom(
        this.postService.send(
          { cmd: BlogPostCommands.PUBLISH },
          { id, requestingAuthorId }
        )
      );
      if (!publishedPost) {
        throw new HttpException('Post not found', 404);
      }
      this.l.log(`Post ${id} published successfully`);
      return publishedPost;
    } catch (error) {
      this.l.error(`Error publishing post ${id}`, error);
      if (error.status === 404 || error.status === 403 || error.status === 401) {
        throw error;
      }
      throw new HttpException(
        'Failed to publish post: [' + error.message + ']',
        500
      );
    }
  }

  @Get('/:id')
  // @RequirePermissions('blog.post.read', 'public')
  async getPost(@Param('id') id: string) {
    try {
      const post = await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.FIND }, id)
      );
      if (!post) {
        this.l.error(`Post ${id} not found`);
        throw new HttpException('Post not found', 404);
      }
      this.l.log(`Post ${id} retrieved successfully`);
      return post;
    } catch (error) {
      this.l.error(`Error retrieving post ${id}`, error);
      if (error.status === 404) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve post: [' + error.message + ']',
        500
      );
    }
  }

  @Patch('/:id')
  @RequirePermissions('blog.post.update')
  async updatePost(
    @Param('id') id: string,
    @Body() updateData: UpdateBlogPostDto,
    @User() user: UserDetails
  ) {
    try {
      const requestingAuthorId = this.getProfileId(user);
      
      const updatedPost = await firstValueFrom(
        this.postService.send(
          { cmd: BlogPostCommands.UPDATE },
          { id, updatePostDto: updateData, requestingAuthorId }
        )
      );
      if (!updatedPost) {
        throw new HttpException('Post not found', 404);
      }
      this.l.log(`Post ${id} updated successfully`);
      return updatedPost;
    } catch (error) {
      this.l.error(`Error updating post ${id}`, error);
      if (error.status === 404 || error.status === 403 || error.status === 401) {
        throw error;
      }
      throw new HttpException(
        'Failed to update post: [' + error.message + ']',
        500
      );
    }
  }

  @Delete('/:id')
  @RequirePermissions('blog.post.delete')
  async deletePost(@Param('id') id: string) {
    try {
      await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.DELETE }, id)
      );
      this.l.log(`Post ${id} deleted successfully`);
      return { message: 'Post deleted successfully' };
    } catch (error) {
      this.l.error(`Error deleting post ${id}`, error);
      throw new HttpException(
        'Failed to delete post: [' + error.message + ']',
        500
      );
    }
  }
}
