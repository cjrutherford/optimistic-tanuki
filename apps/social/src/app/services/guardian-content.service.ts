import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { RpcException } from '@nestjs/microservices';
import {
  AuthCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource, IsNull, LessThan, LessThanOrEqual } from 'typeorm';
import DOMPurify from 'isomorphic-dompurify';
import { Inject } from '@nestjs/common';
import { GuardianContentAudit } from '../../entities/guardian-content-audit.entity';
import { Post } from '../../entities/post.entity';
import { Comment } from '../../entities/comment.entity';
import { Attachment } from '../../entities/attachment.entity';
import { PostService } from './post.service';

type Actor = { actorUserId: string; targetProfileId: string; appId: string };
type ProfileRecord = { id: string; userId: string; appScope?: string | null };
type ContentInput = Record<string, unknown>;

const APP_IDS = new Set(['client-interface', 'local-hub']);
const LEGACY_SCOPE = 'social';
const POST_FIELDS = new Set(['title', 'content', 'visibility']);
const COMMENT_FIELDS = new Set(['content']);

@Injectable()
export class GuardianContentService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;
  private readonly logger = new Logger(GuardianContentService.name);

  constructor(
    @Inject('SOCIAL_CONNECTION') private readonly dataSource: DataSource,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    private readonly postService: PostService
  ) {}

  onModuleInit(): void {
    void this.cleanupExpiredAudit().catch(() => undefined);
    this.cleanupTimer = setInterval(
      () => void this.cleanupExpiredAudit().catch(() => undefined),
      24 * 60 * 60 * 1000
    );
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async cleanupExpiredAudit(now = new Date()): Promise<number> {
    const threshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    try {
      const result = await this.dataSource
        .getRepository(GuardianContentAudit)
        .delete({ createdAt: LessThan(threshold) });
      return result.affected ?? 0;
    } catch (error) {
      this.logger.error('Guardian content audit retention cleanup failed');
      throw error;
    }
  }

  async listPosts(input: Actor) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.resolveProfile(input);
      await this.authorize(input, profile, 'content.view');
      const now = new Date();
      const posts = await manager.getRepository(Post).find({
        where: [
          {
            profileId: profile.id,
            communityId: IsNull(),
            moderationStatus: 'visible',
            isScheduled: false,
            scheduledAt: IsNull(),
          },
          {
            profileId: profile.id,
            communityId: IsNull(),
            moderationStatus: 'visible',
            isScheduled: false,
            scheduledAt: LessThanOrEqual(now),
          },
        ],
        order: { createdAt: 'DESC' },
        take: 100,
      });
      for (const post of posts) {
        this.assertStoredOwner(post, profile, input.appId);
        await this.audit(manager, input, profile, 'post', post.id, 'view', []);
      }
      return posts;
    });
  }

  async getPost(input: Actor & { id: string }) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.resolveProfile(input);
      const post = await manager
        .getRepository(Post)
        .findOne({ where: { id: input.id } });
      if (!post || post.profileId !== profile.id || post.communityId)
        return null;
      this.assertStoredOwner(post, profile, input.appId);
      this.assertEligibleParent(
        post,
        profile,
        input.appId,
        'Guardian content requires a visible personal post owned by the dependent'
      );
      await this.authorize(input, profile, 'content.view');
      await this.audit(manager, input, profile, 'post', post.id, 'view', []);
      return post;
    });
  }

  async createPost(input: Actor & { data: ContentInput }) {
    const fields = this.validateFields(input.data, POST_FIELDS, [
      'title',
      'content',
    ]);
    if (
      typeof fields.title !== 'string' ||
      !fields.title.trim() ||
      fields.title.length > 500 ||
      typeof fields.content !== 'string' ||
      !fields.content.trim() ||
      fields.content.length > 50000
    ) {
      throw this.denied('Invalid guardian post content');
    }
    const title = fields.title as string;
    const content = fields.content as string;
    const visibility = fields.visibility ?? 'public';
    if (visibility !== 'public' && visibility !== 'followers')
      throw this.denied('Community posts are outside guardian content access');
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.resolveProfile(input);
      await this.authorize(input, profile, 'content.manage');
      const repo = manager.getRepository(Post);
      const post = repo.create({
        title: title.trim(),
        content: this.sanitize(content),
        visibility,
        publicAudienceExplicit: false,
        profileId: profile.id,
        userId: profile.userId,
        appScope: input.appId,
        communityId: null,
      });
      await this.postService.latchPrivateAssetReferences(post);
      const saved = await repo.save(post);
      await this.audit(
        manager,
        input,
        profile,
        'post',
        saved.id,
        'create',
        Object.keys(fields)
      );
      return saved;
    });
  }

  async updatePost(input: Actor & { id: string; data: ContentInput }) {
    const fields = this.validateFields(input.data, POST_FIELDS, []);
    if (
      'title' in fields &&
      (typeof fields.title !== 'string' ||
        !fields.title.trim() ||
        fields.title.length > 500)
    )
      throw this.denied('Invalid guardian post title');
    if (
      'content' in fields &&
      (typeof fields.content !== 'string' ||
        !fields.content.trim() ||
        fields.content.length > 50000)
    )
      throw this.denied('Invalid guardian post content');
    if (
      'visibility' in fields &&
      fields.visibility !== 'public' &&
      fields.visibility !== 'followers'
    )
      throw this.denied('Community posts are outside guardian content access');
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.resolveProfile(input);
      const repo = manager.getRepository(Post);
      const post = await repo.findOne({
        where: { id: input.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post || post.profileId !== profile.id || post.communityId)
        return null;
      this.assertStoredOwner(post, profile, input.appId);
      this.assertEligibleParent(
        post,
        profile,
        input.appId,
        'Guardian content requires a visible personal post owned by the dependent'
      );
      await this.authorize(input, profile, 'content.manage');
      const update: Partial<Post> = { ...fields } as Partial<Post>;
      if (typeof fields.content === 'string')
        update.content = this.sanitize(fields.content);
      const nextAudience = {
        ...post,
        ...update,
        profileId: post.profileId,
      } as Post;
      await this.postService.latchPostAndCommentAssetReferences(post);
      if (
        nextAudience.visibility !== 'public' ||
        nextAudience.content !== post.content
      ) {
        await this.postService.latchPostAndCommentAssetReferences(nextAudience);
      }
      await repo.update(post.id, update);
      const saved = await repo.findOne({ where: { id: post.id } });
      await this.audit(
        manager,
        input,
        profile,
        'post',
        post.id,
        'update',
        Object.keys(fields)
      );
      return saved;
    });
  }

  async deletePost(input: Actor & { id: string }) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.resolveProfile(input);
      const repo = manager.getRepository(Post);
      const post = await repo.findOne({
        where: { id: input.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post || post.profileId !== profile.id || post.communityId)
        return null;
      this.assertStoredOwner(post, profile, input.appId);
      this.assertEligibleParent(
        post,
        profile,
        input.appId,
        'Guardian content requires a visible personal post owned by the dependent'
      );
      await this.authorize(input, profile, 'content.manage');
      const postId = post.id;
      await this.postService.latchPostAndCommentAssetReferences(post);
      await manager.getRepository(Comment).delete({ post: { id: postId } });
      await manager.getRepository(Attachment).delete({ post: { id: postId } });
      await repo.delete(postId);
      await this.audit(manager, input, profile, 'post', postId, 'delete', []);
      return { success: true };
    });
  }

  async listComments(input: Actor & { postId: string }) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.resolveProfile(input);
      const post = await this.findParent(
        manager,
        input.postId,
        profile,
        input.appId
      );
      await this.authorize(input, profile, 'content.view');
      const comments = await manager.getRepository(Comment).find({
        where: {
          post: { id: post.id },
          profileId: profile.id,
          userId: profile.userId,
          moderationStatus: 'visible',
        },
        order: { createdAt: 'ASC' },
      });
      for (const comment of comments) {
        this.assertStoredOwner(comment, profile, input.appId);
        await this.audit(
          manager,
          input,
          profile,
          'comment',
          comment.id,
          'view',
          []
        );
      }
      return comments;
    });
  }

  async getComment(input: Actor & { id: string }) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.resolveProfile(input);
      const comment = await manager
        .getRepository(Comment)
        .findOne({ where: { id: input.id }, relations: ['post'] });
      if (
        !comment ||
        comment.profileId !== profile.id ||
        comment.userId !== profile.userId ||
        !comment.post ||
        comment.post.profileId !== profile.id ||
        comment.post.communityId
      )
        return null;
      this.assertStoredOwner(comment, profile, input.appId);
      this.assertStoredOwner(comment.post, profile, input.appId);
      this.assertEligibleParent(
        comment.post,
        profile,
        input.appId,
        'Guardian comments require a visible personal post owned by the dependent'
      );
      await this.authorize(input, profile, 'content.view');
      await this.audit(
        manager,
        input,
        profile,
        'comment',
        comment.id,
        'view',
        []
      );
      return comment;
    });
  }

  async createComment(input: Actor & { data: ContentInput }) {
    const fields = this.validateFields(
      input.data,
      new Set(['postId', 'content']),
      ['postId', 'content']
    );
    if (
      typeof fields.postId !== 'string' ||
      typeof fields.content !== 'string' ||
      !fields.content.trim() ||
      fields.content.length > 10000
    )
      throw this.denied('Invalid guardian comment content');
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.resolveProfile(input);
      const post = await this.findParent(
        manager,
        fields.postId as string,
        profile,
        input.appId,
        true
      );
      await this.authorize(input, profile, 'content.manage');
      const sanitizedContent = this.sanitize(fields.content as string);
      await this.postService.latchCommentAssetContent(
        sanitizedContent,
        post,
        profile.id
      );
      const repo = manager.getRepository(Comment);
      const comment = repo.create({
        content: sanitizedContent,
        post,
        profileId: profile.id,
        userId: profile.userId,
        appScope: input.appId,
      });
      const saved = await repo.save(comment);
      await this.audit(manager, input, profile, 'comment', saved.id, 'create', [
        'content',
      ]);
      return saved;
    });
  }

  async updateComment(input: Actor & { id: string; data: ContentInput }) {
    const fields = this.validateFields(input.data, COMMENT_FIELDS, []);
    if (
      'content' in fields &&
      (typeof fields.content !== 'string' ||
        !fields.content.trim() ||
        fields.content.length > 10000)
    )
      throw this.denied('Invalid guardian comment content');
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.resolveProfile(input);
      const repo = manager.getRepository(Comment);
      const initial = await repo.findOne({
        where: { id: input.id },
        relations: ['post'],
      });
      if (!initial?.post) return null;
      const lockedParent = await manager.getRepository(Post).findOne({
        where: { id: initial.post.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedParent) return null;
      const comment = await repo.findOne({
        where: { id: input.id },
        relations: ['post'],
      });
      if (
        !comment ||
        comment.profileId !== profile.id ||
        comment.userId !== profile.userId ||
        !comment.post ||
        comment.post.profileId !== profile.id ||
        comment.post.communityId
      )
        return null;
      this.assertStoredOwner(comment, profile, input.appId);
      this.assertStoredOwner(comment.post, profile, input.appId);
      this.assertEligibleParent(
        comment.post,
        profile,
        input.appId,
        'Guardian comments require a visible personal post owned by the dependent'
      );
      await this.authorize(input, profile, 'content.manage');
      if (typeof fields.content === 'string') {
        const sanitizedContent = this.sanitize(fields.content);
        await this.postService.latchCommentAssetContent(
          comment.content,
          lockedParent,
          profile.id
        );
        await this.postService.latchCommentAssetContent(
          sanitizedContent,
          lockedParent,
          profile.id
        );
        await repo.update(comment.id, { content: sanitizedContent });
      }
      const saved = await repo.findOne({
        where: { id: comment.id },
        relations: ['post'],
      });
      await this.audit(
        manager,
        input,
        profile,
        'comment',
        comment.id,
        'update',
        Object.keys(fields)
      );
      return saved;
    });
  }

  async deleteComment(input: Actor & { id: string }) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await this.resolveProfile(input);
      const repo = manager.getRepository(Comment);
      const initial = await repo.findOne({
        where: { id: input.id },
        relations: ['post'],
      });
      if (!initial?.post) return null;
      const lockedParent = await manager.getRepository(Post).findOne({
        where: { id: initial.post.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedParent) return null;
      const comment = await repo.findOne({
        where: { id: input.id },
        relations: ['post'],
      });
      if (
        !comment ||
        comment.profileId !== profile.id ||
        comment.userId !== profile.userId ||
        !comment.post ||
        comment.post.profileId !== profile.id ||
        comment.post.communityId
      )
        return null;
      this.assertStoredOwner(comment, profile, input.appId);
      this.assertStoredOwner(comment.post, profile, input.appId);
      this.assertEligibleParent(
        comment.post,
        profile,
        input.appId,
        'Guardian comments require a visible personal post owned by the dependent'
      );
      await this.authorize(input, profile, 'content.manage');
      const commentId = comment.id;
      await this.postService.latchCommentAssetContent(
        comment.content,
        lockedParent,
        profile.id
      );
      await repo.remove(comment);
      await this.audit(
        manager,
        input,
        profile,
        'comment',
        commentId,
        'delete',
        []
      );
      return { success: true };
    });
  }

  private async resolveProfile(input: Actor): Promise<ProfileRecord> {
    if (
      !APP_IDS.has(input.appId) ||
      !input.actorUserId ||
      !input.targetProfileId
    )
      throw this.denied('Invalid guardian content target');
    const profile = (await firstValueFrom(
      this.profileClient
        .send({ cmd: ProfileCommands.Get }, { id: input.targetProfileId })
        .pipe(timeout(3000))
    )) as ProfileRecord;
    if (
      !profile ||
      profile.id !== input.targetProfileId ||
      !profile.userId ||
      profile.appScope !== input.appId
    )
      throw this.denied(
        'Guardian content target profile does not match the verified application'
      );
    return profile;
  }

  private async authorize(
    input: Actor,
    profile: ProfileRecord,
    operation: 'content.view' | 'content.manage'
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.authClient
          .send(
            { cmd: AuthCommands.AuthorizeGuardianContentOperation },
            {
              actorUserId: input.actorUserId,
              dependentUserId: profile.userId,
              appId: input.appId,
              operation,
            }
          )
          .pipe(timeout(3000))
      );
    } catch (error) {
      const details = error instanceof RpcException ? error.getError() : error;
      if (
        details &&
        typeof details === 'object' &&
        'statusCode' in details &&
        details.statusCode === 403 &&
        'code' in details &&
        details.code === 'GUARDIAN_CONTENT_ACCESS_DENIED'
      ) {
        throw new RpcException({
          statusCode: 403,
          code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
          message: 'Guardian content access denied',
        });
      }
      throw error;
    }
  }

  private async findParent(
    manager: any,
    postId: string,
    profile: ProfileRecord,
    appId: string,
    lock = false
  ): Promise<Post> {
    const post = await manager.getRepository(Post).findOne({
      where: { id: postId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!post || post.profileId !== profile.id || post.communityId)
      throw this.denied(
        'Guardian comments require a visible personal post owned by the dependent'
      );
    this.assertStoredOwner(post, profile, appId);
    this.assertEligibleParent(
      post,
      profile,
      appId,
      'Guardian comments require a visible personal post owned by the dependent'
    );
    return post;
  }

  private assertEligibleParent(
    post: Post,
    profile: ProfileRecord,
    appId: string,
    message: string
  ): void {
    if (
      post.profileId !== profile.id ||
      post.userId !== profile.userId ||
      post.communityId ||
      post.moderationStatus !== 'visible' ||
      post.isScheduled ||
      (post.scheduledAt && post.scheduledAt > new Date())
    ) {
      throw this.denied(message);
    }
    this.assertStoredOwner(post, profile, appId);
  }

  private assertStoredOwner(
    row: { profileId?: string; userId?: string; appScope?: string },
    profile: ProfileRecord,
    appId: string
  ): void {
    if (
      row.profileId !== profile.id ||
      row.userId !== profile.userId ||
      ![LEGACY_SCOPE, appId].includes(row.appScope ?? '')
    )
      throw this.denied(
        'Stored content owner or application scope is inconsistent'
      );
  }

  private validateFields(
    data: ContentInput,
    allowed: Set<string>,
    required: string[]
  ): ContentInput {
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw this.denied('Invalid guardian content payload');
    const keys = Object.keys(data);
    if (
      keys.some((key) => !allowed.has(key)) ||
      required.some((key) => !(key in data))
    )
      throw this.denied('Guardian content payload contains unsupported fields');
    return data;
  }

  private sanitize(value: string): string {
    return DOMPurify.sanitize(value, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'code', 'img'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
      ALLOW_DATA_ATTR: false,
    });
  }

  private async audit(
    manager: any,
    input: Actor,
    profile: ProfileRecord,
    resourceType: 'post' | 'comment',
    resourceId: string,
    operation: string,
    changedFields: string[]
  ): Promise<void> {
    const audit = manager.getRepository(GuardianContentAudit).create({
      actorUserId: input.actorUserId,
      dependentUserId: profile.userId,
      dependentProfileId: profile.id,
      appId: input.appId,
      resourceType,
      resourceId,
      operation,
      changedFields: [...changedFields].sort(),
    });
    await manager.getRepository(GuardianContentAudit).save(audit);
  }

  private denied(message: string): Error {
    return new RpcException({
      statusCode: 403,
      code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
      message,
    });
  }
}
