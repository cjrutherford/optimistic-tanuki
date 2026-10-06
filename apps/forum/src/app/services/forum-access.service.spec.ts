import { ForumAccessService } from './forum-access.service';

describe('Forum audience and parent policy', () => {
  const scope = 'client-interface';
  const actor = {
    appScope: scope,
    requestingProfileId: 'author',
    profileId: 'author',
    userId: 'author-user',
  };
  let topic: any;
  let thread: any;
  let post: any;
  let service: ForumAccessService;
  beforeEach(() => {
    topic = {
      id: 'topic',
      appScope: scope,
      visibility: 'private',
      profileId: 'author',
      userId: 'author-user',
    };
    thread = {
      id: 'thread',
      topicId: 'topic',
      appScope: scope,
      visibility: 'public',
      profileId: 'author',
      userId: 'author-user',
      moderationStatus: 'visible',
    };
    post = {
      id: 'post',
      threadId: 'thread',
      appScope: scope,
      profileId: 'author',
      userId: 'author-user',
      moderationStatus: 'visible',
    };
    const repo = (record: () => any) => ({
      findOne: jest.fn(async () => record()),
      find: jest.fn(async () => [record()]),
    });
    service = new ForumAccessService(
      repo(() => topic) as any,
      repo(() => thread) as any,
      repo(() => post) as any
    );
  });
  it.each(['topic', 'thread', 'post'] as const)(
    'restricts %s through a private ancestor for anonymous and unrelated profiles',
    async (kind) => {
      await expect(
        service.read(kind, kind, { appScope: scope })
      ).rejects.toMatchObject({ error: { statusCode: 404 } });
      await expect(
        service.read(kind, kind, {
          appScope: scope,
          requestingProfileId: 'outsider',
        })
      ).rejects.toMatchObject({ error: { statusCode: 404 } });
      await expect(service.read(kind, kind, actor)).resolves.toHaveProperty(
        'id',
        kind
      );
    }
  );
  it.each(['topic', 'thread', 'post'] as const)(
    'applies the same audience to %s lists',
    async (kind) => {
      await expect(
        service.list(kind, { where: { appScope: scope } })
      ).resolves.toEqual([]);
      await expect(
        service.list(kind, {
          where: { appScope: scope },
          requestingProfileId: 'author',
        })
      ).resolves.toHaveLength(1);
    }
  );
  it.each(['topic', 'thread', 'post'] as const)(
    'refuses %s from a sibling scope even for its author',
    async (kind) => {
      await expect(
        service.read(kind, kind, { ...actor, appScope: 'forgeofwill' })
      ).rejects.toMatchObject({ error: { statusCode: 404 } });
    }
  );
  it('allows anonymous public discussion and refuses ownership changes by another profile', async () => {
    topic.visibility = 'public';
    await expect(
      service.read('post', 'post', { appScope: scope })
    ).resolves.toHaveProperty('id', 'post');
    await expect(
      service.owner('thread', 'thread', { ...actor, profileId: 'outsider' })
    ).rejects.toMatchObject({ error: { statusCode: 403 } });
    await expect(
      service.owner('thread', 'thread', actor)
    ).resolves.toBeUndefined();
  });
  it('prevents writes under a locked or inaccessible parent', async () => {
    topic.isLocked = true;
    await expect(service.parent('topic', 'topic', actor)).rejects.toMatchObject(
      { error: { statusCode: 403 } }
    );
    await expect(
      service.parent('topic', 'topic', { ...actor, appScope: 'forgeofwill' })
    ).rejects.toMatchObject({ error: { statusCode: 404 } });
  });
  it('excludes hidden ancestors and orphaned replies', async () => {
    topic.visibility = 'public';
    thread.moderationStatus = 'hidden';
    await expect(service.read('post', 'post', actor)).rejects.toMatchObject({
      error: { statusCode: 404 },
    });
    thread = null;
    await expect(service.read('post', 'post', actor)).rejects.toMatchObject({
      error: { statusCode: 404 },
    });
  });
});
