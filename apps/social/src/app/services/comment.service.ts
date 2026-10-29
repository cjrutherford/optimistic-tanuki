import { Inject, Injectable, Optional } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AssetCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
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
import { CommunityService } from './community.service';
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
    private readonly postRepo: Repository<Post>,
    @Optional()
    @Inject(ServiceTokens.ASSETS_SERVICE)
    private readonly assetService?: ClientProxy,
    @Optional()
    private readonly communityService?: CommunityService
  ) {}

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'code', 'img'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
      ALLOW_DATA_ATTR: false,
    });
  }

  private async latchParentAudience(
    content: string,
    post: Post,
    commenterProfileId: string
  ): Promise<void> {
    const ids = [
      ...new Set(
        content
          .match(
            /(?:\/api)?\/asset\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?=$|[^0-9a-f-])/gi
          )
          ?.map((match) => match.split('/').pop()!) ?? []
      ),
    ];
    if (!ids.length) return;
    if (!this.assetService) {
      throw new RpcException('Comment image audience service unavailable');
    }

    const community =
      post.communityId && this.communityService
        ? await this.communityService.findOne(post.communityId)
        : undefined;
    const memberOnly =
      post.visibility === 'community' ||
      (post.visibility === 'public' && post.publicAudienceExplicit === false);
    const privateCommunity = !!community?.isPrivate;
    for (const id of ids) {
      const asset = await firstValueFrom(
        this.assetService
          .send({ cmd: AssetCommands.RETRIEVE }, { id })
          .pipe(timeout({ first: 5000 }))
      );
      const restrictions: Array<Record<string, string>> = [];
      if (post.visibility === 'followers' && post.profileId) {
        restrictions.push({ type: 'followers', profileId: post.profileId });
      }
      if (
        (memberOnly || privateCommunity) &&
        post.communityId &&
        asset.profileId
      ) {
        restrictions.push({
          type: 'community',
          profileId: asset.profileId,
          communityId: post.communityId,
        });
      }
      if (restrictions.length) {
        if (asset.profileId !== commenterProfileId) {
          throw new RpcException({
            statusCode: 403,
            message:
              'Comment images must belong to the commenting profile for restricted posts',
          });
        }
        await firstValueFrom(
          this.assetService
            .send(
              { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
              { id, restrictions }
            )
            .pipe(timeout({ first: 5000 }))
        );
      }
    }
  }

  async create(createCommentDto: CreateCommentDto): Promise<Comment> {
    console.log('Creating comment');
    return this.postRepo.manager.transaction(async (manager) => {
      const postRepo = manager.getRepository(Post);
      const commentRepo = manager.getRepository(Comment);
      try {
        console.log('finding post');
        const post = await postRepo.findOne({
          where: { id: createCommentDto.postId },
          lock: { mode: 'pessimistic_write' },
        }); // njsscan-ignore: node_nosqli_injection
        if (!post) {
          console.log('post not found');
          throw new RpcException('Post not found');
        }
        console.log('post found', post);
        const sanitizedContent = this.sanitizeContent(
          createCommentDto.content || ''
        );
        await this.latchParentAudience(
          sanitizedContent,
          post,
          createCommentDto.profileId
        );
        const commentToCreate: Partial<Comment> = {
          ...createCommentDto,
          content: sanitizedContent,
          post,
        };
        const comment = await commentRepo.create(commentToCreate);
        return await commentRepo.save(comment);
      } catch (error) {
        if (error instanceof RpcException) throw error;
        throw new RpcException(error.message);
      }
    });
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

  async update(
    id: string,
    updateCommentDto: UpdateCommentDto,
    userId: string,
    profileId: string
  ): Promise<void> {
    return this.postRepo.manager.transaction(async (manager) => {
      const postRepo = manager.getRepository(Post);
      const commentRepo = manager.getRepository(Comment);
      const initial = await commentRepo.findOne({
        where: { id },
        relations: ['post'],
      });
      if (
        !initial ||
        initial.userId !== userId ||
        initial.profileId !== profileId ||
        !initial.post
      ) {
        throw new RpcException({
          statusCode: 403,
          message: 'You do not have permission to update this comment',
        });
      }
      const parent = await postRepo.findOne({
        where: { id: initial.post.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!parent) throw new RpcException('Post not found');
      const existing = await commentRepo.findOne({
        where: { id },
        relations: ['post'],
      });
      if (
        !existing ||
        existing.post?.id !== parent.id ||
        existing.userId !== userId ||
        existing.profileId !== profileId
      ) {
        throw new RpcException({
          statusCode: 403,
          message: 'You do not have permission to update this comment',
        });
      }
      const sanitizedDto: Partial<Comment> = {};
      if (typeof updateCommentDto.content === 'string') {
        sanitizedDto.content = this.sanitizeContent(updateCommentDto.content);
        await this.latchParentAudience(
          existing.content,
          parent,
          existing.profileId
        );
        await this.latchParentAudience(
          sanitizedDto.content,
          parent,
          existing.profileId
        );
      }
      await commentRepo.update(id, sanitizedDto);
    });
  }

  async remove(
    id: string,
    userId: string,
    profileId: string
  ): Promise<{ success: boolean }> {
    return this.postRepo.manager.transaction(async (manager) => {
      const postRepo = manager.getRepository(Post);
      const commentRepo = manager.getRepository(Comment);
      const initial = await commentRepo.findOne({
        where: { id },
        relations: ['post'],
      });
      if (
        !initial ||
        initial.userId !== userId ||
        initial.profileId !== profileId ||
        !initial.post
      ) {
        throw new RpcException({
          statusCode: 403,
          message: 'You do not have permission to delete this comment',
        });
      }
      const parent = await postRepo.findOne({
        where: { id: initial.post.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!parent) throw new RpcException('Post not found');
      const existing = await commentRepo.findOne({
        where: { id },
        relations: ['post'],
      });
      if (
        !existing ||
        existing.post?.id !== parent.id ||
        existing.userId !== userId ||
        existing.profileId !== profileId
      ) {
        throw new RpcException({
          statusCode: 403,
          message: 'You do not have permission to delete this comment',
        });
      }
      await this.latchParentAudience(
        existing.content,
        parent,
        existing.profileId
      );
      await commentRepo.delete(id);
      return { success: true };
    });
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
