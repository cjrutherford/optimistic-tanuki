import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Topic } from '../../entities/topic.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  CreateTopicDto,
  UpdateTopicDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class TopicService {
  constructor(
    @Inject(getRepositoryToken(Topic))
    private readonly topicRepo: Repository<Topic>
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
      ],
      ALLOWED_ATTR: ['href', 'target'],
    });
  }

  async create(createTopicDto: CreateTopicDto): Promise<Topic> {
    const topic = this.topicRepo.create({
      ...createTopicDto,
      title: this.sanitizeContent(createTopicDto.title),
      description: this.sanitizeContent(createTopicDto.description),
    });
    return await this.topicRepo.save(topic);
  }

  async findAll(options?: FindManyOptions<Topic>): Promise<Topic[]> {
    return await this.topicRepo.find(options);
  }

  async findOne(
    id: string,
    options?: FindOneOptions<Topic>
  ): Promise<Topic | null> {
    return await this.topicRepo.findOne({
      where: { id },
      ...options,
    });
  }

  async update(id: string, updateTopicDto: UpdateTopicDto): Promise<Topic> {
    const topic = await this.findOne(id);
    if (!topic) {
      throw new Error(`Topic with ID ${id} not found`);
    }
    
    const updatedData: Partial<Topic> = {};
    if (updateTopicDto.title) {
      updatedData.title = this.sanitizeContent(updateTopicDto.title);
    }
    if (updateTopicDto.description) {
      updatedData.description = this.sanitizeContent(updateTopicDto.description);
    }
    if (updateTopicDto.visibility !== undefined) {
      updatedData.visibility = updateTopicDto.visibility;
    }
    if (updateTopicDto.isPinned !== undefined) {
      updatedData.isPinned = updateTopicDto.isPinned;
    }
    if (updateTopicDto.isLocked !== undefined) {
      updatedData.isLocked = updateTopicDto.isLocked;
    }

    await this.topicRepo.update(id, updatedData);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.topicRepo.delete(id);
  }
}
