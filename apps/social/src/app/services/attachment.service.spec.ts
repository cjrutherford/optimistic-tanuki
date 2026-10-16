import { Attachment, AttachmentType } from '../../entities/attachment.entity';
import { Post } from '../../entities/post.entity';
import { AttachmentService } from './attachment.service';
import { of, throwError } from 'rxjs';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { PostService } from './post.service';

describe('AttachmentService', () => {
  const actor = {
    userId: 'owner-user',
    profileId: 'owner-profile',
    appId: 'client-interface',
  };
  const profile = {
    id: actor.profileId,
    userId: actor.userId,
    appScope: actor.appId,
  };
  const post = {
    id: 'post-1',
    userId: actor.userId,
    profileId: actor.profileId,
    appScope: 'social',
    content: '',
    visibility: 'followers',
  } as Post;

  function setup(options?: {
    resolvedProfile?: Record<string, string>;
    latch?: () => Promise<void>;
    attachment?: Partial<Attachment>;
  }) {
    const row = {
      id: 'attachment-1',
      name: 'media.png',
      filePath: '/api/asset/123e4567-e89b-42d3-a456-426614174001',
      type: AttachmentType.IMAGE,
      appScope: actor.appId,
      post,
      ...options?.attachment,
    } as Attachment;
    const postRepo = { findOne: jest.fn().mockResolvedValue(post) };
    const attachmentRepo = {
      create: jest.fn((input) => ({ ...row, ...input })),
      save: jest.fn().mockImplementation(async (value) => value),
      remove: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([row]),
      findOne: jest.fn().mockResolvedValue(row),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === Post ? postRepo : attachmentRepo
      ),
    };
    const dataSource = {
      transaction: jest.fn((operation) => operation(manager)),
    };
    const postService = {
      latchPrivateAssetReferences: jest
        .fn()
        .mockImplementation(options?.latch ?? (() => Promise.resolve())),
    };
    const profileClient = {
      send: jest.fn().mockReturnValue(
        options?.resolvedProfile
          ? of(options.resolvedProfile)
          : of(profile)
      ),
    };
    const service = new AttachmentService(
      attachmentRepo as any,
      dataSource as any,
      postService as any,
      profileClient as any
    );
    return {
      service,
      row,
      postRepo,
      attachmentRepo,
      dataSource,
      postService,
      profileClient,
    };
  }

  it('resolves the transaction DataSource from the registered Social connection token', async () => {
    const module = await Test.createTestingModule({
      providers: [
        AttachmentService,
        { provide: getRepositoryToken(Attachment), useValue: {} },
        { provide: 'SOCIAL_CONNECTION', useValue: {} },
        { provide: PostService, useValue: {} },
        { provide: ServiceTokens.PROFILE_SERVICE, useValue: {} },
      ],
    }).compile();

    expect(module.get(AttachmentService)).toBeInstanceOf(AttachmentService);
    await module.close();
  });

  it('locks and authorizes the owning post before latching and creating', async () => {
    const h = setup();
    const url = '/api/asset/123e4567-e89b-42d3-a456-426614174002';

    await h.service.create(
      {
        name: 'media.png',
        url,
        type: AttachmentType.IMAGE,
        size: 100,
        postId: post.id,
      },
      post.id,
      actor
    );

    expect(h.profileClient.send).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'Get:Profile' }),
      { id: actor.profileId }
    );
    expect(h.postRepo.findOne).toHaveBeenCalledWith({
      where: { id: post.id },
      lock: { mode: 'pessimistic_write' },
    });
    expect(h.postService.latchPrivateAssetReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        id: post.id,
        attachments: [{ filePath: url }],
      })
    );
    expect(h.attachmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ post, appScope: actor.appId, filePath: url })
    );
  });

  it('rejects missing actor context before consulting profile or Social storage', async () => {
    const h = setup();
    await expect(
      h.service.create(
        {
          url: 'https://cdn.example.test/media.png',
          type: AttachmentType.IMAGE,
        },
        post.id,
        undefined as any
      )
    ).rejects.toMatchObject({ error: expect.objectContaining({ statusCode: 403 }) });
    expect(h.profileClient.send).not.toHaveBeenCalled();
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a forged profile owner before latching or writing', async () => {
    const h = setup({
      resolvedProfile: {
        id: actor.profileId,
        userId: 'different-user',
        appScope: actor.appId,
      },
    });

    await expect(
      h.service.create(
        {
          name: 'media.png',
          url: 'https://cdn.example.test/media.png',
          type: AttachmentType.IMAGE,
          size: 100,
          postId: post.id,
        },
        post.id,
        actor
      )
    ).rejects.toMatchObject({ error: expect.objectContaining({ statusCode: 403 }) });
    expect(h.postService.latchPrivateAssetReferences).not.toHaveBeenCalled();
    expect(h.attachmentRepo.save).not.toHaveBeenCalled();
  });

  it('rejects an actor profile from another app before touching Social rows', async () => {
    const h = setup({
      resolvedProfile: {
        id: actor.profileId,
        userId: actor.userId,
        appScope: 'local-hub',
      },
    });
    await expect(
      h.service.create(
        {
          name: 'media.png',
          url: 'https://cdn.example.test/media.png',
          type: AttachmentType.IMAGE,
          size: 100,
        },
        post.id,
        actor
      )
    ).rejects.toMatchObject({ error: expect.objectContaining({ statusCode: 403 }) });
    expect(h.dataSource.transaction).not.toHaveBeenCalled();
    expect(h.postService.latchPrivateAssetReferences).not.toHaveBeenCalled();
  });

  it('rejects a foreign parent app scope without creating an attachment', async () => {
    const h = setup();
    h.postRepo.findOne.mockResolvedValue({
      ...post,
      appScope: 'local-hub',
    });

    await expect(
      h.service.create(
        {
          name: 'media.png',
          url: 'https://cdn.example.test/media.png',
          type: AttachmentType.IMAGE,
          size: 100,
          postId: post.id,
        },
        post.id,
        actor
      )
    ).rejects.toMatchObject({ error: expect.objectContaining({ statusCode: 403 }) });
    expect(h.postService.latchPrivateAssetReferences).not.toHaveBeenCalled();
    expect(h.attachmentRepo.save).not.toHaveBeenCalled();
  });

  it.each(['update', 'delete'] as const)(
    'rejects %s for a post owned by a different user without latching or writing',
    async (operation) => {
      const h = setup();
      const foreignPost = { ...post, userId: 'another-user' } as Post;
      h.postRepo.findOne.mockResolvedValue(foreignPost);
      h.attachmentRepo.findOne.mockResolvedValue({
        ...h.row,
        post: foreignPost,
      });

      const action =
        operation === 'update'
          ? h.service.update('attachment-1', { url: 'https://cdn.example.test/new.png' }, actor)
          : h.service.remove('attachment-1', actor);
      await expect(action).rejects.toMatchObject({
        error: expect.objectContaining({ statusCode: 403 }),
      });
      expect(h.postService.latchPrivateAssetReferences).not.toHaveBeenCalled();
      expect(h.attachmentRepo.save).not.toHaveBeenCalled();
      expect(h.attachmentRepo.remove).not.toHaveBeenCalled();
    }
  );

  it('rejects mutation of a legacy attachment whose parent profile belongs to another app', async () => {
    const h = setup({
      attachment: { appScope: 'social' },
      resolvedProfile: {
        id: actor.profileId,
        userId: actor.userId,
        appScope: 'local-hub',
      },
    });
    await expect(
      h.service.remove('attachment-1', actor)
    ).rejects.toMatchObject({ error: expect.objectContaining({ statusCode: 403 }) });
    expect(h.attachmentRepo.remove).not.toHaveBeenCalled();
  });

  it('does not write when the media audience cannot be verified', async () => {
    const h = setup({ latch: () => Promise.reject(new Error('asset service down')) });

    await expect(
      h.service.create(
        {
          name: 'media.png',
          url: '/api/asset/123e4567-e89b-42d3-a456-426614174001',
          type: AttachmentType.IMAGE,
          size: 100,
          postId: post.id,
        },
        post.id,
        actor
      )
    ).rejects.toMatchObject({ error: expect.objectContaining({ statusCode: 503 }) });
    expect(h.attachmentRepo.save).not.toHaveBeenCalled();
  });

  it('returns a controlled audience denial and makes no write when latching rejects', async () => {
    const h = setup({
      latch: () => Promise.reject(new Error('Asset audience is narrower than post audience')),
    });
    await expect(
      h.service.create(
        {
          url: '/api/asset/123e4567-e89b-42d3-a456-426614174001',
          type: AttachmentType.IMAGE,
        },
        post.id,
        actor
      )
    ).rejects.toMatchObject({ error: expect.objectContaining({ statusCode: 400 }) });
    expect(h.attachmentRepo.save).not.toHaveBeenCalled();
  });

  it('latches both stored and replacement URLs before updating', async () => {
    const h = setup();
    const original = h.row.filePath;
    const replacement = '/api/asset/123e4567-e89b-42d3-a456-426614174002';

    await h.service.update('attachment-1', { url: replacement }, actor);

    expect(h.postRepo.findOne).toHaveBeenCalledWith({
      where: { id: post.id },
      lock: { mode: 'pessimistic_write' },
    });
    expect(h.postService.latchPrivateAssetReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          { filePath: original },
          { filePath: replacement },
        ],
      })
    );
    expect(h.attachmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: replacement })
    );
  });

  it('filters legacy attachment reads through the exact parent profile app scope', async () => {
    const h = setup();

    await expect(h.service.findAllForApp({}, actor.appId)).resolves.toEqual([
      h.row,
    ]);
    expect(h.profileClient.send).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: 'Get:Profile' }),
      { id: post.profileId }
    );
  });

  it('does not return an attachment owned by a profile in another app', async () => {
    const h = setup({
      resolvedProfile: {
        id: post.profileId,
        userId: post.userId,
        appScope: 'local-hub',
      },
    });
    await expect(h.service.findAllForApp({}, actor.appId)).resolves.toEqual([]);
  });

  it('fails closed on a profile service outage for attachment reads', async () => {
    const h = setup();
    h.profileClient.send.mockReturnValue(throwError(() => new Error('offline')));

    await expect(
      h.service.findAllForApp({}, actor.appId)
    ).rejects.toMatchObject({ error: expect.objectContaining({ statusCode: 503 }) });
  });
});
