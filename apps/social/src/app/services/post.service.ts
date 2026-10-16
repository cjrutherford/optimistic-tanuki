import { Inject, Injectable, Optional } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { AssetCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '../../entities/post.entity';
import { Attachment } from '../../entities/attachment.entity';
import { Comment } from '../../entities/comment.entity';
import {
  Repository,
  FindOneOptions,
  FindManyOptions,
  In,
  FindOperator,
  FindOptionsWhere,
  MoreThanOrEqual,
  Like,
} from 'typeorm';
import {
  CreatePostDto,
  UpdatePostDto,
  SearchPostDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';
import { CommunityService } from './community.service';
import {
  CommunityMemberRole,
  CommunityMembershipStatus,
} from '../../entities/community-member.entity';

export interface GuardianStageAudienceContext {
  dependentProfileId: string;
  appId: string;
  /** Asset IDs selected for publication, plus exact resources with a durable existing grant. */
  allowedAssetIds: ReadonlySet<string>;
  /** Existing asset grants for child comments, keyed by exact comment resource ID. */
  commentAllowedAssetIds?: ReadonlyMap<string, ReadonlySet<string>>;
}

function denyGuardianStagePublication(): RpcException {
  return new RpcException({
    statusCode: 403,
    code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
    message:
      'Guardian-staged media requires an authorized guardian content mutation',
  });
}

@Injectable()
export class PostService {
  constructor(
    @Inject(getRepositoryToken(Post))
    private readonly postRepo: Repository<Post>,
    @Inject(getRepositoryToken(Attachment))
    private readonly attachmentRepo: Repository<Attachment>,
    @Inject(getRepositoryToken(Comment))
    private readonly commentRepo: Repository<Comment>,
    private readonly communityService: CommunityService,
    @Optional()
    @Inject(ServiceTokens.ASSETS_SERVICE)
    private readonly assetService?: ClientProxy
  ) {}

  async getAssetForGuardianPublication(assetId: string): Promise<{
    id: string;
    profileId: string;
    originKind?: string;
    originProfileId?: string | null;
    originAppId?: string | null;
    audienceRestrictions?: Array<{
      type: string;
      profileId?: string;
      appId?: string;
    }>;
  }> {
    if (!this.assetService)
      throw new Error('Asset authorization service unavailable');
    return firstValueFrom(
      this.assetService
        .send({ cmd: AssetCommands.RETRIEVE }, { id: assetId })
        .pipe(timeout({ first: 5000 }))
    );
  }

  async latchPrivateAssetReferences(
    post: {
      id?: string;
      content?: string;
      attachments?: Array<{ filePath?: string }>;
      profileId?: string;
      visibility?: string;
      communityId?: string;
      publicAudienceExplicit?: boolean;
      appScope?: string;
    },
    guardianStageContext?: GuardianStageAudienceContext
  ): Promise<void> {
    const persistedAttachments = post.id
      ? (await this.attachmentRepo.find({
          where: { post: { id: post.id } },
        })) ?? []
      : [];
    const content = [
      post.content ?? '',
      ...(post.attachments ?? []).map((item) => item.filePath ?? ''),
      ...persistedAttachments.map((item) => item.filePath ?? ''),
    ].join('\n');
    // Older clients emitted /asset/:id while current clients use /api/asset/:id.
    // Both forms must latch before a content mutation can remove the first read path.
    const ids = [
      ...new Set(
        content
          .match(
            /(?:\/api)?\/asset\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?=$|[^0-9a-f-])/gi
          )
          ?.map((match) => match.split('/').pop()!)
      ),
    ];
    if (!ids.length) return;
    if (!this.assetService)
      throw new Error('Asset audience service unavailable');
    const community = post.communityId
      ? await this.communityService.findOne(post.communityId)
      : undefined;
    const isPrivate =
      post.visibility === 'followers' ||
      post.visibility === 'community' ||
      (post.visibility === 'public' &&
        post.publicAudienceExplicit === false &&
        !!post.communityId) ||
      !!community?.isPrivate;
    for (const id of ids) {
      const asset = await firstValueFrom(
        this.assetService
          .send({ cmd: AssetCommands.RETRIEVE }, { id })
          .pipe(timeout({ first: 5000 }))
      );
      const storedRestrictions = Array.isArray(asset.audienceRestrictions)
        ? asset.audienceRestrictions
        : [];
      const storedCommunities = Array.isArray(asset.audienceCommunityIds)
        ? asset.audienceCommunityIds
        : [];
      const stageMarkers = storedRestrictions.filter(
        (restriction) => restriction?.type === 'guardian-staged'
      );
      const stageRestrictionCompatible =
        stageMarkers.length === 1 &&
        guardianStageContext?.allowedAssetIds.has(id.toLowerCase()) &&
        guardianStageContext?.dependentProfileId === post.profileId &&
        guardianStageContext.appId === post.appScope &&
        asset.id === id &&
        asset.originKind === 'guardian-staged' &&
        asset.profileId === guardianStageContext.dependentProfileId &&
        asset.originProfileId === guardianStageContext.dependentProfileId &&
        asset.originAppId === guardianStageContext.appId &&
        stageMarkers[0].profileId === guardianStageContext.dependentProfileId &&
        stageMarkers[0].appId === guardianStageContext.appId;
      if (stageMarkers.length && !stageRestrictionCompatible) {
        throw denyGuardianStagePublication();
      }
      const compatibleRestrictions = storedRestrictions.every(
        (restriction) =>
          (restriction.type === 'guardian-staged' &&
            stageRestrictionCompatible) ||
          (restriction.type === 'followers' &&
            post.visibility === 'followers' &&
            restriction.profileId === post.profileId) ||
          (restriction.type === 'community' &&
            (post.visibility === 'community' ||
              (post.visibility === 'public' &&
                post.publicAudienceExplicit === false)) &&
            restriction.profileId === post.profileId &&
            restriction.communityId === post.communityId)
      );
      const compatibleCommunities = storedCommunities.every(
        (communityId) => !!community?.isPrivate && communityId === community.id
      );
      if (!compatibleRestrictions || !compatibleCommunities) {
        throw new Error('Asset audience is narrower than this post audience');
      }
      if (asset.profileId !== post.profileId) {
        if (isPrivate) {
          throw new RpcException(
            'Restricted posts cannot contain another profile’s image'
          );
        }
        continue;
      }
      if (isPrivate && post.visibility === 'followers') {
        await firstValueFrom(
          this.assetService
            .send(
              { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
              {
                id,
                restrictions: [
                  { type: 'followers', profileId: post.profileId },
                ],
              }
            )
            .pipe(timeout({ first: 5000 }))
        );
      }
      if (
        (post.visibility === 'community' ||
          (post.visibility === 'public' &&
            post.publicAudienceExplicit === false)) &&
        post.communityId
      ) {
        await firstValueFrom(
          this.assetService
            .send(
              { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
              {
                id,
                restrictions: [
                  {
                    type: 'community',
                    profileId: post.profileId,
                    communityId: post.communityId,
                  },
                ],
              }
            )
            .pipe(timeout({ first: 5000 }))
        );
      }
      if (isPrivate && community?.isPrivate) {
        await firstValueFrom(
          this.assetService
            .send(
              { cmd: AssetCommands.ADD_COMMUNITY_AUDIENCE },
              { id, communityId: community.id }
            )
            .pipe(timeout({ first: 5000 }))
        );
      }
    }
  }

  private async getCommentAssetReferences(
    post: Post
  ): Promise<Array<{ id: string; profileId: string; commentId: string }>> {
    const comments =
      (await this.commentRepo.find({
        where: { post: { id: post.id } },
      })) ?? [];
    const pattern =
      /(?:\/api)?\/asset\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?=$|[^0-9a-f-])/gi;
    const references: Array<{
      id: string;
      profileId: string;
      commentId: string;
    }> = [];
    for (const comment of comments) {
      const ids = [
        ...new Set(
          (comment.content.match(pattern) ?? []).map(
            (match) => match.split('/').pop()!
          )
        ),
      ];
      for (const id of ids) {
        references.push({
          id,
          profileId: comment.profileId,
          commentId: comment.id,
        });
      }
    }
    return references;
  }

  private async latchCommentAssetReferences(
    post: Post,
    references: Array<{ id: string; profileId: string; commentId?: string }>,
    guardianStageContext?: GuardianStageAudienceContext
  ): Promise<void> {
    const community = post.communityId
      ? await this.communityService.findOne(post.communityId)
      : undefined;
    const memberOnly =
      post.visibility === 'community' ||
      (post.visibility === 'public' &&
        post.publicAudienceExplicit === false &&
        !!post.communityId);
    const privateCommunity = !!community?.isPrivate;
    const audienceRestricted =
      post.visibility === 'followers' || memberOnly || privateCommunity;
    if (!audienceRestricted && !guardianStageContext) return;
    if (references.length && !this.assetService) {
      throw new Error('Asset audience service unavailable');
    }
    for (const { id, profileId, commentId } of references) {
      const allowedAssetIds =
        guardianStageContext && guardianStageContext.commentAllowedAssetIds
          ? guardianStageContext.commentAllowedAssetIds.get(commentId ?? '') ??
            new Set<string>()
          : guardianStageContext?.allowedAssetIds;
      const resourceContext =
        guardianStageContext && allowedAssetIds
          ? { ...guardianStageContext, allowedAssetIds }
          : guardianStageContext;
      const asset = await firstValueFrom(
        this.assetService!.send({ cmd: AssetCommands.RETRIEVE }, { id }).pipe(
          timeout({ first: 5000 })
        )
      );
      const markers = Array.isArray(asset.audienceRestrictions)
        ? asset.audienceRestrictions.filter(
            (restriction) => restriction?.type === 'guardian-staged'
          )
        : [];
      if (
        markers.length &&
        !(
          markers.length === 1 &&
          resourceContext?.allowedAssetIds.has(id.toLowerCase()) &&
          resourceContext?.dependentProfileId === post.profileId &&
          resourceContext.appId === post.appScope &&
          asset.id === id &&
          asset.originKind === 'guardian-staged' &&
          asset.profileId === resourceContext.dependentProfileId &&
          asset.originProfileId === resourceContext.dependentProfileId &&
          asset.originAppId === resourceContext.appId &&
          markers[0].profileId === resourceContext.dependentProfileId &&
          markers[0].appId === resourceContext.appId
        )
      ) {
        throw denyGuardianStagePublication();
      }
      if (!audienceRestricted) continue;
      // Only the commenter can authorize narrowing their asset. Reject the
      // parent change rather than silently privatizing a third party's URL.
      if (asset.profileId !== profileId) {
        throw new RpcException({
          statusCode: 400,
          message:
            'Restricted posts cannot contain another profile’s comment image',
        });
      }
      const restrictions: Array<Record<string, string>> = [];
      if (post.visibility === 'followers' && post.profileId) {
        restrictions.push({ type: 'followers', profileId: post.profileId });
      }
      if ((memberOnly || privateCommunity) && post.communityId) {
        restrictions.push({
          type: 'community',
          profileId,
          communityId: post.communityId,
        });
      }
      await firstValueFrom(
        this.assetService!.send(
          { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
          { id, restrictions }
        ).pipe(timeout({ first: 5000 }))
      );
      if (privateCommunity) {
        await firstValueFrom(
          this.assetService!.send(
            { cmd: AssetCommands.ADD_COMMUNITY_AUDIENCE },
            { id, communityId: post.communityId }
          ).pipe(timeout({ first: 5000 }))
        );
      }
    }
  }

  async latchCommentAssetContent(
    content: string,
    post: Post,
    commenterProfileId: string,
    guardianStageContext?: GuardianStageAudienceContext
  ): Promise<void> {
    const pattern =
      /(?:\/api)?\/asset\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?=$|[^0-9a-f-])/gi;
    const references = [
      ...new Set(
        (content.match(pattern) ?? []).map((match) => match.split('/').pop()!)
      ),
    ].map((id) => ({ id, profileId: commenterProfileId }));
    await this.latchCommentAssetReferences(
      post,
      references,
      guardianStageContext
    );
  }

  async latchPostAndCommentAssetReferences(
    post: Post,
    guardianStageContext?: GuardianStageAudienceContext
  ): Promise<void> {
    await this.latchPrivateAssetReferences(post, guardianStageContext);
    const references = await this.getCommentAssetReferences(post);
    await this.latchCommentAssetReferences(
      post,
      references,
      guardianStageContext
    );
  }

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
        'img',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
      ALLOW_DATA_ATTR: false,
    });
  }

  async create(createPostDto: CreatePostDto): Promise<Post> {
    // If communityId is provided, check membership
    if (createPostDto.communityId) {
      const isMember = await this.communityService.isMember(
        createPostDto.communityId,
        createPostDto.userId
      );
      if (!isMember) {
        throw new Error('You must be a community member to post');
      }
    }

    const visibility =
      createPostDto.visibility ??
      (createPostDto.communityId ? 'community' : 'public');
    if (
      !['public', 'followers', 'community'].includes(visibility) ||
      (visibility === 'community' && !createPostDto.communityId)
    ) {
      throw new Error('Invalid post audience');
    }
    const normalizedDto = {
      ...createPostDto,
      visibility,
      publicAudienceExplicit:
        !!createPostDto.communityId && visibility === 'public',
    };
    // Sanitize content before saving
    const sanitizedDto = {
      ...normalizedDto,
      content: this.sanitizeContent(normalizedDto.content || ''),
    };
    const post = (this.postRepo.create(sanitizedDto) ?? sanitizedDto) as Post;

    if (createPostDto.attachmentIds && createPostDto.attachmentIds.length > 0) {
      const attachments = await this.attachmentRepo.findBy({
        id: In(createPostDto.attachmentIds),
      });
      post.attachments = attachments;
    }

    await this.latchPrivateAssetReferences(post);

    return await this.postRepo.save(post);
  }

  async findAll(options?: FindManyOptions<Post>): Promise<Post[]> {
    return await this.postRepo.find(this.withDefaultModerationFilter(options));
  }

  async findOne(id: string, options?: FindOneOptions<Post>): Promise<Post> {
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
    return await this.postRepo.findOne(finalOptions);
  }

  async findAssetAudienceReferences(
    assetId: string,
    assetProfileId: string
  ): Promise<{
    restrictions: Array<
      | { type: 'owner' | 'followers'; profileId: string }
      | { type: 'community'; profileId: string; communityId: string }
    >;
    communityIds: string[];
  }> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        assetId
      )
    ) {
      throw new Error('Invalid asset id');
    }
    const candidates = await this.postRepo.find({
      where: { content: Like(`%/asset/${assetId}%`) },
    });
    const exactReference = new RegExp(`/asset/${assetId}(?=$|[^A-Za-z0-9-])`);
    const restrictions = new Map<
      string,
      | { type: 'owner' | 'followers'; profileId: string }
      | { type: 'community'; profileId: string; communityId: string }
    >();
    const communityIds = new Set<string>();

    for (const post of candidates) {
      if (!exactReference.test(post.content ?? '')) continue;
      // A public asset owned by someone else must not become private because
      // another author embedded its URL in a restricted post.
      if (post.profileId !== assetProfileId) continue;
      if (post.visibility === 'followers' && post.profileId) {
        const key = `followers:${post.profileId}`;
        restrictions.set(key, {
          type: 'followers',
          profileId: post.profileId,
        });
      }
      if (
        (post.visibility === 'community' ||
          (post.visibility === 'public' &&
            post.publicAudienceExplicit === false)) &&
        post.profileId &&
        post.communityId
      ) {
        const key = `community:${post.profileId}:${post.communityId}`;
        restrictions.set(key, {
          type: 'community',
          profileId: post.profileId,
          communityId: post.communityId,
        });
      }
      if (post.communityId) {
        const community = await this.communityService.findOne(post.communityId);
        if (community?.isPrivate) communityIds.add(post.communityId);
      }
    }

    // Comments are independently addressable HTML references. Include them in
    // live policy checks so pre-latch rows inherit the current parent audience.
    const commentCandidates =
      (await this.commentRepo.find({
        where: { content: Like(`%/asset/${assetId}%`) },
        relations: ['post'],
      })) ?? [];
    for (const comment of commentCandidates) {
      if (!exactReference.test(comment.content ?? '') || !comment.post)
        continue;
      if (comment.profileId !== assetProfileId) continue;
      const parent = comment.post;
      if (parent.visibility === 'followers' && parent.profileId) {
        const key = `followers:${parent.profileId}`;
        restrictions.set(key, {
          type: 'followers',
          profileId: parent.profileId,
        });
      }
      if (
        (parent.visibility === 'community' ||
          (parent.visibility === 'public' &&
            parent.publicAudienceExplicit === false)) &&
        parent.profileId &&
        parent.communityId
      ) {
        const key = `community:${comment.profileId}:${parent.communityId}`;
        restrictions.set(key, {
          type: 'community',
          profileId: comment.profileId,
          communityId: parent.communityId,
        });
      }
      if (parent.communityId) {
        const community = await this.communityService.findOne(
          parent.communityId
        );
        if (community?.isPrivate) communityIds.add(parent.communityId);
      }
    }

    // Attachments hold the same URL references as post HTML. Include them in
    // the live policy result even before a mutation has persisted a latch.
    const attachmentCandidates =
      (await this.attachmentRepo.find({
        where: { filePath: Like(`%/asset/${assetId}%`) },
        relations: ['post'],
      })) ?? [];
    for (const attachment of attachmentCandidates) {
      if (!exactReference.test(attachment.filePath ?? '') || !attachment.post)
        continue;
      const parent = attachment.post;
      if (parent.profileId !== assetProfileId) continue;
      if (parent.visibility === 'followers' && parent.profileId) {
        restrictions.set(`followers:${parent.profileId}`, {
          type: 'followers',
          profileId: parent.profileId,
        });
      }
      if (
        (parent.visibility === 'community' ||
          (parent.visibility === 'public' &&
            parent.publicAudienceExplicit === false)) &&
        parent.profileId &&
        parent.communityId
      ) {
        restrictions.set(
          `community:${parent.profileId}:${parent.communityId}`,
          {
            type: 'community',
            profileId: parent.profileId,
            communityId: parent.communityId,
          }
        );
      }
      if (parent.communityId) {
        const community = await this.communityService.findOne(
          parent.communityId
        );
        if (community?.isPrivate) communityIds.add(parent.communityId);
      }
    }

    return {
      restrictions: [...restrictions.values()],
      communityIds: [...communityIds],
    };
  }

  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    userId: string,
    profileId?: string
  ): Promise<Post> {
    return this.postRepo.manager.transaction(async (manager) => {
      const postRepo = manager.getRepository(Post);
      const post = await postRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post) throw new Error('Post not found');

      if (
        !post.communityId &&
        (post.profileId !== profileId || post.userId !== userId)
      ) {
        throw new RpcException({
          statusCode: 403,
          message: 'You do not have permission to update this post',
        });
      }

      // If it's a community post, check membership or moderator privileges
      if (post.communityId) {
        const hasPermission = await this.communityService.hasPermission(
          post.communityId,
          userId,
          [
            CommunityMemberRole.OWNER,
            CommunityMemberRole.ADMIN,
            CommunityMemberRole.MODERATOR,
          ]
        );
        const isMember = await this.communityService.isMember(
          post.communityId,
          userId
        );

        // Allow if user is a moderator OR if user is the post author (who is also a member)
        if (!hasPermission && (!isMember || post.userId !== userId)) {
          throw new RpcException({
            statusCode: 403,
            message: 'You do not have permission to update this post',
          });
        }
      }

      if (
        updatePostDto.communityId !== undefined &&
        updatePostDto.communityId !== post.communityId
      ) {
        throw new Error('A post cannot be moved between communities');
      }
      if (updatePostDto.visibility === 'community' && !post.communityId) {
        throw new Error('Community audience requires a community post');
      }
      if (
        updatePostDto.visibility !== undefined &&
        !['public', 'followers', 'community'].includes(updatePostDto.visibility)
      ) {
        throw new Error('Invalid post audience');
      }

      // Sanitize content if provided
      const updatedAudiencePost = {
        ...post,
        ...updatePostDto,
        content: updatePostDto.content ?? post.content,
        profileId: post.profileId,
      } as Post;
      await this.latchPostAndCommentAssetReferences(post);
      if (
        updatedAudiencePost.visibility !== 'public' ||
        updatedAudiencePost.content !== post.content
      ) {
        await this.latchPostAndCommentAssetReferences(updatedAudiencePost);
      }
      const sanitizedDto: Partial<Post> = {
        ...(updatePostDto.title !== undefined
          ? { title: updatePostDto.title }
          : {}),
        ...(updatePostDto.visibility !== undefined
          ? {
              visibility: updatePostDto.visibility,
              publicAudienceExplicit:
                !!post.communityId && updatePostDto.visibility === 'public',
            }
          : { publicAudienceExplicit: post.publicAudienceExplicit ?? false }),
      };
      if (updatePostDto.content) {
        sanitizedDto.content = this.sanitizeContent(updatePostDto.content);
      }
      await postRepo.update(id, sanitizedDto);

      const updated = await postRepo.findOne({ where: { id } });
      if (!updated) {
        throw new Error('Post not found after update');
      }
      return updated;
    });
  }

  async remove(
    id: string,
    userId: string,
    profileId?: string
  ): Promise<{ success: boolean }> {
    console.log(`PostService.remove called for ID: ${id}`);
    return this.postRepo.manager.transaction(async (manager) => {
      const postRepo = manager.getRepository(Post);
      const commentRepo = manager.getRepository(Comment);
      const attachmentRepo = manager.getRepository(Attachment);
      // Get the post to check if it's a community post
      const post = await postRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post) {
        throw new Error('Post not found');
      }

      // Personal posts require both persisted owner identifiers to match the
      // authenticated account context. Community policy remains unchanged.
      if (
        !post.communityId &&
        (post.userId !== userId || post.profileId !== profileId)
      ) {
        throw new RpcException({
          statusCode: 403,
          message: 'You do not have permission to delete this post',
        });
      }

      // If it's a community post, check membership or moderator privileges
      if (post.communityId) {
        const hasPermission = await this.communityService.hasPermission(
          post.communityId,
          userId,
          [
            CommunityMemberRole.OWNER,
            CommunityMemberRole.ADMIN,
            CommunityMemberRole.MODERATOR,
          ]
        );
        const isMember = await this.communityService.isMember(
          post.communityId,
          userId
        );

        // Allow if user is a moderator OR if user is the post author (who is also a member)
        if (!hasPermission && (!isMember || post.userId !== userId)) {
          throw new Error('You do not have permission to delete this post');
        }
      }

      await this.latchPostAndCommentAssetReferences(post);

      // Delete related entities first to avoid foreign key constraint errors
      try {
        // Remove comments associated with this post
        await commentRepo.delete({ post: { id } });

        // Remove attachments associated with this post
        await attachmentRepo.delete({ post: { id } });

        // Finally, remove the post itself
        await postRepo.delete(id);

        console.log(`PostService.remove completed for ID: ${id}`);
        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error in PostService.remove for ID ${id}: ${message}`);
        throw error;
      }
    });
  }

  async getPosts(searchDto: SearchPostDto): Promise<Post[]> {
    const { userIds, visibility, ...otherFilters } = searchDto;

    const where: FindOptionsWhere<
      Omit<Post, 'votes' | 'comments' | 'links' | 'attachments'>
    > = { ...otherFilters };

    if (userIds && userIds.length > 0) {
      where.userId = In(userIds);
    }

    if (visibility) {
      where.visibility = visibility;
    }

    where.moderationStatus = 'visible';

    return await this.postRepo.find({ where });
  }

  async moderate(
    id: string,
    moderationStatus: 'visible' | 'hidden',
    moderatedBy: string,
    moderationNotes?: string
  ): Promise<Post> {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) {
      throw new Error('Post not found');
    }

    await this.postRepo.update(id, {
      moderationStatus,
      moderationNotes: moderationNotes ?? null,
      moderatedBy,
      moderatedAt: new Date(),
    });

    return await this.postRepo.findOne({ where: { id } });
  }

  async createScheduledPost(data: {
    title: string;
    content?: string;
    profileId: string;
    userId: string;
    scheduledAt: Date;
    visibility?: 'public' | 'followers';
    communityId?: string;
    attachmentIds?: string[];
  }): Promise<Post> {
    const post = this.postRepo.create({
      title: data.title,
      content: data.content || '',
      profileId: data.profileId,
      userId: data.userId,
      scheduledAt: data.scheduledAt,
      isScheduled: true,
      visibility: data.visibility || 'public',
      communityId: data.communityId || null,
    });

    if (data.attachmentIds && data.attachmentIds.length > 0) {
      const attachments = await this.attachmentRepo.findBy({
        id: In(data.attachmentIds),
      });
      post.attachments = attachments;
    }

    await this.latchPrivateAssetReferences(post);
    return await this.postRepo.save(post);
  }

  async findScheduledPosts(profileId?: string): Promise<Post[]> {
    const where: FindOptionsWhere<Post> = { isScheduled: true };
    if (profileId) {
      where.profileId = profileId;
    }
    return await this.postRepo.find({
      where,
      order: { scheduledAt: 'ASC' },
    });
  }

  async findPendingScheduledPosts(): Promise<Post[]> {
    return await this.postRepo.find({
      where: {
        isScheduled: true,
        scheduledAt: MoreThanOrEqual(new Date()),
      },
      order: { scheduledAt: 'ASC' },
    });
  }

  async publishScheduledPost(id: string): Promise<Post> {
    return this.postRepo.manager.transaction(async (manager) => {
      const postRepo = manager.getRepository(Post);
      const post = await postRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post || !post.isScheduled) {
        throw new Error('Scheduled post not found');
      }

      await this.latchPostAndCommentAssetReferences(post);
      await postRepo.update(id, {
        isScheduled: false,
        scheduledAt: null,
      });

      return await postRepo.findOne({ where: { id } });
    });
  }

  async updateScheduledPost(
    id: string,
    data: {
      title?: string;
      content?: string;
      scheduledAt?: Date;
      visibility?: 'public' | 'followers';
      communityId?: string;
    }
  ): Promise<Post> {
    return this.postRepo.manager.transaction(async (manager) => {
      const postRepo = manager.getRepository(Post);
      const post = await postRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post || !post.isScheduled) {
        throw new Error('Scheduled post not found');
      }

      const updatedAudiencePost = { ...post, ...data } as Post;
      await this.latchPostAndCommentAssetReferences(post);
      if (
        updatedAudiencePost.visibility !== 'public' ||
        updatedAudiencePost.content !== post.content
      ) {
        await this.latchPostAndCommentAssetReferences(updatedAudiencePost);
      }

      await postRepo.update(id, data);
      return await postRepo.findOne({ where: { id } });
    });
  }

  async deleteScheduledPost(id: string): Promise<void> {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post || !post.isScheduled) {
      throw new Error('Scheduled post not found');
    }
    await this.postRepo.delete(id);
  }

  private withDefaultModerationFilter<
    T extends FindManyOptions<Post> | FindOneOptions<Post> | undefined
  >(options?: T): T {
    const normalized = { ...(options ?? {}) } as T;
    const where = (normalized as FindManyOptions<Post> | FindOneOptions<Post>)
      .where;

    if (!where) {
      (normalized as FindManyOptions<Post> | FindOneOptions<Post>).where = {
        moderationStatus: 'visible',
      };
      return normalized;
    }

    if (Array.isArray(where)) {
      (normalized as FindManyOptions<Post> | FindOneOptions<Post>).where =
        where.map((entry) =>
          entry.moderationStatus === undefined
            ? { ...entry, moderationStatus: 'visible' }
            : entry
        );
      return normalized;
    }

    if ((where as any).moderationStatus === undefined) {
      (normalized as FindManyOptions<Post> | FindOneOptions<Post>).where = {
        ...where,
        moderationStatus: 'visible',
      };
    }

    return normalized;
  }
}
