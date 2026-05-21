import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
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
import { Public } from '../../decorators/public.decorator';
import { PermissionsProxyService } from '../../auth/permissions-proxy.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('post')
export class PostController {
  constructor(
    @Inject(ServiceTokens.BLOG_SERVICE)
    private readonly postService: ClientProxy,
    private readonly l: Logger,
    private readonly permissionsProxy: PermissionsProxyService
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
      this.l.error(`Error creating post [${JSON.stringify(createPost)} - ${JSON.stringify(error)}]`);
      throw new HttpException(
        'Failed to create post: [' + error.message + ']',
        500
      );
    }
  }

  @Post('/find')
  @Public()
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
  @Public()
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
        this.postService.send(
          { cmd: BlogPostCommands.FIND_DRAFTS_BY_AUTHOR },
          { authorId }
        )
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
  @RequirePermissions('blog.post.publish')
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
      if (
        error.status === 404 ||
        error.status === 403 ||
        error.status === 401
      ) {
        throw error;
      }
      throw new HttpException(
        'Failed to publish post: [' + error.message + ']',
        500
      );
    }
  }

  /**
   * Get a single post by ID (public for published, protected for drafts)
   */
  @Get('/:id')
  @Public()
  async getPost(
    @Param('id') id: string,
    @User() user: UserDetails,
    @Headers('x-ot-appscope') appScope: string
  ) {
    try {
      const post = await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.FIND }, { id })
      );
      if (!post) {
        this.l.error(`Post ${id} not found`);
        throw new HttpException('Post not found', 404);
      }

      // If it's a draft, check permissions
      if (post.isDraft) {
        if (!user || !user.profileId) {
          throw new HttpException('Post not found', 404);
        }

        const canReadDrafts = await this.permissionsProxy.checkPermission(
          user.profileId,
          'blog.post.read',
          appScope || 'digital-homestead'
        );

        if (!canReadDrafts) {
          throw new HttpException('Post not found', 404);
        }
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
      if (
        error.status === 404 ||
        error.status === 403 ||
        error.status === 401
      ) {
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
        this.postService.send({ cmd: BlogPostCommands.DELETE }, { id })
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

  /**
   * Generate RSS feed for all published posts
   */
  @Get('/rss/feed.xml')
  @Public()
  async getRssFeed(@Res() res: Response, @Query('baseUrl') baseUrl?: string) {
    try {
      const defaultBaseUrl = baseUrl || 'https://blog.optimistic-tanuki.com';
      const blogInfo = {
        title: 'Optimistic Tanuki Blog',
        description: 'A collection of thoughts and tutorials',
        link: defaultBaseUrl,
        feedUrl: `${defaultBaseUrl}/post/rss/feed.xml`,
        author: {
          name: 'Optimistic Tanuki Team',
          email: 'blog@optimistic-tanuki.com',
        },
      };

      const rssXml = await firstValueFrom(
        this.postService.send(
          { cmd: BlogPostCommands.GENERATE_RSS },
          { blogInfo }
        )
      );

      res.set('Content-Type', 'application/rss+xml');
      res.send(rssXml);
    } catch (error) {
      this.l.error('Error generating RSS feed', error);
      throw new HttpException(
        'Failed to generate RSS feed: [' + error.message + ']',
        500
      );
    }
  }

  /**
   * Search posts by title or content
   */
  @Get('/search')
  @Public()
  async searchPosts(@Query('q') searchTerm: string) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        return [];
      }

      const posts = await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.SEARCH }, { searchTerm })
      );
      this.l.log(`Search completed for term: ${searchTerm}`);
      return posts;
    } catch (error) {
      this.l.error('Error searching posts', error);
      throw new HttpException(
        'Failed to search posts: [' + error.message + ']',
        500
      );
    }
  }

  /**
   * Get SEO metadata for a post
   */
  @Get('/:id/seo')
  @Public()
  async getPostSeoMetadata(
    @Param('id') id: string,
    @Query('baseUrl') baseUrl?: string
  ) {
    try {
      const defaultBaseUrl = baseUrl || 'https://blog.optimistic-tanuki.com';
      const metadata = await firstValueFrom(
        this.postService.send(
          { cmd: BlogPostCommands.GENERATE_SEO },
          { postId: id, baseUrl: defaultBaseUrl }
        )
      );
      this.l.log(`SEO metadata generated for post ${id}`);
      return metadata;
    } catch (error) {
      this.l.error(`Error generating SEO metadata for post ${id}`, error);
      throw new HttpException(
        'Failed to generate SEO metadata: [' + error.message + ']',
        500
      );
    }
  }
}
