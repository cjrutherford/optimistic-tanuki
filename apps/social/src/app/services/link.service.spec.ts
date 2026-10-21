import { LinkService } from './link.service';

describe('LinkService', () => {
  it('rejects missing actors before touching persistence', async () => {
    const service = new LinkService({} as any);
    await expect(
      service.create(
        { url: 'https://example.test', postId: 'a' } as any,
        null as any
      )
    ).rejects.toBeDefined();
  });

  it('rejects malformed post IDs before opening a transaction', async () => {
    const manager = { transaction: jest.fn() };
    const service = new LinkService({ manager } as any);
    const actor = {
      accountId: '7e3d7f26-7d7e-4dcb-9d95-2f1f964e5423',
      profileId: '8e3d7f26-7d7e-4dcb-9d95-2f1f964e5423',
    };
    for (const postId of [undefined, 'not-a-uuid']) {
      await expect(
        service.create({ url: 'https://example.test', postId } as any, actor)
      ).rejects.toBeDefined();
    }
    expect(manager.transaction).not.toHaveBeenCalled();
  });

  it('saves and associates a link only after finding the actor-owned post', async () => {
    const post = {
      id: '7e3d7f26-7d7e-4dcb-9d95-2f1f964e5424',
      appScope: 'social',
    };
    const actor = {
      accountId: '7e3d7f26-7d7e-4dcb-9d95-2f1f964e5423',
      profileId: '8e3d7f26-7d7e-4dcb-9d95-2f1f964e5423',
    };
    const relation = {
      of: jest.fn().mockReturnThis(),
      add: jest.fn().mockResolvedValue(undefined),
    };
    const posts = {
      findOne: jest.fn().mockResolvedValue(post),
      createQueryBuilder: jest.fn(() => ({
        relation: jest.fn(() => relation),
      })),
    };
    const link = { id: 12, url: 'https://example.test/', appScope: 'social' };
    const links = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(link),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity.name === 'Post' ? posts : links
      ),
    };
    const repo = {
      manager: { transaction: jest.fn(async (work) => work(manager)) },
    };
    const service = new LinkService(repo as any);

    await expect(
      service.create(
        { url: 'https://example.test', postId: post.id } as any,
        actor
      )
    ).resolves.toBe(link);
    expect(posts.findOne).toHaveBeenCalledWith({
      where: {
        id: post.id,
        userId: actor.accountId,
        profileId: actor.profileId,
      },
      relations: { links: true },
    });
    expect(links.save).toHaveBeenCalledWith({
      url: 'https://example.test/',
      appScope: 'social',
    });
    expect(relation.of).toHaveBeenCalledWith(post);
    expect(relation.add).toHaveBeenCalledWith(link);
  });

  it('denies a foreign post before saving or associating a link', async () => {
    const actor = {
      accountId: '7e3d7f26-7d7e-4dcb-9d95-2f1f964e5423',
      profileId: '8e3d7f26-7d7e-4dcb-9d95-2f1f964e5423',
    };
    const posts = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(),
    };
    const links = { create: jest.fn(), save: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity.name === 'Post' ? posts : links
      ),
    };
    const repo = {
      manager: { transaction: jest.fn(async (work) => work(manager)) },
    };
    const service = new LinkService(repo as any);

    await expect(
      service.create(
        {
          url: 'https://example.test',
          postId: '7e3d7f26-7d7e-4dcb-9d95-2f1f964e5424',
        } as any,
        actor
      )
    ).rejects.toBeDefined();
    expect(links.save).not.toHaveBeenCalled();
    expect(posts.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects non web URLs and credential URLs before a transaction', async () => {
    const manager = { transaction: jest.fn() };
    const service = new LinkService({ manager } as any);
    const actor = {
      accountId: '7e3d7f26-7d7e-4dcb-9d95-2f1f964e5423',
      profileId: '8e3d7f26-7d7e-4dcb-9d95-2f1f964e5423',
    };
    await expect(
      service.create(
        { url: 'file:///tmp/x', postId: actor.profileId } as any,
        actor
      )
    ).rejects.toBeDefined();
    await expect(
      service.create(
        {
          url: 'https://user:pass@example.test',
          postId: actor.profileId,
        } as any,
        actor
      )
    ).rejects.toBeDefined();
    expect(manager.transaction).not.toHaveBeenCalled();
  });

  it('rejects updates because shared link URLs are immutable', async () => {
    const service = new LinkService({} as any);
    await expect(
      service.update(1, { url: 'https://example.test' } as any)
    ).rejects.toBeDefined();
  });

  it('rejects global removal because links may be shared', async () => {
    const service = new LinkService({} as any);
    await expect(service.remove(1)).rejects.toBeDefined();
  });
});
