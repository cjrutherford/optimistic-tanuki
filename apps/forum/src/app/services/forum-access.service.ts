import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Topic, Thread, ForumPost } from '../../entities';

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
    private readonly posts: Repository<ForumPost>
  ) {}

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
