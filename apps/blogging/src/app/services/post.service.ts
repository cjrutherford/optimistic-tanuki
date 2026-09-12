import {
  Inject,
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Blog, Post } from '../entities';
import { FindOptionsWhere, Repository, Like, Between } from 'typeorm';
import {
  CreateBlogPostDto,
  UpdateBlogPostDto,
  BlogPostQueryDto,
  BlogPostDto,
} from '@optimistic-tanuki/models';
import { SanitizationService } from './sanitization.service';
import { RpcException } from '@nestjs/microservices';

export interface BlogWorkspaceScope {
  ownerId: string;
  workspaceId: string;
  appScope: string;
  catalogId?: string;
}

type ScopedBlogPostQuery = BlogPostQueryDto & {
  catalogId?: string;
  workspaceId?: string;
  appScope?: string;
  workspaceScope?: BlogWorkspaceScope;
};

interface PublishedBlogCatalogQuery {
  catalogId?: string;
}

interface ScopedPublishedBlogQuery {
  catalogId: string;
  workspaceId: string;
  appScope: string;
}

interface NormalizedPublishedBlogQuery {
  catalogId?: string;
  workspaceId?: string;
  appScope?: string;
  workspaceScope?: BlogWorkspaceScope;
}

@Injectable()
export class PostService {
  constructor(
    @Inject(getRepositoryToken(Post))
    private readonly postRepository: Repository<Post>,
    private readonly sanitizationService: SanitizationService,
    @Inject(getRepositoryToken(Blog))
    private readonly blogRepository: Repository<Blog>
  ) {
    console.log('PostService initialized');
  }

  async create(
    createPostDto: CreateBlogPostDto & {
      workspaceScope?: BlogWorkspaceScope;
    }
  ): Promise<BlogPostDto> {
    try {
      if (
        createPostDto.workspaceScope &&
        createPostDto.authorId !== createPostDto.workspaceScope.ownerId
      ) {
        throw new ForbiddenException(
          'A post author must match the resolved workspace owner'
        );
      }
      // Validate and sanitize input
      this.validatePostContent(createPostDto.content);

      const sanitizedContent = this.sanitizationService.sanitizeHtml(
        createPostDto.content
      );
      const sanitizedTitle = this.sanitizationService.sanitizePlainText(
        createPostDto.title
      );
      const { workspaceScope, ...postInput } = createPostDto;

      const blog = workspaceScope?.catalogId
        ? await this.blogRepository.findOne({
            where: {
              catalogId: workspaceScope.catalogId,
              ownerId: workspaceScope.ownerId,
              workspaceId: workspaceScope.workspaceId,
              appScope: workspaceScope.appScope,
            },
          })
        : undefined;

      if (workspaceScope?.catalogId && !blog) {
        throw new NotFoundException(
          'The selected catalog does not belong to the resolved workspace'
        );
      }

      const postData = {
        ...postInput,
        ...(workspaceScope
          ? {
              workspaceId: workspaceScope.workspaceId,
              appScope: workspaceScope.appScope,
            }
          : {}),
        ...(blog ? { blog } : {}),
        title: sanitizedTitle,
        content: sanitizedContent,
        isDraft:
          createPostDto.isDraft !== undefined ? createPostDto.isDraft : true,
        publishedAt: createPostDto.isDraft === false ? new Date() : null,
      };
      const post = this.postRepository.create(postData);
      return this.postRepository.save(post);
    } catch (error) {
      throw new RpcException(`Failed to create blog post: ${error.message}`);
    }
  }

  /**
   * Validate post content for malicious patterns
   */
  private validatePostContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Post content cannot be empty');
    }

    if (content.length > 100000) {
      throw new BadRequestException('Post content is too long (max 100KB)');
    }

    if (this.sanitizationService.containsMaliciousPatterns(content)) {
      throw new BadRequestException(
        'Post content contains potentially malicious patterns'
      );
    }
  }

  async findAll(query: ScopedBlogPostQuery): Promise<BlogPostDto[]> {
    const where: FindOptionsWhere<Post> = {};
    if (query.title) {
      where.title = query.title;
    }
    if (query.authorId) {
      where.authorId = query.authorId;
    }
    if (query.content !== undefined) {
      where.content = Like(`%${query.content}%`);
    }
    if (query.isDraft !== undefined) {
      where.isDraft = query.isDraft;
    }
    if (query.createdAt && query.createdAt.length == 2) {
      where.createdAt = Between(
        new Date(query.createdAt[0]),
        new Date(query.createdAt[1])
      );
    }
    if (query.updatedAt && query.updatedAt.length == 2) {
      where.updatedAt = Between(
        new Date(query.updatedAt[0]),
        new Date(query.updatedAt[1])
      );
    }
    if (query.catalogId) {
      where.blog = { catalogId: query.catalogId } as any;
    }
    if (query.workspaceScope) {
      where.authorId = query.workspaceScope.ownerId;
      where.appScope = query.workspaceScope.appScope;
      where.workspaceId = query.workspaceScope.workspaceId;
    }
    return this.postRepository.find({ where });
  }

  /**
   * Find published posts only (for public consumption)
   */
  async findPublished(
    queryOrScope:
      | PublishedBlogCatalogQuery
      | ScopedPublishedBlogQuery
      | BlogWorkspaceScope = {}
  ): Promise<BlogPostDto[]> {
    const query: NormalizedPublishedBlogQuery =
      'ownerId' in queryOrScope
        ? { workspaceScope: queryOrScope }
        : queryOrScope;
    return this.postRepository.find({
      where: {
        isDraft: false,
        ...(query.catalogId
          ? {
              blog: {
                catalogId: query.catalogId,
                ...(query.workspaceId
                  ? { workspaceId: query.workspaceId }
                  : {}),
                ...(query.appScope ? { appScope: query.appScope } : {}),
              } as any,
            }
          : {}),
        ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
        ...(query.appScope ? { appScope: query.appScope } : {}),
        ...(query.workspaceScope
          ? {
              authorId: query.workspaceScope.ownerId,
              appScope: query.workspaceScope.appScope,
              workspaceId: query.workspaceScope.workspaceId,
            }
          : {}),
      },
      order: { publishedAt: 'DESC' },
    });
  }

  /**
   * Find drafts for a specific author
   */
  async findDraftsByAuthor(
    authorId: string,
    workspaceScope?: BlogWorkspaceScope
  ): Promise<BlogPostDto[]> {
    return this.postRepository.find({
      where: {
        authorId,
        isDraft: true,
        ...(workspaceScope
          ? {
              appScope: workspaceScope.appScope,
              workspaceId: workspaceScope.workspaceId,
            }
          : {}),
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(
    id: string,
    workspaceScope?: BlogWorkspaceScope
  ): Promise<BlogPostDto> {
    return await this.postRepository.findOne({
      where: {
        id,
        ...(workspaceScope
          ? {
              authorId: workspaceScope.ownerId,
              appScope: workspaceScope.appScope,
              workspaceId: workspaceScope.workspaceId,
            }
          : {}),
      },
    });
  }

  /**
   * Update a post with ownership validation.
   * Only the original author can update the post.
   * @param id - Post ID
   * @param updatePostDto - Update data
   * @param requestingAuthorId - ID of the user making the request (required for ownership check)
   */
  async update(
    id: string,
    updatePostDto: UpdateBlogPostDto,
    requestingAuthorId: string,
    workspaceScope?: BlogWorkspaceScope
  ): Promise<BlogPostDto> {
    const existingPost = await this.findOne(id, workspaceScope);
    if (!existingPost) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }

    // Enforce ownership check - only the author can edit their own posts
    if (existingPost.authorId !== requestingAuthorId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    // Sanitize input if content or title is being updated
    const updateData: Partial<Post> = {};

    if (updatePostDto.title !== undefined) {
      updateData.title = this.sanitizationService.sanitizePlainText(
        updatePostDto.title
      );
    }

    if (updatePostDto.content !== undefined) {
      this.validatePostContent(updatePostDto.content);
      updateData.content = this.sanitizationService.sanitizeHtml(
        updatePostDto.content
      );
    }

    if (updatePostDto.isDraft !== undefined) {
      updateData.isDraft = updatePostDto.isDraft;
    }

    // Handle publish transition
    if (updatePostDto.isDraft === false && existingPost.isDraft === true) {
      // Publishing the post
      updateData.publishedAt = new Date();
    }

    await this.postRepository.update(id, updateData);
    return await this.findOne(id, workspaceScope);
  }

  /**
   * Admin update without ownership check.
   * Use this for administrative operations only.
   * @param id - Post ID
   * @param updatePostDto - Update data
   */
  async adminUpdate(
    id: string,
    updatePostDto: UpdateBlogPostDto
  ): Promise<BlogPostDto> {
    const existingPost = await this.postRepository.findOne({ where: { id } });
    if (!existingPost) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }

    // Handle publish transition
    const updateData: Partial<Post> = { ...updatePostDto };
    if (updatePostDto.isDraft === false && existingPost.isDraft === true) {
      // Publishing the post
      updateData.publishedAt = new Date();
    }

    await this.postRepository.update(id, updateData);
    return await this.postRepository.findOne({ where: { id } });
  }

  /**
   * Publish a draft post (set isDraft to false and set publishedAt)
   */
  async publish(
    id: string,
    requestingAuthorId: string,
    workspaceScope?: BlogWorkspaceScope
  ): Promise<BlogPostDto> {
    const existingPost = await this.findOne(id, workspaceScope);
    if (!existingPost) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }

    if (existingPost.authorId !== requestingAuthorId) {
      throw new ForbiddenException('You can only publish your own posts');
    }

    if (!existingPost.isDraft) {
      return existingPost; // Already published
    }

    await this.postRepository.update(id, {
      isDraft: false,
      publishedAt: new Date(),
    });

    return await this.findOne(id, workspaceScope);
  }

  async remove(id: string, workspaceScope?: BlogWorkspaceScope): Promise<void> {
    if (workspaceScope && !(await this.findOne(id, workspaceScope))) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }
    await this.postRepository.delete(id);
  }

  /**
   * Search posts by title or content
   * @param searchTerm - Search term to look for in title or content
   */
  async searchPosts(searchTerm: string): Promise<BlogPostDto[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    const term = `%${searchTerm}%`;
    return this.postRepository
      .createQueryBuilder('post')
      .where('post.isDraft = :isDraft', { isDraft: false })
      .andWhere('(post.title ILIKE :term OR post.content ILIKE :term)', {
        term,
      })
      .orderBy('post.publishedAt', 'DESC')
      .getMany();
  }
}
