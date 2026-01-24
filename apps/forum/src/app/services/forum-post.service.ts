import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForumPost } from '../../entities/forum-post.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  CreateForumPostDto,
  UpdateForumPostDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class ForumPostService {
  constructor(
    @Inject(getRepositoryToken(ForumPost))
    private readonly postRepo: Repository<ForumPost>
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
      ],
      ALLOWED_ATTR: ['href', 'target', 'class'],
    });
  }

  async create(createPostDto: CreateForumPostDto): Promise<ForumPost> {
    const post = this.postRepo.create({
      ...createPostDto,
      content: this.sanitizeContent(createPostDto.content),
    });
    return await this.postRepo.save(post);
  }

  async findAll(options?: FindManyOptions<ForumPost>): Promise<ForumPost[]> {
    return await this.postRepo.find(options);
  }

  async findOne(
    id: string,
    options?: FindOneOptions<ForumPost>
  ): Promise<ForumPost | null> {
    return await this.postRepo.findOne({
      where: { id },
      ...options,
    });
  }

  async update(id: string, updatePostDto: UpdateForumPostDto): Promise<ForumPost> {
    const post = await this.findOne(id);
    if (!post) {
      throw new Error(`Forum post with ID ${id} not found`);
    }
    
    const updatedData: Partial<ForumPost> = {
      isEdited: true,
    };
    
    if (updatePostDto.content) {
      updatedData.content = this.sanitizeContent(updatePostDto.content);
    }

    await this.postRepo.update(id, updatedData);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.postRepo.delete(id);
  }
}
