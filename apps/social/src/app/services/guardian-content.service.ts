import { Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { RpcException } from '@nestjs/microservices';
import {
  AuthCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource, EntityManager, IsNull, LessThanOrEqual } from 'typeorm';
import DOMPurify from 'isomorphic-dompurify';
import { Inject } from '@nestjs/common';
import { GuardianContentAudit } from '../../entities/guardian-content-audit.entity';
import { GuardianPublishedAssetGrant } from '../../entities/guardian-published-asset-grant.entity';
import FollowEntity from '../../entities/Follow.entity';
import { guardianPublishedAssetReferences } from './guardian-published-asset-reference.util';
import { Post } from '../../entities/post.entity';
import { Comment } from '../../entities/comment.entity';
import { Attachment } from '../../entities/attachment.entity';
import { PostService } from './post.service';

type Actor = { actorUserId: string; targetProfileId: string; appId: string };
type ProfileRecord = { id: string; userId: string; appScope?: string | null };
type ContentInput = Record<string, unknown>;

const APP_IDS = new Set(['client-interface', 'local-hub']);
const LEGACY_SCOPE = 'social';
const POST_FIELDS = new Set([
  'title',
  'content',
  'visibility',
  'publishAssetIds',
]);
const COMMENT_FIELDS = new Set(['content', 'publishAssetIds']);
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class GuardianContentService {
  private readonly logger = new Logger(GuardianContentService.name);

  constructor(
    @Inject('SOCIAL_CONNECTION') private readonly dataSource: DataSource,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    private readonly postService: PostService
  ) {}

  async cleanupExpiredAudit(now = new Date()): Promise<number> {
    const threshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    try {
      const result = await this.dataSource
        .getRepository(GuardianContentAudit)
        .delete({ createdAt: LessThanOrEqual(threshold) });
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
      await this.postService.latchPrivateAssetReferences(post, {
        dependentProfileId: profile.id,
        appId: input.appId,
        allowedAssetIds: this.selectedAssetIds(fields.publishAssetIds),
      });
      const saved = await repo.save(post);
      await this.persistPublishedAssetGrants(
        manager,
        input,
        profile,
        'post',
        saved.id,
        fields.publishAssetIds,
        saved.content
      );
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
      const { publishAssetIds, ...postFields } = fields;
      const update: Partial<Post> = { ...postFields } as Partial<Post>;
      if (typeof fields.content === 'string')
        update.content = this.sanitize(fields.content);
      const nextAudience = {
        ...post,
        ...update,
        profileId: post.profileId,
      } as Post;
      const guardianStageContext = {
        dependentProfileId: profile.id,
        appId: input.appId,
        allowedAssetIds: await this.allowedStageAssetIds(
          manager,
          profile.id,
          input.appId,
          'post',
          post.id,
          publishAssetIds
        ),
        commentAllowedAssetIds: await this.allowedStageCommentAssetIds(
          manager,
          profile.id,
          input.appId,
          post.id
        ),
      };
      await this.postService.latchPostAndCommentAssetReferences(
        post,
        guardianStageContext
      );
      if (
        nextAudience.visibility !== 'public' ||
        nextAudience.content !== post.content
      ) {
        await this.postService.latchPostAndCommentAssetReferences(
          nextAudience,
          guardianStageContext
        );
      }
      await repo.update(post.id, update);
      const saved = await repo.findOne({ where: { id: post.id } });
      if (saved)
        await this.persistPublishedAssetGrants(
          manager,
          input,
          profile,
          'post',
          saved.id,
          publishAssetIds,
          saved.content
        );
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
      await this.postService.latchPostAndCommentAssetReferences(post, {
        dependentProfileId: profile.id,
        appId: input.appId,
        allowedAssetIds: await this.allowedStageAssetIds(
          manager,
          profile.id,
          input.appId,
          'post',
          post.id,
          undefined
        ),
        commentAllowedAssetIds: await this.allowedStageCommentAssetIds(
          manager,
          profile.id,
          input.appId,
          post.id
        ),
      });
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
      new Set(['postId', 'content', 'publishAssetIds']),
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
        profile.id,
        {
          dependentProfileId: profile.id,
          appId: input.appId,
          allowedAssetIds: this.selectedAssetIds(fields.publishAssetIds),
        }
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
      await this.persistPublishedAssetGrants(
        manager,
        input,
        profile,
        'comment',
        saved.id,
        fields.publishAssetIds,
        saved.content
      );
      await this.audit(
        manager,
        input,
        profile,
        'comment',
        saved.id,
        'create',
        Object.keys(fields)
      );
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
      const allowedAssetIds = await this.allowedStageAssetIds(
        manager,
        profile.id,
        input.appId,
        'comment',
        comment.id,
        fields.publishAssetIds
      );
      if (typeof fields.content === 'string') {
        const sanitizedContent = this.sanitize(fields.content);
        await this.postService.latchCommentAssetContent(
          comment.content,
          lockedParent,
          profile.id,
          {
            dependentProfileId: profile.id,
            appId: input.appId,
            allowedAssetIds,
          }
        );
        await this.postService.latchCommentAssetContent(
          sanitizedContent,
          lockedParent,
          profile.id,
          {
            dependentProfileId: profile.id,
            appId: input.appId,
            allowedAssetIds,
          }
        );
        await repo.update(comment.id, { content: sanitizedContent });
      }
      const saved = await repo.findOne({
        where: { id: comment.id },
        relations: ['post'],
      });
      if (saved)
        await this.persistPublishedAssetGrants(
          manager,
          input,
          profile,
          'comment',
          saved.id,
          fields.publishAssetIds,
          saved.content
        );
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
      const allowedAssetIds = await this.allowedStageAssetIds(
        manager,
        profile.id,
        input.appId,
        'comment',
        comment.id,
        undefined
      );
      await this.postService.latchCommentAssetContent(
        comment.content,
        lockedParent,
        profile.id,
        { dependentProfileId: profile.id, appId: input.appId, allowedAssetIds }
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

  private async persistPublishedAssetGrants(
    manager: EntityManager,
    input: Actor,
    profile: ProfileRecord,
    resourceType: 'post' | 'comment',
    resourceId: string,
    rawAssetIds: unknown,
    resultingContent: string
  ): Promise<void> {
    if (rawAssetIds === undefined) return;
    if (
      !Array.isArray(rawAssetIds) ||
      rawAssetIds.length > 50 ||
      rawAssetIds.some((id) => typeof id !== 'string' || !UUID.test(id))
    ) {
      throw this.denied('Invalid published asset identifiers');
    }
    const assetIds = (rawAssetIds as string[]).map((id) => id.toLowerCase());
    if (new Set(assetIds).size !== assetIds.length) {
      throw this.denied('Published asset identifiers must be unique');
    }
    const references = guardianPublishedAssetReferences(resultingContent);
    if (assetIds.some((id) => !references.has(id.toLowerCase()))) {
      throw this.denied(
        'Every published asset must be referenced by the resource'
      );
    }
    const grantRepo = manager.getRepository(GuardianPublishedAssetGrant);
    for (const assetId of assetIds) {
      const asset = await this.postService.getAssetForGuardianPublication(
        assetId
      );
      const stage = asset.audienceRestrictions?.some(
        (restriction) =>
          restriction.type === 'guardian-staged' &&
          restriction.profileId === profile.id &&
          restriction.appId === input.appId
      );
      if (
        asset.id !== assetId ||
        asset.originKind !== 'guardian-staged' ||
        asset.profileId !== profile.id ||
        asset.originProfileId !== profile.id ||
        asset.originAppId !== input.appId ||
        !stage
      )
        throw this.denied(
          'Asset is not staged for this dependent and application'
        );
      const existing = await grantRepo.findOne({
        where: {
          assetId,
          resourceType,
          resourceId,
          dependentProfileId: profile.id,
          appId: input.appId,
        },
      });
      if (!existing)
        await grantRepo.save(
          grantRepo.create({
            assetId,
            resourceType,
            resourceId,
            dependentProfileId: profile.id,
            appId: input.appId,
            actorUserId: input.actorUserId,
          })
        );
    }
  }

  private selectedAssetIds(raw: unknown): Set<string> {
    return new Set(
      Array.isArray(raw)
        ? raw
            .filter(
              (id): id is string => typeof id === 'string' && UUID.test(id)
            )
            .map((id) => id.toLowerCase())
        : []
    );
  }

  private async allowedStageAssetIds(
    manager: EntityManager,
    dependentProfileId: string,
    appId: string,
    resourceType: 'post' | 'comment',
    resourceId: string,
    selected: unknown
  ): Promise<Set<string>> {
    const ids = this.selectedAssetIds(selected);
    const existing = await manager
      .getRepository(GuardianPublishedAssetGrant)
      .find({
        where: { dependentProfileId, appId, resourceType, resourceId },
      });
    for (const grant of existing) ids.add(grant.assetId.toLowerCase());
    return ids;
  }

  private async allowedStageCommentAssetIds(
    manager: EntityManager,
    dependentProfileId: string,
    appId: string,
    postId: string
  ): Promise<Map<string, Set<string>>> {
    const comments = await manager
      .getRepository(Comment)
      .find({ where: { post: { id: postId } } });
    const result = new Map<string, Set<string>>();
    for (const comment of comments) {
      result.set(
        comment.id,
        await this.allowedStageAssetIds(
          manager,
          dependentProfileId,
          appId,
          'comment',
          comment.id,
          undefined
        )
      );
    }
    return result;
  }

  async resolvePublishedAssetGrant(input: {
    assetId: string;
    appId: string;
    viewerProfileId?: string;
    viewerUserId?: string;
  }) {
    if (!UUID.test(input.assetId) || !APP_IDS.has(input.appId)) return null;
    const grants = await this.dataSource
      .getRepository(GuardianPublishedAssetGrant)
      .find({
        where: { assetId: input.assetId, appId: input.appId },
        order: { resourceType: 'ASC', resourceId: 'ASC' },
      });
    for (const grant of grants) {
      if (await this.isLivePublishedAssetGrant(grant, input)) {
        return {
          assetId: grant.assetId,
          resourceType: grant.resourceType,
          resourceId: grant.resourceId,
          dependentProfileId: grant.dependentProfileId,
          appId: grant.appId,
        };
      }
    }
    return null;
  }

  async checkPublishedAssetGrant(input: {
    assetId: string;
    appId: string;
    resourceType: 'post' | 'comment';
    resourceId: string;
    dependentProfileId: string;
    viewerProfileId?: string;
    viewerUserId?: string;
  }) {
    if (
      !UUID.test(input.assetId) ||
      !UUID.test(input.resourceId) ||
      !UUID.test(input.dependentProfileId) ||
      !APP_IDS.has(input.appId)
    )
      return false;
    const grant = await this.dataSource
      .getRepository(GuardianPublishedAssetGrant)
      .findOne({
        where: {
          assetId: input.assetId,
          appId: input.appId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          dependentProfileId: input.dependentProfileId,
        },
      });
    return !!grant && this.isLivePublishedAssetGrant(grant, input);
  }

  private async isLivePublishedAssetGrant(
    grant: GuardianPublishedAssetGrant,
    input: { appId: string; viewerProfileId?: string; viewerUserId?: string }
  ): Promise<boolean> {
    if (grant.appId !== input.appId || !APP_IDS.has(input.appId)) return false;
    let post: Post | null = null;
    let currentReference: string | undefined;
    if (grant.resourceType === 'post') {
      post = await this.dataSource
        .getRepository(Post)
        .findOne({ where: { id: grant.resourceId } });
      currentReference = post?.content;
    } else if (grant.resourceType === 'comment') {
      const comment = await this.dataSource
        .getRepository(Comment)
        .findOne({ where: { id: grant.resourceId }, relations: ['post'] });
      if (
        !comment ||
        comment.moderationStatus !== 'visible' ||
        comment.appScope !== input.appId ||
        !this.referencesAsset(comment.content, grant.assetId)
      )
        return false;
      post = comment.post;
      currentReference = comment.content;
    } else return false;
    if (
      !post ||
      post.profileId !== grant.dependentProfileId ||
      post.appScope !== input.appId ||
      post.communityId ||
      post.moderationStatus !== 'visible' ||
      post.isScheduled ||
      (post.scheduledAt && post.scheduledAt.getTime() > Date.now()) ||
      !currentReference ||
      !this.referencesAsset(currentReference, grant.assetId)
    )
      return false;
    if (post.visibility === 'public') return true;
    if (post.visibility !== 'followers' || !input.viewerProfileId) return false;
    if (input.viewerProfileId === post.profileId) return true;
    return !!(await this.dataSource.getRepository(FollowEntity).findOne({
      where: {
        followerId: input.viewerProfileId,
        followeeId: post.profileId,
        appScope: input.appId,
      },
    }));
  }

  private referencesAsset(content: string, assetId: string): boolean {
    return guardianPublishedAssetReferences(content).has(assetId.toLowerCase());
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
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        'a',
        'code',
        'img',
        'video',
        'audio',
        'source',
      ],
      ALLOWED_ATTR: [
        'href',
        'src',
        'alt',
        'title',
        'controls',
        'width',
        'height',
        'poster',
      ],
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
