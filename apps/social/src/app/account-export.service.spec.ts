import { SocialAccountExportService } from './account-export.service';
import { of, throwError } from 'rxjs';
import { AuthCommands } from '@optimistic-tanuki/constants';

describe('SocialAccountExportService', () => {
  const accountId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b911';
  const profileId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b912';
  const postId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b913';
  const session = { token: 'session', appId: 'app' };
  const repo = () => ({ find: jest.fn().mockResolvedValue([]) });
  const emptyQueryBuilder = () => {
    const builder: any = {};
    for (const method of [
      'select',
      'addSelect',
      'from',
      'innerJoin',
      'where',
      'orderBy',
      'addOrderBy',
      'limit',
    ])
      builder[method] = jest.fn(() => builder);
    builder.getRawMany = jest.fn().mockResolvedValue([]);
    return builder;
  };
  const post = repo();
  post.manager = { createQueryBuilder: jest.fn(emptyQueryBuilder) };
  const comment = repo();
  const reaction = repo();
  const vote = repo();
  const attachment = repo();
  const poll = repo();
  const savedItems = repo();
  const searchHistory = repo();
  const follows = repo();
  const blocks = repo();
  const mutes = repo();
  const auth = { send: jest.fn().mockReturnValue(of({})) };
  const profiles = { send: jest.fn().mockReturnValue(of({})) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authenticates before Social reads and returns only allowlisted own rows as partial', async () => {
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: accountId } })
    );
    profiles.send.mockReturnValue(
      of({
        accountId,
        profileIds: [profileId],
        hasMore: false,
        nextCursor: null,
        unfenced: true,
      })
    );
    post.find.mockResolvedValue([
      {
        id: postId,
        userId: accountId,
        profileId,
        title: 'title',
        content: 'body',
        appScope: 'social',
        createdAt: new Date(0),
        updatedAt: new Date(0),
        visibility: 'public',
        publicAudienceExplicit: true,
        communityId: null,
        scheduledAt: null,
        isScheduled: false,
        moderationNotes: 'must not escape',
      },
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b914',
        userId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b915',
        profileId,
        title: 'foreign',
      },
    ]);
    attachment.find.mockResolvedValue([
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b916',
        name: 'image',
        type: 'IMAGE',
        appScope: 'social',
        filePath: 'https://secret.example/private?token=must-not-export',
        post: { id: postId },
      },
    ]);
    poll.find.mockResolvedValue([
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b917',
        question: 'Question',
        options: ['a', 'b'],
        votes: ['foreign-vote'],
        isMultipleChoice: false,
        endsAt: null,
        showResultsBeforeVote: true,
        isAnonymous: false,
        createdAt: new Date(0),
        userId: accountId,
        profileId,
        post: { id: postId },
      },
    ]);
    const service = new SocialAccountExportService(
      post as never,
      comment as never,
      reaction as never,
      vote as never,
      attachment as never,
      poll as never,
      savedItems as never,
      searchHistory as never,
      follows as never,
      blocks as never,
      mutes as never,
      auth as never,
      profiles as never
    );

    const snapshot = await service.getAccountExportSnapshot(accountId, {
      ...session,
    });

    expect(snapshot.status).toBe('partial');
    expect(snapshot.uncovered).toContain('social-preview-unfenced');
    expect(auth.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Validate },
      { token: session.token, userId: accountId, appId: session.appId }
    );
    expect(snapshot.data.posts).toHaveLength(1);
    expect(snapshot.data.posts[0]).not.toHaveProperty('moderationNotes');
    expect(snapshot.data.attachments[0]).not.toHaveProperty('filePath');
    expect(snapshot.data.polls[0]).not.toHaveProperty('votes');
    expect(JSON.stringify(snapshot)).not.toContain('must-not-export');
    expect(auth.send.mock.invocationCallOrder[0]).toBeLessThan(
      post.find.mock.invocationCallOrder[0]
    );
    expect(post.find.mock.calls[0][0].select).toEqual(
      expect.arrayContaining(['id', 'userId', 'profileId', 'content'])
    );
    expect(post.find.mock.calls[0][0].take).toBe(100);
  });

  it('exports Poll definitions by trusted author identity without a Post association', async () => {
    const foreignProfileId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b915';
    const ownPollId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b916';
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: accountId } })
    );
    profiles.send.mockReturnValue(
      of({
        accountId,
        profileIds: [profileId],
        hasMore: false,
        nextCursor: null,
        unfenced: true,
      })
    );
    poll.find.mockResolvedValue([
      {
        id: ownPollId,
        userId: accountId,
        profileId,
        question: 'Own question',
        options: ['yes', 'no'],
        votes: ['private vote data'],
        isMultipleChoice: false,
        endsAt: null,
        showResultsBeforeVote: true,
        isAnonymous: false,
        createdAt: new Date(0),
        post: { id: postId },
      },
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b917',
        userId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b918',
        profileId,
        question: 'Foreign account poll',
        options: ['x'],
      },
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b919',
        userId: accountId,
        profileId: foreignProfileId,
        question: 'Foreign profile poll',
        options: ['x'],
      },
    ]);
    const service = new SocialAccountExportService(
      post as never,
      comment as never,
      reaction as never,
      vote as never,
      attachment as never,
      poll as never,
      savedItems as never,
      searchHistory as never,
      follows as never,
      blocks as never,
      mutes as never,
      auth as never,
      profiles as never
    );

    const snapshot = await service.getAccountExportSnapshot(accountId, session);

    expect(snapshot.data.polls).toEqual([
      expect.objectContaining({
        id: ownPollId,
        profileId,
        question: 'Own question',
        options: ['yes', 'no'],
      }),
    ]);
    expect(snapshot.data.polls[0]).not.toHaveProperty('votes');
    expect(snapshot.uncovered).toContain('poll-post-association-unverified');
    expect(snapshot.uncovered).toContain('social-poll-vote-history-uncovered');
    const query = poll.find.mock.calls[0][0];
    expect(query.where).toMatchObject({
      userId: accountId,
      profileId: expect.anything(),
    });
    expect(query.select).toEqual(
      expect.objectContaining({
        id: true,
        userId: true,
        profileId: true,
        question: true,
        options: true,
      })
    );
    expect(query.select).not.toHaveProperty('post');
    expect(query.select).not.toHaveProperty('votes');
    expect(query).not.toHaveProperty('relations');
  });

  it('exports only valid owned post-link associations and truncates raw results safely', async () => {
    const ownedPostId = postId;
    const otherPostId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b914';
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: accountId } })
    );
    profiles.send.mockReturnValue(
      of({
        accountId,
        profileIds: [profileId],
        hasMore: false,
        nextCursor: null,
        unfenced: true,
      })
    );
    post.find.mockResolvedValue([
      {
        id: ownedPostId,
        userId: accountId,
        profileId,
        appScope: 'social',
        title: 'owned',
        content: '',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      {
        id: otherPostId,
        userId: accountId,
        profileId,
        appScope: 'social',
        title: 'owned 2',
        content: '',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ]);
    const rows: any[] = [
      {
        postId: ownedPostId,
        linkId: '1',
        url: 'https://example.test/a',
        appScope: 'social',
        linkAppScope: 'social',
      },
      {
        postId: ownedPostId,
        linkId: '1',
        url: 'https://example.test/a',
        appScope: 'social',
        linkAppScope: 'social',
      },
      {
        postId: otherPostId,
        linkId: '2',
        url: 'https://example.test/b',
        appScope: 'social',
        linkAppScope: 'social',
      },
      {
        postId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b915',
        linkId: '3',
        url: 'https://example.test/c',
        appScope: 'social',
        linkAppScope: 'social',
      },
      {
        postId: ownedPostId,
        linkId: '4',
        url: 'javascript:alert(1)',
        appScope: 'social',
        linkAppScope: 'social',
      },
      {
        postId: ownedPostId,
        linkId: '5',
        url: 'https://example.test/api/asset/7b8f0c2e-5509-4f9f-94dd-ced7e8d1b916',
        appScope: 'social',
        linkAppScope: 'social',
      },
      {
        postId: ownedPostId,
        linkId: '-1',
        url: 'https://example.test/bad-id',
        appScope: 'social',
        linkAppScope: 'social',
      },
      {
        postId: ownedPostId,
        linkId: '2000',
        url: 'https://example.test/cross-scope',
        appScope: 'social',
        linkAppScope: 'other',
      },
      {
        postId: ownedPostId,
        linkId: '2001',
        url: 'https://user:secret@example.test',
        appScope: 'social',
        linkAppScope: 'social',
      },
      {
        postId: ownedPostId,
        linkId: '2002',
        url: 'https://example.test/asset/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        appScope: 'social',
        linkAppScope: 'social',
      },
      ...Array.from({ length: 1000 }, (_, i) => ({
        postId: ownedPostId,
        linkId: String(i + 6),
        url: `https://example.test/${i}`,
        appScope: 'social',
        linkAppScope: 'social',
      })),
    ];
    const qb = emptyQueryBuilder();
    qb.getRawMany.mockResolvedValue(rows);
    post.manager.createQueryBuilder.mockReturnValue(qb);
    const service = new SocialAccountExportService(
      post as never,
      comment as never,
      reaction as never,
      vote as never,
      attachment as never,
      poll as never,
      savedItems as never,
      searchHistory as never,
      follows as never,
      blocks as never,
      mutes as never,
      auth as never,
      profiles as never
    );

    const snapshot = await service.getAccountExportSnapshot(accountId, session);
    expect(snapshot.data.postLinks).toHaveLength(993);
    expect(snapshot.data.postLinks[0]).toEqual({
      postId: ownedPostId,
      linkId: 1,
      appScope: 'social',
      url: 'https://example.test/a',
    });
    expect(snapshot.data.postLinks.find((item: any) => item.assetId)).toEqual({
      postId: ownedPostId,
      linkId: 5,
      appScope: 'social',
      assetId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b916',
      referenceOnly: true,
    });
    expect(
      snapshot.data.postLinks.find((item: any) => item.linkId === 4)
    ).toBeUndefined();
    expect(
      snapshot.data.postLinks.some((item: any) =>
        item.url?.startsWith('javascript:')
      )
    ).toBe(false);
    expect(snapshot.uncovered).toContain('post-links-malformed-or-unowned-row');
    expect(snapshot.uncovered).toContain('post-links-preview-limit-exceeded');
    expect(qb.where).toHaveBeenCalledWith('post.id IN (:...ids)', {
      ids: [ownedPostId, otherPostId],
    });
  });

  it('rejects an invalid account before calling Authentication, Profile, or Social ORM', async () => {
    const service = new SocialAccountExportService(
      post as never,
      comment as never,
      reaction as never,
      vote as never,
      attachment as never,
      poll as never,
      savedItems as never,
      searchHistory as never,
      follows as never,
      blocks as never,
      mutes as never,
      auth as never,
      profiles as never
    );
    await expect(
      service.getAccountExportSnapshot('bad', session)
    ).rejects.toThrow();
    expect(auth.send).not.toHaveBeenCalled();
    expect(profiles.send).not.toHaveBeenCalled();
    expect(
      [
        post,
        comment,
        reaction,
        vote,
        attachment,
        poll,
        savedItems,
        searchHistory,
        follows,
        blocks,
        mutes,
      ].every((repository) => repository.find.mock.calls.length === 0)
    ).toBe(true);
  });

  it('returns an explicit partial diagnostic and performs no reads when Profile identity resolution fails', async () => {
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: accountId } })
    );
    profiles.send.mockReturnValue(
      throwError(() => new Error('profile unavailable'))
    );
    const service = new SocialAccountExportService(
      post as never,
      comment as never,
      reaction as never,
      vote as never,
      attachment as never,
      poll as never,
      savedItems as never,
      searchHistory as never,
      follows as never,
      blocks as never,
      mutes as never,
      auth as never,
      profiles as never
    );

    const snapshot = await service.getAccountExportSnapshot(accountId, session);

    expect(snapshot.status).toBe('partial');
    expect(snapshot.uncovered).toContain('profile-id-resolution-failed');
    expect(snapshot.data.posts).toEqual([]);
    expect(
      [
        post.find,
        comment.find,
        reaction.find,
        vote.find,
        attachment.find,
        poll.find,
        savedItems.find,
        searchHistory.find,
        follows.find,
        blocks.find,
        mutes.find,
      ].every((find) => find.mock.calls.length === 0)
    ).toBe(true);
  });

  it.each([
    {
      name: 'an unordered profile page',
      pages: [
        {
          accountId,
          profileIds: [
            '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b914',
            '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b912',
          ],
          hasMore: false,
          nextCursor: null,
          unfenced: true,
        },
      ],
    },
    {
      name: 'a duplicate profile ID carried into a later page',
      pages: [
        {
          accountId,
          profileIds: [
            '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b914',
            '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b912',
          ],
          hasMore: true,
          nextCursor: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b912',
          unfenced: true,
        },
        {
          accountId,
          profileIds: ['7b8f0c2e-5509-4f9f-94dd-ced7e8d1b914'],
          hasMore: false,
          nextCursor: null,
          unfenced: true,
        },
      ],
    },
  ])(
    'returns partial and performs no dataset reads for $name',
    async ({ pages }) => {
      auth.send.mockReturnValue(
        of({ isValid: true, data: { userId: accountId } })
      );
      let pageIndex = 0;
      profiles.send.mockImplementation(() => of(pages[pageIndex++]));
      const service = new SocialAccountExportService(
        post as never,
        comment as never,
        reaction as never,
        vote as never,
        attachment as never,
        poll as never,
        savedItems as never,
        searchHistory as never,
        follows as never,
        blocks as never,
        mutes as never,
        auth as never,
        profiles as never
      );

      const snapshot = await service.getAccountExportSnapshot(
        accountId,
        session
      );

      expect(snapshot.status).toBe('partial');
      expect(snapshot.uncovered).toContain('profile-id-resolution-failed');
      expect(
        [
          post.find,
          comment.find,
          reaction.find,
          vote.find,
          attachment.find,
          poll.find,
          savedItems.find,
          searchHistory.find,
          follows.find,
          blocks.find,
          mutes.find,
        ].every((find) => find.mock.calls.length === 0)
      ).toBe(true);
    }
  );

  it('rechecks Reaction ownership even if the repository ignores the requested predicate', async () => {
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: accountId } })
    );
    profiles.send.mockReturnValue(
      of({
        accountId,
        profileIds: [profileId],
        hasMore: false,
        nextCursor: null,
        unfenced: true,
      })
    );
    reaction.find.mockResolvedValue([
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b918',
        userId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b919',
        profileId,
        value: 1,
        appScope: 'social',
        post: { id: postId },
      },
    ]);
    const service = new SocialAccountExportService(
      post as never,
      comment as never,
      reaction as never,
      vote as never,
      attachment as never,
      poll as never,
      savedItems as never,
      searchHistory as never,
      follows as never,
      blocks as never,
      mutes as never,
      auth as never,
      profiles as never
    );

    const snapshot = await service.getAccountExportSnapshot(accountId, session);

    expect(snapshot.data.reactions).toEqual([]);
    expect(snapshot.uncovered).toContain('reactions-owner-mismatch');
  });

  it('projects only actor-owned saved, search, follow, block, and mute fields', async () => {
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: accountId } })
    );
    profiles.send.mockReturnValue(
      of({
        accountId,
        profileIds: [profileId],
        hasMore: false,
        nextCursor: null,
        unfenced: true,
      })
    );
    savedItems.find.mockResolvedValue([
      {
        id: postId,
        profileId,
        itemType: 'post',
        itemId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b914',
        itemTitle: 'foreign title must not escape',
        savedAt: new Date(0),
      },
    ]);
    searchHistory.find.mockResolvedValue([
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b915',
        profileId,
        query: 'private owner query',
        searchType: 'users',
        resultCount: 99,
        createdAt: new Date(0),
      },
    ]);
    follows.find.mockResolvedValue([
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b916',
        followerId: profileId,
        followeeId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b917',
        appScope: 'social',
        createdAt: new Date(0),
        updatedAt: new Date(0),
        isMutual: true,
      },
    ]);
    blocks.find.mockResolvedValue([
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b918',
        blockerId: profileId,
        blockedId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b919',
        reason: 'private owner reason',
        createdAt: new Date(0),
        blockedName: 'counterpart identity must not escape',
      },
    ]);
    mutes.find.mockResolvedValue([
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b920',
        muterId: profileId,
        mutedId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b921',
        duration: null,
        createdAt: new Date(0),
        mutedName: 'counterpart identity must not escape',
      },
    ]);
    const service = new SocialAccountExportService(
      post as never,
      comment as never,
      reaction as never,
      vote as never,
      attachment as never,
      poll as never,
      savedItems as never,
      searchHistory as never,
      follows as never,
      blocks as never,
      mutes as never,
      auth as never,
      profiles as never
    );

    const snapshot = await service.getAccountExportSnapshot(accountId, session);
    const data = snapshot.data as Record<string, any[]>;

    expect(data.savedItems).toEqual([
      {
        id: postId,
        profileId,
        itemType: 'post',
        itemId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b914',
        savedAt: new Date(0),
      },
    ]);
    expect(data.searchHistory[0]).toEqual({
      id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b915',
      profileId,
      query: 'private owner query',
      searchType: 'users',
      createdAt: new Date(0),
    });
    expect(data.follows[0]).toEqual({
      id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b916',
      followerId: profileId,
      followeeId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b917',
      appScope: 'social',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    expect(data.blocks[0]).toEqual({
      id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b918',
      blockerId: profileId,
      blockedId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b919',
      reason: 'private owner reason',
      createdAt: new Date(0),
    });
    expect(data.mutes[0]).toEqual({
      id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b920',
      muterId: profileId,
      mutedId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b921',
      duration: null,
      createdAt: new Date(0),
    });
    expect(snapshot.status).toBe('partial');
    expect(snapshot.uncovered).toContain('social-preview-unfenced');
    expect(JSON.stringify(snapshot)).not.toMatch(
      /foreign title must not escape|resultCount|isMutual|counterpart identity must not escape/
    );
    for (const [repository, actorField] of [
      [savedItems, 'profileId'],
      [searchHistory, 'profileId'],
      [follows, 'followerId'],
      [blocks, 'blockerId'],
      [mutes, 'muterId'],
    ] as const) {
      const query = repository.find.mock.calls[0][0];
      expect(query.where[actorField]).toEqual(expect.anything());
      expect(query.select).toEqual(expect.arrayContaining(['id', actorField]));
      expect(query.order).toEqual({ id: 'ASC' });
      expect(query.take).toBe(100);
    }
    expect(savedItems.find.mock.calls[0][0].select).toEqual([
      'id',
      'profileId',
      'itemType',
      'itemId',
      'savedAt',
    ]);
    expect(searchHistory.find.mock.calls[0][0].select).toEqual([
      'id',
      'profileId',
      'query',
      'searchType',
      'createdAt',
    ]);
    expect(follows.find.mock.calls[0][0].select).toEqual([
      'id',
      'followerId',
      'followeeId',
      'appScope',
      'createdAt',
      'updatedAt',
    ]);
    expect(blocks.find.mock.calls[0][0].select).toEqual([
      'id',
      'blockerId',
      'blockedId',
      'reason',
      'createdAt',
    ]);
    expect(mutes.find.mock.calls[0][0].select).toEqual([
      'id',
      'muterId',
      'mutedId',
      'duration',
      'createdAt',
    ]);
  });

  it('omits malformed rows and records store read failures without echoing data', async () => {
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: accountId } })
    );
    profiles.send.mockReturnValue(
      of({
        accountId,
        profileIds: [profileId],
        hasMore: false,
        nextCursor: null,
        unfenced: true,
      })
    );
    savedItems.find.mockResolvedValue([
      {
        id: postId,
        profileId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b922',
        itemType: 'post',
        itemId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b914',
        savedAt: new Date(0),
      },
    ]);
    searchHistory.find.mockRejectedValue(new Error('private search SQL'));
    follows.find.mockResolvedValue([
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b916',
        followerId: profileId,
        followeeId: profileId,
        appScope: 'social',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ]);
    blocks.find.mockResolvedValue([
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b918',
        blockerId: profileId,
        blockedId: profileId,
        reason: null,
        createdAt: new Date(0),
      },
    ]);
    mutes.find.mockResolvedValue([
      {
        id: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b920',
        muterId: profileId,
        mutedId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b921',
        duration: 31536001,
        createdAt: new Date(0),
      },
    ]);
    const service = new SocialAccountExportService(
      post as never,
      comment as never,
      reaction as never,
      vote as never,
      attachment as never,
      poll as never,
      savedItems as never,
      searchHistory as never,
      follows as never,
      blocks as never,
      mutes as never,
      auth as never,
      profiles as never
    );

    const snapshot = await service.getAccountExportSnapshot(accountId, session);
    const data = snapshot.data as Record<string, any[]>;

    expect(data.savedItems).toEqual([]);
    expect(data.searchHistory).toEqual([]);
    expect(data.follows).toEqual([]);
    expect(data.blocks).toEqual([]);
    expect(data.mutes).toEqual([]);
    expect(snapshot.uncovered).toEqual(
      expect.arrayContaining([
        'saved-items-owner-mismatch',
        'search-history-read-failed',
        'follows-malformed-or-duplicate-row',
        'blocks-malformed-or-duplicate-row',
        'mutes-malformed-or-duplicate-row',
      ])
    );
    expect(JSON.stringify(snapshot)).not.toContain('private search SQL');
  });

  it('caps inspected store rows at 1,000 plus one truncation probe', async () => {
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: accountId } })
    );
    profiles.send.mockReturnValue(
      of({
        accountId,
        profileIds: [profileId],
        hasMore: false,
        nextCursor: null,
        unfenced: true,
      })
    );
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      profileId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b922',
      itemType: 'invalid-legacy-value',
      itemId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b914',
      savedAt: new Date(0),
    }));
    for (let page = 0; page < 10; page++) {
      savedItems.find.mockResolvedValueOnce(
        rows.slice(page * 100, page * 100 + 100)
      );
    }
    savedItems.find.mockResolvedValueOnce([rows[1000]]);
    const service = new SocialAccountExportService(
      post as never,
      comment as never,
      reaction as never,
      vote as never,
      attachment as never,
      poll as never,
      savedItems as never,
      searchHistory as never,
      follows as never,
      blocks as never,
      mutes as never,
      auth as never,
      profiles as never
    );

    const snapshot = await service.getAccountExportSnapshot(accountId, session);

    expect(snapshot.data.savedItems).toEqual([]);
    expect(snapshot.uncovered).toContain('saved-items-preview-limit-exceeded');
    expect(savedItems.find).toHaveBeenCalledTimes(11);
    expect(savedItems.find.mock.calls.at(-1)?.[0].take).toBe(1);
  });
});
