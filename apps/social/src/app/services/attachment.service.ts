import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Attachment,
  AttachmentType,
} from '../../entities/attachment.entity';
import {
  DataSource,
  FindOneOptions,
  FindManyOptions,
  Repository,
} from 'typeorm';
import {
  CreateAttachmentDto,
  UpdateAttachmentDto,
} from '@optimistic-tanuki/models';
import { Post } from '../../entities/post.entity';
import {
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { PostService } from './post.service';

export type AttachmentActor = {
  userId: string;
  profileId: string;
  appId: string;
};

type ProfileRecord = { id: string; userId: string; appScope?: string | null };

const LEGACY_SCOPE = 'social';

@Injectable()
export class AttachmentService {
  constructor(
    @Inject(getRepositoryToken(Attachment))
    private readonly attachmentRepo: Repository<Attachment>,
    @Inject('SOCIAL_CONNECTION')
    private readonly dataSource: DataSource,
    private readonly postService: PostService,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy
  ) {}

  async create(
    createAttachmentDto: Omit<CreateAttachmentDto, 'postId'>,
    postId: string,
    actor: AttachmentActor
  ): Promise<Attachment> {
    this.validateActor(actor);
    const profile = await this.resolveActorProfile(actor);

    return this.dataSource.transaction(async (manager) => {
      const post = await this.lockPost(manager, postId);
      this.assertOwner(post, profile, actor.appId);
      await this.latchReferences(
        post,
        [{ filePath: createAttachmentDto.url }]
      );

      const repo = manager.getRepository(Attachment);
      const attachment = repo.create({
        name: createAttachmentDto.name || 'Attachment',
        post,
        filePath: createAttachmentDto.url,
        type: (createAttachmentDto.type || AttachmentType.IMAGE) as AttachmentType,
        appScope: actor.appId,
      });
      return repo.save(attachment);
    });
  }

  async findAll(options?: FindManyOptions<Attachment>): Promise<Attachment[]> {
    return this.attachmentRepo.find(options);
  }

  async findAllForApp(
    options: FindManyOptions<Attachment>,
    appId: string
  ): Promise<Attachment[]> {
    if (!appId?.trim()) return [];
    const attachments = await this.attachmentRepo.find({
      ...options,
      relations: [...new Set([...(options.relations as string[] ?? []), 'post'])],
    });
    const visible: Attachment[] = [];
    for (const attachment of attachments) {
      if (await this.isInAppScope(attachment, appId)) visible.push(attachment);
    }
    return visible;
  }

  async findOne(
    id: string,
    options?: FindOneOptions<Attachment>
  ): Promise<Attachment | null> {
    const where = options?.where;
    return this.attachmentRepo.findOne({
      ...options,
      where: Array.isArray(where)
        ? where.map((branch) => ({ ...branch, id }))
        : { ...(where ?? {}), id },
    });
  }

  async findOneForApp(
    id: string,
    appId: string,
    options?: FindOneOptions<Attachment>
  ): Promise<Attachment | null> {
    if (!appId?.trim()) return null;
    const attachment = await this.findOne(id, {
      ...options,
      relations: [...new Set([...(options?.relations as string[] ?? []), 'post'])],
    });
    return attachment && (await this.isInAppScope(attachment, appId))
      ? attachment
      : null;
  }

  async update(
    id: string,
    updateAttachmentDto: UpdateAttachmentDto,
    actor: AttachmentActor
  ): Promise<Attachment> {
    this.validateActor(actor);
    const profile = await this.resolveActorProfile(actor);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Attachment);
      const attachment = await repo.findOne({
        where: { id },
        relations: ['post'],
      });
      if (!attachment?.post) throw new RpcException({
        statusCode: 404,
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found',
      });
      const post = await this.lockPost(manager, attachment.post.id);
      this.assertAttachmentOwner(attachment, post, profile, actor.appId);
      await this.latchReferences(post, [
        { filePath: attachment.filePath },
        { filePath: updateAttachmentDto.url ?? attachment.filePath },
      ]);

      if (updateAttachmentDto.url !== undefined)
        attachment.filePath = updateAttachmentDto.url;
      if (updateAttachmentDto.name !== undefined)
        attachment.name = updateAttachmentDto.name;
      if (updateAttachmentDto.type !== undefined)
        attachment.type = updateAttachmentDto.type as AttachmentType;
      attachment.appScope = actor.appId;
      return repo.save(attachment);
    });
  }

  async remove(id: string, actor: AttachmentActor): Promise<void> {
    this.validateActor(actor);
    const profile = await this.resolveActorProfile(actor);
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Attachment);
      const attachment = await repo.findOne({
        where: { id },
        relations: ['post'],
      });
      if (!attachment?.post) throw new RpcException({
        statusCode: 404,
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found',
      });
      const post = await this.lockPost(manager, attachment.post.id);
      this.assertAttachmentOwner(attachment, post, profile, actor.appId);
      await this.latchReferences(post, [{ filePath: attachment.filePath }]);
      await repo.remove(attachment);
    });
  }

  private async lockPost(manager: any, postId: string): Promise<Post> {
    if (typeof postId !== 'string' || !postId.trim())
      throw new RpcException({ statusCode: 400, message: 'A post ID is required' });
    const post = await manager.getRepository(Post).findOne({
      where: { id: postId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!post) throw new RpcException({ statusCode: 404, message: 'Post not found' });
    return post;
  }

  private validateActor(actor: AttachmentActor): void {
    if (
      !actor?.userId ||
      !actor.profileId ||
      !actor.appId?.trim()
    ) {
      throw new RpcException({ statusCode: 403, code: 'ATTACHMENT_ACCESS_DENIED', message: 'A verified Social application actor is required' });
    }
  }

  private async resolveActorProfile(actor: AttachmentActor): Promise<ProfileRecord> {
    let profile: ProfileRecord;
    try {
      profile = (await firstValueFrom(
        this.profileClient
          .send({ cmd: ProfileCommands.Get }, { id: actor.profileId })
          .pipe(timeout(3000))
      )) as ProfileRecord;
    } catch {
      throw new RpcException({ statusCode: 503, code: 'ATTACHMENT_PROFILE_UNAVAILABLE', message: 'Unable to verify the attachment owner profile' });
    }
    if (
      !profile ||
      profile.id !== actor.profileId ||
      profile.userId !== actor.userId ||
      profile.appScope !== actor.appId
    ) {
      throw new RpcException({ statusCode: 403, code: 'ATTACHMENT_ACCESS_DENIED', message: 'Attachment owner profile does not match the verified actor and application' });
    }
    return profile;
  }

  private assertOwner(
    post: Post,
    profile: ProfileRecord,
    appId: string
  ): void {
    if (
      post.profileId !== profile.id ||
      post.userId !== profile.userId ||
      ![LEGACY_SCOPE, appId].includes(post.appScope ?? '')
    ) {
      throw new RpcException({ statusCode: 403, code: 'ATTACHMENT_ACCESS_DENIED', message: 'Attachment parent is outside the verified owner or application scope' });
    }
  }

  private assertAttachmentOwner(
    attachment: Attachment,
    post: Post,
    profile: ProfileRecord,
    appId: string
  ): void {
    this.assertOwner(post, profile, appId);
    if (
      attachment.post?.id !== post.id ||
      ![LEGACY_SCOPE, appId].includes(attachment.appScope ?? '')
    ) {
      throw new RpcException({ statusCode: 403, code: 'ATTACHMENT_ACCESS_DENIED', message: 'Attachment is outside the verified owner or application scope' });
    }
  }

  private async isInAppScope(
    attachment: Attachment,
    appId: string
  ): Promise<boolean> {
    const post = attachment.post;
    if (
      !post ||
      ![LEGACY_SCOPE, appId].includes(post.appScope ?? '') ||
      ![LEGACY_SCOPE, appId].includes(attachment.appScope ?? '')
    ) return false;
    let profile: ProfileRecord;
    try {
      profile = (await firstValueFrom(
        this.profileClient
          .send({ cmd: ProfileCommands.Get }, { id: post.profileId })
          .pipe(timeout(3000))
      )) as ProfileRecord;
    } catch {
      throw new RpcException({ statusCode: 503, code: 'ATTACHMENT_PROFILE_UNAVAILABLE', message: 'Unable to verify attachment read scope' });
    }
    return !!profile && profile.id === post.profileId &&
      profile.userId === post.userId && profile.appScope === appId;
  }

  private async latchReferences(
    post: Post,
    attachments: Array<{ filePath?: string }>
  ): Promise<void> {
    try {
      await this.postService.latchPrivateAssetReferences({
        ...post,
        attachments,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/audience|restricted|another profile/i.test(message)) {
        throw new RpcException({ statusCode: 400, code: 'ATTACHMENT_AUDIENCE_DENIED', message: 'Attachment media is incompatible with the post audience' });
      }
      throw new RpcException({ statusCode: 503, code: 'ATTACHMENT_ASSET_UNAVAILABLE', message: 'Unable to verify attachment media audience' });
    }
  }
}
