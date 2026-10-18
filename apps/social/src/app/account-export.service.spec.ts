import { SocialAccountExportService } from './account-export.service';
import { of, throwError } from 'rxjs';
import { AuthCommands } from '@optimistic-tanuki/constants';

describe('SocialAccountExportService', () => {
  const accountId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b911';
  const profileId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b912';
  const postId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b913';
  const session = { token: 'session', appId: 'app' };
  const repo = () => ({ find: jest.fn().mockResolvedValue([]) });
  const post = repo();
  const comment = repo();
  const reaction = repo();
  const vote = repo();
  const attachment = repo();
  const poll = repo();
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

  it('rejects an invalid account before calling Authentication, Profile, or Social ORM', async () => {
    const service = new SocialAccountExportService(
      post as never,
      comment as never,
      reaction as never,
      vote as never,
      attachment as never,
      poll as never,
      auth as never,
      profiles as never
    );
    await expect(
      service.getAccountExportSnapshot('bad', session)
    ).rejects.toThrow();
    expect(auth.send).not.toHaveBeenCalled();
    expect(profiles.send).not.toHaveBeenCalled();
    expect(post.find).not.toHaveBeenCalled();
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
      auth as never,
      profiles as never
    );

    const snapshot = await service.getAccountExportSnapshot(accountId, session);

    expect(snapshot.data.reactions).toEqual([]);
    expect(snapshot.uncovered).toContain('reactions-owner-mismatch');
  });
});
