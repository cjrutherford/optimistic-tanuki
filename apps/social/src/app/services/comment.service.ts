import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Comment } from '../../entities/comment.entity';
import {
  Repository,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { CreateCommentDto, UpdateCommentDto } from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';
import { Post } from '../../entities/post.entity';
import DOMPurify from 'isomorphic-dompurify';
import {
  PostVisibilityScope,
  visiblePostWhere,
} from '../common/post-visibility.util';

@Injectable()
export class CommentService {
  constructor(
    @Inject(getRepositoryToken(Comment))
    private readonly commentRepo: Repository<Comment>,
    @Inject(getRepositoryToken(Post))
    private readonly postRepo: Repository<Post>
  ) {}

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'code'],
      ALLOWED_ATTR: ['href'],
      ALLOW_DATA_ATTR: false,
    });
  }

  async create(createCommentDto: CreateCommentDto): Promise<Comment> {
    console.log('Creating comment');
    try {
      console.log('finding post');
      const post = await this.postRepo.findOne({
        where: { id: createCommentDto.postId },
      }); // njsscan-ignore: node_nosqli_injection
      if (!post) {
        console.log('post not found');
        throw new RpcException('Post not found');
      }
      console.log('post found', post);
      const commentToCreate: Partial<Comment> = {
        ...createCommentDto,
        content: this.sanitizeContent(createCommentDto.content || ''),
        post,
      };
      const comment = await this.commentRepo.create(commentToCreate);
      return await this.commentRepo.save(comment);
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async findAll(options?: FindManyOptions<Comment>): Promise<Comment[]> {
    return await this.commentRepo.find(
      this.withDefaultModerationFilter(options)
    );
  }

  async findOne(
    id: string,
    options?: FindOneOptions<Comment>
  ): Promise<Comment> {
    const finalOptions = this.withDefaultModerationFilter({ ...options });
    if (finalOptions.where) {
      if (Array.isArray(finalOptions.where)) {
        finalOptions.where = finalOptions.where.map((w) => ({ ...w, id }));
      } else {
        finalOptions.where = { ...finalOptions.where, id };
      }
    } else {
      finalOptions.where = { id };
    }
    return await this.commentRepo.findOne(finalOptions);
  }

  /**
   * Same as {@link findAll}, but additionally requires each comment's parent
   * post to satisfy `scope` under {@link visiblePostWhere} — the same rule
   * post reads are gated by. Prevents leaking comments on posts the caller
   * cannot see (followers-only, moderator-hidden, unpublished scheduled,
   * blocked author).
   */
  async findAllVisible(
    options: FindManyOptions<Comment> | undefined,
    scope: PostVisibilityScope
  ): Promise<Comment[]> {
    const scoped = this.withPostVisibility(options, scope);
    if (!scoped) {
      return [];
    }
    return await this.findAll(scoped);
  }

  /**
   * Same as {@link findOne}, but returns undefined unless the comment's
   * parent post satisfies `scope` (see {@link findAllVisible}).
   */
  async findOneVisible(
    id: string,
    options: FindOneOptions<Comment> | undefined,
    scope: PostVisibilityScope
  ): Promise<Comment> {
    const scoped = this.withPostVisibility(options, scope);
    if (!scoped) {
      return undefined;
    }
    return await this.findOne(id, scoped);
  }

  private withPostVisibility<
    T extends FindManyOptions<Comment> | FindOneOptions<Comment> | undefined
  >(options: T, scope: PostVisibilityScope): T | undefined {
    const normalized = { ...(options ?? {}) } as FindManyOptions<Comment> &
      FindOneOptions<Comment>;
    const where = normalized.where as
      | FindOptionsWhere<Comment>
      | FindOptionsWhere<Comment>[]
      | undefined;
    const entries = !where
      ? [{} as FindOptionsWhere<Comment>]
      : Array.isArray(where)
      ? where
      : [where];

    const branches: FindOptionsWhere<Comment>[] = [];
    for (const entry of entries) {
      const { post, ...rest } = entry as FindOptionsWhere<Comment> & {
        post?: FindOptionsWhere<Post>;
      };
      for (const postBranch of visiblePostWhere(scope, post)) {
        branches.push({
          ...rest,
          post: postBranch,
        } as FindOptionsWhere<Comment>);
      }
    }

    if (branches.length === 0) {
      return undefined;
    }

    normalized.where = branches.length === 1 ? branches[0] : branches;
    normalized.relations = this.ensurePostRelation(normalized.relations);
    return normalized as T;
  }

  private ensurePostRelation(
    relations: FindManyOptions<Comment>['relations']
  ): FindManyOptions<Comment>['relations'] {
    if (!relations) {
      return ['post'];
    }
    if (Array.isArray(relations)) {
      return relations.includes('post') ? relations : [...relations, 'post'];
    }
    return { ...relations, post: true };
  }

  async update(id: string, updateCommentDto: UpdateCommentDto): Promise<void> {
    const sanitizedDto = {
      ...updateCommentDto,
    };
    if (updateCommentDto.content) {
      sanitizedDto.content = this.sanitizeContent(updateCommentDto.content);
    }
    await this.commentRepo.update(id, sanitizedDto);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.commentRepo.delete(id);
    return { success: true };
  }

  async moderate(
    id: string,
    moderationStatus: 'visible' | 'hidden',
    moderatedBy: string,
    moderationNotes?: string
  ): Promise<Comment> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) {
      throw new RpcException('Comment not found');
    }

    await this.commentRepo.update(id, {
      moderationStatus,
      moderationNotes: moderationNotes ?? null,
      moderatedBy,
      moderatedAt: new Date(),
    });

    return await this.commentRepo.findOne({ where: { id } });
  }

  private withDefaultModerationFilter<
    T extends FindManyOptions<Comment> | FindOneOptions<Comment> | undefined
  >(options?: T): T {
    const normalized = { ...(options ?? {}) } as T;
    const where = (
      normalized as FindManyOptions<Comment> | FindOneOptions<Comment>
    ).where;

    if (!where) {
      (normalized as FindManyOptions<Comment> | FindOneOptions<Comment>).where =
        { moderationStatus: 'visible' };
      return normalized;
    }

    if (Array.isArray(where)) {
      (normalized as FindManyOptions<Comment> | FindOneOptions<Comment>).where =
        where.map((entry) =>
          entry.moderationStatus === undefined
            ? { ...entry, moderationStatus: 'visible' }
            : entry
        );
      return normalized;
    }

    if ((where as any).moderationStatus === undefined) {
      (normalized as FindManyOptions<Comment> | FindOneOptions<Comment>).where =
        { ...where, moderationStatus: 'visible' };
    }

    return normalized;
  }
}
