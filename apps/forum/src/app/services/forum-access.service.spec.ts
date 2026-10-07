import { ForumAccessService } from './forum-access.service';
import { of } from 'rxjs';
import { AssetCommands } from '@optimistic-tanuki/constants';

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

  it('derives an owner-only asset restriction from the private parent of a reply', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    const privateTopic = {
      id: 'private-topic',
      profileId: 'topic-owner',
      visibility: 'private',
      title: 'Private images',
      description: 'Private images',
    };
    const publicThread = {
      id: 'public-thread',
      topicId: 'private-topic',
      profileId: 'thread-owner',
      visibility: 'public',
      title: 'Reply area',
      description: 'Reply area',
      content: 'Reply area',
    };
    const privateReply = {
      id: 'private-reply',
      threadId: 'public-thread',
      profileId: 'reply-owner',
      content: `<img src="https://local/api/asset/${assetId}">`,
    };
    const topics = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(privateTopic),
    };
    const threads = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(publicThread),
    };
    const posts = { find: jest.fn().mockResolvedValue([privateReply]) };
    service = new ForumAccessService(
      topics as any,
      threads as any,
      posts as any
    );

    await expect(service.findAssetAudienceReferences(assetId)).resolves.toEqual(
      {
        restrictions: [{ type: 'owner', profileId: 'topic-owner' }],
      }
    );
  });
  it('rejects malformed asset ids before searching content', async () => {
    await expect(
      service.findAssetAudienceReferences('asset-id')
    ).rejects.toThrow('Invalid asset id');
  });
  it('latches a forum owner restriction for private content before persistence', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    const assets = {
      send: jest
        .fn()
        .mockReturnValue(
          of({ profileId: 'topic-owner', audienceRestrictions: [] })
        ),
    };
    (service as any).assets = assets;

    await service.latchAssetReferences(
      `<img src="/asset/${assetId}">`,
      'topic-owner'
    );

    expect(assets.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
      {
        id: assetId,
        restrictions: [{ type: 'owner', profileId: 'topic-owner' }],
      }
    );
  });
  it('rejects a restricted asset when attached to a broader forum audience', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    const assets = {
      send: jest.fn().mockReturnValue(
        of({
          profileId: 'asset-owner',
          audienceRestrictions: [{ type: 'owner', profileId: 'asset-owner' }],
        })
      ),
    };
    (service as any).assets = assets;

    await expect(
      service.latchAssetReferences(
        `<img src="/api/asset/${assetId}">`,
        undefined
      )
    ).rejects.toThrow('Asset audience is narrower than this forum audience');
    expect(assets.send).toHaveBeenCalledTimes(1);
  });
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
