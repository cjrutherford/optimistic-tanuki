import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '../../entities/post.entity';
import { Attachment } from '../../entities/attachment.entity';
import { Comment } from '../../entities/comment.entity';
import { Repository, FindOneOptions, FindManyOptions, In } from 'typeorm';
import { CreatePostDto, UpdatePostDto } from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class PostService {
  constructor(
    @Inject(getRepositoryToken(Post))
    private readonly postRepo: Repository<Post>,
    @Inject(getRepositoryToken(Attachment))
    private readonly attachmentRepo: Repository<Attachment>,
    @Inject(getRepositoryToken(Comment))
    private readonly commentRepo: Repository<Comment>
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

  async update(id: string, updatePostDto: UpdatePostDto): Promise<void> {
    // Sanitize content if provided
    const sanitizedDto = {
      ...updatePostDto,
    };
    if (updatePostDto.content) {
      sanitizedDto.content = this.sanitizeContent(updatePostDto.content);
    }
    await this.postRepo.update(id, sanitizedDto);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    console.log(`PostService.remove called for ID: ${id}`);

    // Delete related entities first to avoid foreign key constraint errors
    try {
      // Remove comments associated with this post
      await this.commentRepo.delete({ post: { id } as any });

      // Remove attachments associated with this post
      await this.attachmentRepo.delete({ post: { id } as any });

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
}
