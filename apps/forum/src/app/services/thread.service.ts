import { Inject, Injectable, Optional } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Thread } from '../../entities/thread.entity';
import { ForumPost } from '../../entities/forum-post.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import { CreateThreadDto, UpdateThreadDto } from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';
import { withIdConstraint } from './find-options';
import { ForumAccessService } from './forum-access.service';

@Injectable()
export class ThreadService {
  constructor(
    @Inject(getRepositoryToken(Thread))
    private readonly threadRepo: Repository<Thread>,
    @Inject(getRepositoryToken(ForumPost))
    private readonly postRepo: Repository<ForumPost>,
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
        'img',
        'blockquote',
        'code',
        'pre',
      ],
      ALLOWED_ATTR: ['href', 'target', 'class', 'src', 'alt', 'title'],
    });
  }

  async create(createThreadDto: CreateThreadDto): Promise<Thread> {
    const audienceOwner = await this.forumAccess?.resolveThreadAudienceOwner(
      createThreadDto.topicId,
      createThreadDto.visibility,
      createThreadDto.profileId
    );
    await this.forumAccess?.latchAssetReferences(
      `${createThreadDto.title ?? ''}\n${createThreadDto.description ?? ''}\n${
        createThreadDto.content ?? ''
      }`,
      audienceOwner
    );
    const thread = this.threadRepo.create({
      ...createThreadDto,
      title: this.sanitizeContent(createThreadDto.title),
      // `description` is a rendered column like title and content, so it needs
      // the same sanitizing — spreading the DTO alone stored it raw.
      description: this.sanitizeContent(createThreadDto.description),
      content: this.sanitizeContent(createThreadDto.content),
    });
    return await this.threadRepo.save(thread);
  }

  async findAll(options?: FindManyOptions<Thread>): Promise<Thread[]> {
    return await this.threadRepo.find(
      this.withDefaultModerationFilter(options)
    );
  }

  async findOne(
    id: string,
    options?: FindOneOptions<Thread>
  ): Promise<Thread | null> {
    const thread = await this.threadRepo.findOne(
      this.withDefaultModerationFilter(withIdConstraint(id, options))
    );

    if (thread?.moderationStatus === 'visible') {
      await this.threadRepo.increment({ id: thread.id }, 'viewCount', 1);
      thread.viewCount += 1;
    }

    return thread;
  }

  async update(id: string, updateThreadDto: UpdateThreadDto): Promise<Thread> {
    const thread = await this.threadRepo.findOne({ where: { id } });
    if (!thread) {
      throw new Error(`Thread with ID ${id} not found`);
    }

    const oldAudienceOwner = await this.forumAccess?.resolveThreadAudienceOwner(
      thread.topicId,
      thread.visibility,
      thread.profileId
    );
    await this.forumAccess?.latchAssetReferences(
      `${thread.title ?? ''}\n${thread.description ?? ''}\n${
        thread.content ?? ''
      }`,
      oldAudienceOwner
    );
    const newAudienceOwner = await this.forumAccess?.resolveThreadAudienceOwner(
      thread.topicId,
      updateThreadDto.visibility ?? thread.visibility,
      thread.profileId
    );
    await this.forumAccess?.latchAssetReferences(
      `${updateThreadDto.title ?? thread.title ?? ''}\n${
        thread.description ?? ''
      }\n${updateThreadDto.content ?? thread.content ?? ''}`,
      newAudienceOwner
    );

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
    const updatedThread = await this.threadRepo.findOne({ where: { id } });
    if (!updatedThread) {
      throw new Error(`Thread with ID ${id} not found`);
    }

    return updatedThread;
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const thread = await this.threadRepo.findOne({ where: { id } });
    if (thread) {
      const postCount = await this.postRepo.count({ where: { threadId: id } });
      if (postCount > 0) {
        throw new RpcException({
          statusCode: 409,
          message: 'Thread still contains posts. Delete those posts first.',
        });
      }
      const audienceOwner = await this.forumAccess?.resolveThreadAudienceOwner(
        thread.topicId,
        thread.visibility,
        thread.profileId
      );
      await this.forumAccess?.latchAssetReferences(
        `${thread.title ?? ''}\n${thread.description ?? ''}\n${
          thread.content ?? ''
        }`,
        audienceOwner
      );
    }
    try {
      const result = await this.threadRepo.delete(id);
      return { id, deleted: (result.affected ?? 0) > 0 };
    } catch (error) {
      if (this.isForeignKeyConstraintViolation(error)) {
        throw new RpcException({
          statusCode: 409,
          message: 'Thread still contains posts. Delete those posts first.',
        });
      }
      throw error;
    }
  }

  async moderate(
    id: string,
    moderationStatus: 'visible' | 'hidden',
    moderatedBy: string,
    moderationNotes?: string
  ): Promise<Thread | null> {
    const thread = await this.threadRepo.findOne({ where: { id } });
    if (!thread) {
      throw new Error(`Thread with ID ${id} not found`);
    }

    await this.threadRepo.update(id, {
      moderationStatus,
      moderationNotes: moderationNotes ?? null,
      moderatedBy,
      moderatedAt: new Date(),
    });

    return await this.threadRepo.findOne({ where: { id } });
  }

  private withDefaultModerationFilter<
    T extends FindManyOptions<Thread> | FindOneOptions<Thread> | undefined
  >(options?: T): T {
    const normalized = { ...(options ?? {}) } as T;
    const where = (
      normalized as FindManyOptions<Thread> | FindOneOptions<Thread>
    ).where;

    if (!where) {
      (normalized as FindManyOptions<Thread> | FindOneOptions<Thread>).where = {
        moderationStatus: 'visible',
      };
      return normalized;
    }

    if (Array.isArray(where)) {
      (normalized as FindManyOptions<Thread> | FindOneOptions<Thread>).where =
        where.map((entry) =>
          entry.moderationStatus === undefined
            ? { ...entry, moderationStatus: 'visible' }
            : entry
        );
      return normalized;
    }

    if ((where as any).moderationStatus === undefined) {
      (normalized as FindManyOptions<Thread> | FindOneOptions<Thread>).where = {
        ...where,
        moderationStatus: 'visible',
      };
    }

    return normalized;
  }

  private isForeignKeyConstraintViolation(error: any): boolean {
    return error?.code === '23503' || error?.driverError?.code === '23503';
  }
}
