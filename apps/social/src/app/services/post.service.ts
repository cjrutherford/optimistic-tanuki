import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '../../entities/post.entity';
import { Attachment } from '../../entities/attachment.entity';
import { Comment } from '../../entities/comment.entity';
import {
  Repository,
  FindOneOptions,
  FindManyOptions,
  In,
  FindOperator,
  FindOptionsWhere,
} from 'typeorm';
import {
  CreatePostDto,
  UpdatePostDto,
  SearchPostDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';
import { CommunityService } from './community.service';
import {
  CommunityMemberRole,
  CommunityMembershipStatus,
} from '../../entities/community-member.entity';

@Injectable()
export class PostService {
  constructor(
    @Inject(getRepositoryToken(Post))
    private readonly postRepo: Repository<Post>,
    @Inject(getRepositoryToken(Attachment))
    private readonly attachmentRepo: Repository<Attachment>,
    @Inject(getRepositoryToken(Comment))
    private readonly commentRepo: Repository<Comment>,
    private readonly communityService: CommunityService
  ) {}

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'a',
        'blockquote',
        'code',
        'pre',
        'img',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
      ALLOW_DATA_ATTR: false,
    });
  }

  async create(createPostDto: CreatePostDto): Promise<Post> {
    // If communityId is provided, check membership
    if (createPostDto.communityId) {
      const isMember = await this.communityService.isMember(
        createPostDto.communityId,
        createPostDto.userId
      );
      if (!isMember) {
        throw new Error('You must be a community member to post');
      }
    }

    // Sanitize content before saving
    const sanitizedDto = {
      ...createPostDto,
      content: this.sanitizeContent(createPostDto.content || ''),
    };
    const post = this.postRepo.create(sanitizedDto);

    if (createPostDto.attachmentIds && createPostDto.attachmentIds.length > 0) {
      const attachments = await this.attachmentRepo.findBy({
        id: In(createPostDto.attachmentIds),
      });
      post.attachments = attachments;
    }

    return await this.postRepo.save(post);
  }

  async findAll(options?: FindManyOptions<Post>): Promise<Post[]> {
    return await this.postRepo.find(options);
  }

  async findOne(id: string, options?: FindOneOptions<Post>): Promise<Post> {
    const finalOptions = { ...options };
    if (finalOptions.where) {
      if (Array.isArray(finalOptions.where)) {
        finalOptions.where = finalOptions.where.map((w) => ({ ...w, id }));
      } else {
        finalOptions.where = { ...finalOptions.where, id };
      }
    } else {
      finalOptions.where = { id };
    }
    return await this.postRepo.findOne(finalOptions);
  }

  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    userId: string
  ): Promise<void> {
    // Get the post to check if it's a community post
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) {
      throw new Error('Post not found');
    }

    // If it's a community post, check membership or moderator privileges
    if (post.communityId) {
      const hasPermission = await this.communityService.hasPermission(
        post.communityId,
        userId,
        [
          CommunityMemberRole.OWNER,
          CommunityMemberRole.ADMIN,
          CommunityMemberRole.MODERATOR,
        ]
      );
      const isMember = await this.communityService.isMember(
        post.communityId,
        userId
      );

      // Allow if user is a moderator OR if user is the post author (who is also a member)
      if (!hasPermission && (!isMember || post.userId !== userId)) {
        throw new Error('You do not have permission to update this post');
      }
    }

    // Sanitize content if provided
    const sanitizedDto = {
      ...updatePostDto,
    };
    if (updatePostDto.content) {
      sanitizedDto.content = this.sanitizeContent(updatePostDto.content);
    }
    await this.postRepo.update(id, sanitizedDto);
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    console.log(`PostService.remove called for ID: ${id}`);

    // Get the post to check if it's a community post
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) {
      throw new Error('Post not found');
    }

    // If it's a community post, check membership or moderator privileges
    if (post.communityId) {
      const hasPermission = await this.communityService.hasPermission(
        post.communityId,
        userId,
        [
          CommunityMemberRole.OWNER,
          CommunityMemberRole.ADMIN,
          CommunityMemberRole.MODERATOR,
        ]
      );
      const isMember = await this.communityService.isMember(
        post.communityId,
        userId
      );

      // Allow if user is a moderator OR if user is the post author (who is also a member)
      if (!hasPermission && (!isMember || post.userId !== userId)) {
        throw new Error('You do not have permission to delete this post');
      }
    }

    // Delete related entities first to avoid foreign key constraint errors
    try {
      // Remove comments associated with this post
      await this.commentRepo.delete({ post: { id } });

      // Remove attachments associated with this post
      await this.attachmentRepo.delete({ post: { id } });

      // Finally, remove the post itself
      await this.postRepo.delete(id);

      console.log(`PostService.remove completed for ID: ${id}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error in PostService.remove for ID ${id}: ${message}`);
      throw error;
    }
  }

  async getPosts(searchDto: SearchPostDto): Promise<Post[]> {
    const { userIds, visibility, ...otherFilters } = searchDto;

    const where: FindOptionsWhere<
      Omit<Post, 'votes' | 'comments' | 'links' | 'attachments'>
    > = { ...otherFilters };

    if (userIds && userIds.length > 0) {
      where.userId = In(userIds);
    }

    if (visibility) {
      where.visibility = visibility;
    }

    return await this.postRepo.find({ where });
  }
}
