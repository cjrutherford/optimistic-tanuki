import { Inject, Injectable, Optional } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Topic } from '../../entities/topic.entity';
import { Thread } from '../../entities/thread.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import { CreateTopicDto, UpdateTopicDto } from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';
import { withIdConstraint } from './find-options';
import { ForumAccessService } from './forum-access.service';

@Injectable()
export class TopicService {
  constructor(
    @Inject(getRepositoryToken(Topic))
    private readonly topicRepo: Repository<Topic>,
    @Inject(getRepositoryToken(Thread))
    private readonly threadRepo: Repository<Thread>,
    @Optional() private readonly forumAccess?: ForumAccessService
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
    await this.forumAccess?.latchAssetReferences(
      `${createTopicDto.title ?? ''}\n${createTopicDto.description ?? ''}`,
      createTopicDto.visibility === 'private'
        ? createTopicDto.profileId
        : undefined
    );
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
    return await this.topicRepo.findOne(withIdConstraint(id, options));
  }

  async update(id: string, updateTopicDto: UpdateTopicDto): Promise<Topic> {
    const topic = await this.findOne(id);
    if (!topic) {
      throw new Error(`Topic with ID ${id} not found`);
    }

    await this.forumAccess?.latchAssetReferences(
      `${topic.title ?? ''}\n${topic.description ?? ''}`,
      topic.visibility === 'private' ? topic.profileId : undefined
    );
    await this.forumAccess?.latchAssetReferences(
      `${updateTopicDto.title ?? topic.title ?? ''}\n${
        updateTopicDto.description ?? topic.description ?? ''
      }`,
      (updateTopicDto.visibility ?? topic.visibility) === 'private'
        ? topic.profileId
        : undefined
    );

    const updatedData: Partial<Topic> = {};
    if (updateTopicDto.title) {
      updatedData.title = this.sanitizeContent(updateTopicDto.title);
    }
    if (updateTopicDto.description) {
      updatedData.description = this.sanitizeContent(
        updateTopicDto.description
      );
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

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const topic = await this.findOne(id);
    if (topic) {
      const threadCount = await this.threadRepo.count({
        where: { topicId: id },
      });
      if (threadCount > 0) {
        throw new RpcException({
          statusCode: 409,
          message: 'Topic still contains threads. Delete those threads first.',
        });
      }
      await this.forumAccess?.latchAssetReferences(
        `${topic.title ?? ''}\n${topic.description ?? ''}`,
        topic.visibility === 'private' ? topic.profileId : undefined
      );
    }
    try {
      const result = await this.topicRepo.delete(id);
      return { id, deleted: (result.affected ?? 0) > 0 };
    } catch (error) {
      if (this.isForeignKeyConstraintViolation(error)) {
        throw new RpcException({
          statusCode: 409,
          message: 'Topic still contains threads. Delete those threads first.',
        });
      }
      throw error;
    }
  }

  private isForeignKeyConstraintViolation(error: any): boolean {
    return error?.code === '23503' || error?.driverError?.code === '23503';
  }
}
