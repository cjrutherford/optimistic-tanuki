import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BlogPostCommands } from '@optimistic-tanuki/constants';
import { PostService, RssService, SeoService } from '../services';
import {
  CreateBlogPostDto,
  BlogPostDto,
  PublishedBlogPostDto,
  BlogPostQueryDto,
  UpdateBlogPostDto,
  toPublishedBlogPost,
} from '@optimistic-tanuki/models';

@Controller('post')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly rssService: RssService,
    private readonly seoService: SeoService
  ) {
    console.log('PostController initialized');
  }

  @MessagePattern({ cmd: BlogPostCommands.CREATE })
  async createPost(
    @Payload() createPostDto: CreateBlogPostDto
  ): Promise<BlogPostDto> {
    return await this.postService.create(createPostDto);
  }

  @MessagePattern({ cmd: BlogPostCommands.FIND_ALL })
  async findAllPosts(
    @Payload() query: BlogPostQueryDto
  ): Promise<BlogPostDto[]> {
    return await this.postService.findAll(query);
  }

  @MessagePattern({ cmd: BlogPostCommands.FIND })
  async findOnePost(@Payload('id') id: string): Promise<BlogPostDto> {
    return await this.postService.findOne(id);
  }

  @MessagePattern({ cmd: BlogPostCommands.UPDATE })
  async updatePost(
    @Payload()
    data: {
      id: string;
      updatePostDto: UpdateBlogPostDto;
      requestingAuthorId: string;
      workspaceScope?: {
        ownerId: string;
        workspaceId: string;
        appScope: string;
      };
    }
  ): Promise<BlogPostDto> {
    const args: [
      string,
      UpdateBlogPostDto,
      string,
      { ownerId: string; workspaceId: string; appScope: string }?
    ] = [data.id, data.updatePostDto, data.requestingAuthorId];
    if (data.workspaceScope) {
      args.push(data.workspaceScope);
    }
    return await this.postService.update(...args);
  }

  @MessagePattern({ cmd: BlogPostCommands.DELETE })
  async deletePost(
    @Payload()
    data:
      | string
      | {
          id: string;
          workspaceScope?: {
            ownerId: string;
            workspaceId: string;
            appScope: string;
          };
        }
  ): Promise<void> {
    const id = typeof data === 'string' ? data : data.id;
    const workspaceScope =
      typeof data === 'string' ? undefined : data.workspaceScope;
    return workspaceScope
      ? await this.postService.remove(id, workspaceScope)
      : await this.postService.remove(id);
  }

  @MessagePattern({ cmd: BlogPostCommands.FIND_PUBLISHED })
  async findPublishedPosts(
    @Payload() query: { catalogId?: string } = {}
  ): Promise<PublishedBlogPostDto[]> {
    const catalogId = query.catalogId?.trim();
    const posts = await this.postService.findPublished(
      catalogId ? { catalogId } : {}
    );
    return posts.map(toPublishedBlogPost);
  }

  @MessagePattern({ cmd: BlogPostCommands.FIND_PUBLISHED_SCOPED })
  async findScopedPublishedPosts(
    @Payload()
    query: {
      catalogId?: string;
      workspaceId?: string;
      appScope?: string;
    } = {}
  ): Promise<PublishedBlogPostDto[]> {
    const catalogId = query.catalogId?.trim();
    const workspaceId = query.workspaceId?.trim();
    const appScope = query.appScope?.trim();
    if (!catalogId || !workspaceId || !appScope) {
      throw new Error('catalogId, workspaceId, and appScope are required');
    }
    const posts = await this.postService.findPublished({
      catalogId,
      workspaceId,
      appScope,
    });
    return posts.map(toPublishedBlogPost);
  }

  @MessagePattern({ cmd: BlogPostCommands.FIND_DRAFTS_BY_AUTHOR })
  async findDraftsByAuthor(
    @Payload()
    data:
      | string
      | {
          authorId: string;
          workspaceScope?: {
            ownerId: string;
            workspaceId: string;
            appScope: string;
          };
        }
  ): Promise<BlogPostDto[]> {
    const authorId = typeof data === 'string' ? data : data.authorId;
    const workspaceScope =
      typeof data === 'string' ? undefined : data.workspaceScope;
    return workspaceScope
      ? await this.postService.findDraftsByAuthor(authorId, workspaceScope)
      : await this.postService.findDraftsByAuthor(authorId);
  }

  @MessagePattern({ cmd: BlogPostCommands.PUBLISH })
  async publishPost(
    @Payload()
    data: {
      id: string;
      requestingAuthorId: string;
      workspaceScope?: {
        ownerId: string;
        workspaceId: string;
        appScope: string;
      };
    }
  ): Promise<BlogPostDto> {
    return data.workspaceScope
      ? await this.postService.publish(
          data.id,
          data.requestingAuthorId,
          data.workspaceScope
        )
      : await this.postService.publish(data.id, data.requestingAuthorId);
  }

  @MessagePattern({ cmd: BlogPostCommands.GENERATE_RSS })
  async generateRssFeed(
    @Payload()
    data: {
      blogInfo: {
        title: string;
        description: string;
        link: string;
        feedUrl: string;
        author?: {
          name: string;
          email: string;
          link?: string;
        };
      };
    }
  ): Promise<string> {
    const posts = await this.postService.findPublished();
    return this.rssService.generateRssFeed(posts, data.blogInfo);
  }

  @MessagePattern({ cmd: BlogPostCommands.GENERATE_SEO })
  async generateSeoMetadata(
    @Payload() data: { postId: string; baseUrl: string; defaultImage?: string }
  ): Promise<any> {
    const post = await this.postService.findOne(data.postId);
    if (!post) {
      throw new Error('Post not found');
    }
    return this.seoService.generatePostMetadata(
      post,
      data.baseUrl,
      data.defaultImage
    );
  }

  @MessagePattern({ cmd: BlogPostCommands.SEARCH })
  async searchPosts(
    @Payload() query: { searchTerm: string }
  ): Promise<BlogPostDto[]> {
    return await this.postService.searchPosts(query.searchTerm);
  }
}
