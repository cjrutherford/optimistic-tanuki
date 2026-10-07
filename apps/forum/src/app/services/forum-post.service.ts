import { Inject, Injectable, Optional } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForumPost } from '../../entities/forum-post.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  CreateForumPostDto,
  UpdateForumPostDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';
import { withIdConstraint } from './find-options';
import { ForumAccessService } from './forum-access.service';

@Injectable()
export class ForumPostService {
  constructor(
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

  async create(createPostDto: CreateForumPostDto): Promise<ForumPost> {
    const audienceOwner = await this.forumAccess?.resolvePostAudienceOwner(
      createPostDto.threadId
    );
    await this.forumAccess?.latchAssetReferences(
      createPostDto.content,
      audienceOwner
    );
    const post = this.postRepo.create({
      ...createPostDto,
      content: this.sanitizeContent(createPostDto.content),
    });
    return await this.postRepo.save(post);
  }

  async findAll(options?: FindManyOptions<ForumPost>): Promise<ForumPost[]> {
    return await this.postRepo.find(this.withDefaultModerationFilter(options));
  }

  async findOne(
    id: string,
    options?: FindOneOptions<ForumPost>
  ): Promise<ForumPost | null> {
    return await this.postRepo.findOne(
      this.withDefaultModerationFilter(withIdConstraint(id, options))
    );
  }

  async update(
    id: string,
    updatePostDto: UpdateForumPostDto
  ): Promise<ForumPost> {
    const post = await this.findOne(id);
    if (!post) {
      throw new Error(`Forum post with ID ${id} not found`);
    }

    const audienceOwner = await this.forumAccess?.resolvePostAudienceOwner(
      post.threadId
    );
    await this.forumAccess?.latchAssetReferences(post.content, audienceOwner);
    await this.forumAccess?.latchAssetReferences(
      updatePostDto.content ?? post.content,
      audienceOwner
    );

    const updatedData: Partial<ForumPost> = {
      isEdited: true,
    };

    if (updatePostDto.content) {
      updatedData.content = this.sanitizeContent(updatePostDto.content);
    }

    await this.postRepo.update(id, updatedData);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const post = await this.findOne(id);
    if (post) {
      const audienceOwner = await this.forumAccess?.resolvePostAudienceOwner(
        post.threadId
      );
      await this.forumAccess?.latchAssetReferences(post.content, audienceOwner);
    }
    const result = await this.postRepo.delete(id);
    return { id, deleted: (result.affected ?? 0) > 0 };
  }

  async moderate(
    id: string,
    moderationStatus: 'visible' | 'hidden',
    moderatedBy: string,
    moderationNotes?: string
  ): Promise<ForumPost | null> {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) {
      throw new Error(`Forum post with ID ${id} not found`);
    }

    await this.postRepo.update(id, {
      moderationStatus,
      moderationNotes: moderationNotes ?? null,
      moderatedBy,
      moderatedAt: new Date(),
    });

    return await this.postRepo.findOne({ where: { id } });
  }

  private withDefaultModerationFilter<
    T extends FindManyOptions<ForumPost> | FindOneOptions<ForumPost> | undefined
  >(options?: T): T {
    const normalized = { ...(options ?? {}) } as T;
    const where = (
      normalized as FindManyOptions<ForumPost> | FindOneOptions<ForumPost>
    ).where;

    if (!where) {
      (
        normalized as FindManyOptions<ForumPost> | FindOneOptions<ForumPost>
      ).where = {
        moderationStatus: 'visible',
      };
      return normalized;
    }

    if (Array.isArray(where)) {
      (
        normalized as FindManyOptions<ForumPost> | FindOneOptions<ForumPost>
      ).where = where.map((entry) =>
        entry.moderationStatus === undefined
          ? { ...entry, moderationStatus: 'visible' }
          : entry
      );
      return normalized;
    }

    if ((where as any).moderationStatus === undefined) {
      (
        normalized as FindManyOptions<ForumPost> | FindOneOptions<ForumPost>
      ).where = {
        ...where,
        moderationStatus: 'visible',
      };
    }

    return normalized;
  }
}
