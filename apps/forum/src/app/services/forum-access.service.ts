import { Inject, Injectable, Optional } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Topic, Thread, ForumPost } from '../../entities';
import { AssetCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';

export type ForumKind = 'topic' | 'thread' | 'post';
export type ForumActor = {
  appScope?: string;
  requestingProfileId?: string;
  userId?: string;
  profileId?: string;
};

/** Public RPC policy. Replies inherit both thread and topic restrictions. */
@Injectable()
export class ForumAccessService {
  constructor(
    @Inject(getRepositoryToken(Topic))
    private readonly topics: Repository<Topic>,
    @Inject(getRepositoryToken(Thread))
    private readonly threads: Repository<Thread>,
    @Inject(getRepositoryToken(ForumPost))
    private readonly posts: Repository<ForumPost>,
    @Optional()
    @Inject(ServiceTokens.ASSETS_SERVICE)
    private readonly assets?: ClientProxy
  ) {}

  async resolveTopicAudienceOwner(
    visibility: string | undefined,
    profileId: string | undefined
  ): Promise<string | undefined> {
    return visibility === 'private' ? profileId : undefined;
  }

  async resolveThreadAudienceOwner(
    topicId: string,
    visibility: string | undefined,
    profileId: string | undefined
  ): Promise<string | undefined> {
    if (visibility === 'private') return profileId;
    const topic = await this.topics.findOne({ where: { id: topicId } });
    return topic?.visibility === 'private' ? topic.profileId : undefined;
  }

  async resolvePostAudienceOwner(
    threadId: string
  ): Promise<string | undefined> {
    const thread = await this.threads.findOne({ where: { id: threadId } });
    if (!thread) return undefined;
    return this.resolveThreadAudienceOwner(
      thread.topicId,
      thread.visibility,
      thread.profileId
    );
  }

  /** Persist private forum policy before a content write removes the reference. */
  async latchAssetReferences(
    content: string | undefined,
    audienceOwnerProfileId: string | undefined
  ): Promise<void> {
    const ids = [
      ...new Set(
        (content ?? '')
          .match(
            /(?:\/api)?\/asset\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?=$|[^0-9a-f-])/gi
          )
          ?.map((match) => match.split('/').pop()!) ?? []
      ),
    ];
    if (!ids.length) return;
    if (!this.assets) throw new Error('Asset audience service unavailable');
    for (const id of ids) {
      const asset = await firstValueFrom(
        this.assets
          .send({ cmd: AssetCommands.RETRIEVE }, { id })
          .pipe(timeout({ first: 5000 }))
      );
      const restrictions = Array.isArray(asset.audienceRestrictions)
        ? asset.audienceRestrictions
        : [];
      const communityIds = Array.isArray(asset.audienceCommunityIds)
        ? asset.audienceCommunityIds
        : [];
      const isRestricted = restrictions.length > 0 || communityIds.length > 0;
      const compatibleOwnerAsset =
        !!audienceOwnerProfileId &&
        restrictions.every(
          (restriction) =>
            restriction.type === 'owner' &&
            restriction.profileId === audienceOwnerProfileId
        ) &&
        communityIds.length === 0;
      if (isRestricted && !compatibleOwnerAsset) {
        throw new Error('Asset audience is narrower than this forum audience');
      }
      if (
        audienceOwnerProfileId &&
        asset.profileId === audienceOwnerProfileId
      ) {
        await firstValueFrom(
          this.assets
            .send(
              { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
              {
                id,
                restrictions: [
                  { type: 'owner', profileId: audienceOwnerProfileId },
                ],
              }
            )
            .pipe(timeout({ first: 5000 }))
        );
      }
    }
  }

  private repo(kind: ForumKind): Repository<any> {
    return kind === 'topic'
      ? this.topics
      : kind === 'thread'
      ? this.threads
      : this.posts;
  }

  private denied(): never {
    throw new RpcException({
      statusCode: 404,
      message: 'Discussion not found',
    });
  }

  private async allowed(
    kind: ForumKind,
    record: any,
    actor: ForumActor
  ): Promise<boolean> {
    if (
      !record ||
      !actor.appScope ||
      record.appScope !== actor.appScope ||
      record.moderationStatus === 'hidden'
    )
      return false;
    if (
      record.visibility === 'private' &&
      record.profileId !== actor.requestingProfileId
    )
      return false;
    if (kind === 'thread')
      return this.allowed(
        'topic',
        await this.topics.findOne({ where: { id: record.topicId } }),
        actor
      );
    if (kind === 'post')
      return this.allowed(
        'thread',
        await this.threads.findOne({ where: { id: record.threadId } }),
        actor
      );
    return true;
  }

  async read(
    kind: ForumKind,
    id: string,
    actor: ForumActor,
    countView = false
  ): Promise<any> {
    const record = await this.repo(kind).findOne({ where: { id } });
    if (!(await this.allowed(kind, record, actor))) this.denied();
    if (kind === 'thread' && countView) {
      await this.threads.increment({ id: record.id }, 'viewCount', 1);
      record.viewCount += 1;
    }
    return record;
  }

  async list(kind: ForumKind, options: any = {}): Promise<any[]> {
    const actor = {
      ...options,
      appScope: options.appScope ?? options.where?.appScope,
    };
    if (!actor.appScope) this.denied();
    const records = await this.repo(kind).find({
      where: { ...(options.where ?? {}), appScope: actor.appScope },
      order: { createdAt: 'ASC' },
    });
    const visible = await Promise.all(
      records.map(async (record) =>
        (await this.allowed(kind, record, actor)) ? record : null
      )
    );
    return visible.filter(Boolean);
  }

  async parent(
    kind: 'topic' | 'thread',
    id: string,
    actor: ForumActor
  ): Promise<void> {
    const parent = await this.read(kind, id, {
      ...actor,
      requestingProfileId: actor.profileId,
    });
    if (parent.isLocked)
      throw new RpcException({
        statusCode: 403,
        message: 'Discussion is locked',
      });
  }

  async findAssetAudienceReferences(assetId: string): Promise<{
    restrictions: Array<{ type: 'owner'; profileId: string }>;
  }> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        assetId
      )
    ) {
      throw new Error('Invalid asset id');
    }
    const reference = `%/asset/${assetId}%`;
    const [topics, threads, posts] = await Promise.all([
      this.topics.find({
        where: [{ title: Like(reference) }, { description: Like(reference) }],
      }),
      this.threads.find({
        where: [
          { title: Like(reference) },
          { description: Like(reference) },
          { content: Like(reference) },
        ],
      }),
      this.posts.find({ where: { content: Like(reference) } }),
    ]);
    const exactReference = new RegExp(`/asset/${assetId}(?=$|[^A-Za-z0-9-])`);
    const restrictions = new Map<
      string,
      { type: 'owner'; profileId: string }
    >();
    const addOwner = (record: { visibility?: string; profileId?: string }) => {
      if (record.visibility !== 'private' || !record.profileId) return;
      restrictions.set(record.profileId, {
        type: 'owner',
        profileId: record.profileId,
      });
    };

    for (const topic of topics) {
      if (
        exactReference.test(topic.title ?? '') ||
        exactReference.test(topic.description ?? '')
      ) {
        addOwner(topic);
      }
    }
    for (const thread of threads) {
      if (
        ![thread.title, thread.description, thread.content].some((value) =>
          exactReference.test(value ?? '')
        )
      ) {
        continue;
      }
      addOwner(thread);
      const parent = await this.topics.findOne({
        where: { id: thread.topicId },
      });
      addOwner(parent ?? {});
    }
    for (const post of posts) {
      if (!exactReference.test(post.content ?? '')) continue;
      const thread = await this.threads.findOne({
        where: { id: post.threadId },
      });
      if (!thread) continue;
      addOwner(thread);
      const parent = await this.topics.findOne({
        where: { id: thread.topicId },
      });
      addOwner(parent ?? {});
    }

    return { restrictions: [...restrictions.values()] };
  }

  async owner(kind: ForumKind, id: string, actor: ForumActor): Promise<void> {
    const record = await this.read(kind, id, {
      ...actor,
      requestingProfileId: actor.profileId,
    });
    if (
      !actor.profileId ||
      record.profileId !== actor.profileId ||
      record.userId !== actor.userId
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'Only the author may change this discussion',
      });
    }
  }
}
