import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '../../entities/post.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import { CreatePostDto, UpdatePostDto } from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class PostService {
  constructor(
    @Inject(getRepositoryToken(Post))
    private readonly postRepo: Repository<Post>
  ) {}

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
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
    const post = await this.postRepo.create(sanitizedDto);
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

  async update(id: number, updatePostDto: UpdatePostDto): Promise<void> {
    // Sanitize content if provided
    const sanitizedDto = {
      ...updatePostDto,
    };
    if (updatePostDto.content) {
      sanitizedDto.content = this.sanitizeContent(updatePostDto.content);
    }
    await this.postRepo.update(id, sanitizedDto);
  }

  async remove(id: number): Promise<void> {
    await this.postRepo.delete(id);
  }
}
