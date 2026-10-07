import { Inject, Injectable, Optional } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
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

  private async latchPrivateAssetReferences(post: {
    content?: string;
    profileId?: string;
    visibility?: string;
    communityId?: string;
  }): Promise<void> {
    // Older clients emitted /asset/:id while current clients use /api/asset/:id.
    // Both forms must latch before a content mutation can remove the first read path.
    const ids = [
      ...new Set(
        (post.content ?? '')
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
    const isPrivate = post.visibility === 'followers' || !!community?.isPrivate;
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
      const compatibleRestrictions = storedRestrictions.every(
        (restriction) =>
          restriction.type === 'followers' &&
          post.visibility === 'followers' &&
          restriction.profileId === post.profileId
      );
      const compatibleCommunities = storedCommunities.every(
        (communityId) => !!community?.isPrivate && communityId === community.id
      );
      if (!compatibleRestrictions || !compatibleCommunities) {
        throw new Error('Asset audience is narrower than this post audience');
      }
      if (asset.profileId !== post.profileId) continue;
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

    await this.latchPrivateAssetReferences(createPostDto);

    // Sanitize content before saving
    const sanitizedDto = {
      ...createPostDto,
      content: this.sanitizeContent(createPostDto.content || ''),
    };
    const post = this.postRepo.create(sanitizedDto);

    if (createPostDto.attachmentIds && createPostDto.attachmentIds.length > 0) {
      const attachments = await this.attachmentRepo.findBy({
        id: In(createPostDto.attachmentIds),
      });
      post.attachments = attachments;
    }

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
    restrictions: Array<{ type: 'owner' | 'followers'; profileId: string }>;
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
      { type: 'owner' | 'followers'; profileId: string }
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
      if (post.communityId) {
        const community = await this.communityService.findOne(post.communityId);
        if (community?.isPrivate) communityIds.add(post.communityId);
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
    // Get the post to check if it's a community post
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) {
      throw new Error('Post not found');
    }

    if (!post.communityId && post.profileId !== profileId) {
      throw new Error('You do not have permission to update this post');
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
        throw new Error('You do not have permission to update this post');
      }
    }

    // Sanitize content if provided
    await this.latchPrivateAssetReferences(post);
    await this.latchPrivateAssetReferences({
      ...post,
      ...updatePostDto,
      content: updatePostDto.content ?? post.content,
      profileId: post.profileId,
    });
    const sanitizedDto = {
      ...updatePostDto,
    };
    if (updatePostDto.content) {
      sanitizedDto.content = this.sanitizeContent(updatePostDto.content);
    }
    await this.postRepo.update(id, sanitizedDto);

    const updated = await this.postRepo.findOne({ where: { id } });
    if (!updated) {
      throw new Error('Post not found after update');
    }
    return updated;
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    console.log(`PostService.remove called for ID: ${id}`);

    // Get the post to check if it's a community post
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) {
      throw new Error('Post not found');
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

    await this.latchPrivateAssetReferences(post);

    // Delete related entities first to avoid foreign key constraint errors
    try {
      // Remove comments associated with this post
      await this.commentRepo.delete({ post: { id } });

      // Remove attachments associated with this post
      await this.attachmentRepo.delete({ post: { id } });

      // Finally, remove the post itself
      await this.postRepo.delete(id);

      console.log(`PostService.remove completed for ID: ${id}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error in PostService.remove for ID ${id}: ${message}`);
      throw error;
    }
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
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post || !post.isScheduled) {
      throw new Error('Scheduled post not found');
    }

    await this.postRepo.update(id, {
      isScheduled: false,
      scheduledAt: null,
    });

    return await this.postRepo.findOne({ where: { id } });
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
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post || !post.isScheduled) {
      throw new Error('Scheduled post not found');
    }

    await this.postRepo.update(id, data);
    return await this.postRepo.findOne({ where: { id } });
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
