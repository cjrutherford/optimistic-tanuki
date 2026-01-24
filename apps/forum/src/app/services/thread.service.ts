import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Thread } from '../../entities/thread.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  CreateThreadDto,
  UpdateThreadDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class ThreadService {
  constructor(
    @Inject(getRepositoryToken(Thread))
    private readonly threadRepo: Repository<Thread>
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

  async create(createThreadDto: CreateThreadDto): Promise<Thread> {
    const thread = this.threadRepo.create({
      ...createThreadDto,
      title: this.sanitizeContent(createThreadDto.title),
      content: this.sanitizeContent(createThreadDto.content),
    });
    return await this.threadRepo.save(thread);
  }

  async findAll(options?: FindManyOptions<Thread>): Promise<Thread[]> {
    return await this.threadRepo.find(options);
  }

  async findOne(
    id: string,
    options?: FindOneOptions<Thread>
  ): Promise<Thread | null> {
    // Increment view count
    await this.threadRepo.increment({ id }, 'viewCount', 1);
    
    return await this.threadRepo.findOne({
      where: { id },
      ...options,
    });
  }

  async update(id: string, updateThreadDto: UpdateThreadDto): Promise<Thread> {
    const thread = await this.threadRepo.findOne({ where: { id } });
    if (!thread) {
      throw new Error(`Thread with ID ${id} not found`);
    }
    
    const updatedData: Partial<Thread> = {};
    if (updateThreadDto.title) {
      updatedData.title = this.sanitizeContent(updateThreadDto.title);
    }
    if (updateThreadDto.content) {
      updatedData.content = this.sanitizeContent(updateThreadDto.content);
    }
    if (updateThreadDto.visibility !== undefined) {
      updatedData.visibility = updateThreadDto.visibility;
    }
    if (updateThreadDto.isPinned !== undefined) {
      updatedData.isPinned = updateThreadDto.isPinned;
    }
    if (updateThreadDto.isLocked !== undefined) {
      updatedData.isLocked = updateThreadDto.isLocked;
    }

    await this.threadRepo.update(id, updatedData);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.threadRepo.delete(id);
  }
}
