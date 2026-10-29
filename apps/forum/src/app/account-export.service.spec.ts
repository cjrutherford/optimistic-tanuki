import { Observable, of, throwError } from 'rxjs';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import { ForumAccountExportService } from './account-export.service';

const accountId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b911';
const profileId = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b912';
const session = { token: 'synthetic-session', appId: 'forum-test' };
const own = (id: string, fields: Record<string, unknown> = {}) => ({
  id,
  userId: accountId,
  profileId,
  appScope: 'forum',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  visibility: 'public',
  ...fields,
});

describe('ForumAccountExportService', () => {
  const topicRepo = { find: jest.fn() };
  const threadRepo = { find: jest.fn() };
  const postRepo = { find: jest.fn() };
  const auth = { send: jest.fn() };
  const profile = { send: jest.fn() };

  const service = () =>
    new ForumAccountExportService(
      topicRepo as never,
      threadRepo as never,
      postRepo as never,
      auth as never,
      profile as never
    );

  beforeEach(() => {
    jest.clearAllMocks();
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: accountId } })
    );
    profile.send.mockReturnValue(
      of({
        accountId,
        profileIds: [profileId],
        hasMore: false,
        nextCursor: null,
        unfenced: true,
      })
    );
    topicRepo.find.mockResolvedValue([
      own('7b8f0c2e-5509-4f9f-94dd-ced7e8d1b913', {
        title: '<a href="https://example.test">authored title</a>',
        description: '<img src="https://example.test/image">',
        isPinned: true,
        isLocked: false,
      }),
    ]);
    threadRepo.find.mockResolvedValue([
      own('7b8f0c2e-5509-4f9f-94dd-ced7e8d1b914', {
        title: 'own thread',
        description: 'own description',
        content: '<img src="https://example.test/thread">',
        topicId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b915',
        viewCount: 12,
        moderationNotes: 'private operational text',
      }),
    ]);
    postRepo.find.mockResolvedValue([
      own('7b8f0c2e-5509-4f9f-94dd-ced7e8d1b916', {
        content: 'own post',
        threadId: '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b917',
        moderationStatus: 'hidden',
        links: [{ url: 'https://example.test/private' }],
      }),
    ]);
  });

  it('keeps authored HTML inert while returning only selected owned fields as partial', async () => {
    const result = await service().getAccountExportSnapshot(accountId, session);

    expect(result.status).toBe('partial');
    expect(result.participantId).toBe('forum');
    expect(result.uncovered).toContain(
      'embedded-media-and-link-references-unresolved'
    );
    expect(result.data.topics[0].title).toBe(
      '<a href="https://example.test">authored title</a>'
    );
    expect(result.data.topics[0].description).toBe(
      '<img src="https://example.test/image">'
    );
    expect(result.data.threads[0].topicId).toBe(
      '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b915'
    );
    expect(result.data.threads[0]).not.toHaveProperty('viewCount');
    expect(result.data.threads[0]).not.toHaveProperty('moderationNotes');
    expect(result.data.posts[0]).not.toHaveProperty('links');
    expect(JSON.stringify(result)).not.toContain('private operational text');
    expect(auth.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Validate },
      { token: session.token, userId: accountId, appId: session.appId }
    );
    expect(profile.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetOwnedAccountProfileIdPage },
      expect.objectContaining({
        accountId,
        token: session.token,
        appId: session.appId,
        limit: 100,
      })
    );
    for (const repo of [topicRepo, threadRepo, postRepo]) {
      expect(repo.find).toHaveBeenCalledTimes(1);
      expect(repo.find.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          take: 100,
          select: expect.any(Object),
          order: { id: 'ASC' },
          loadEagerRelations: false,
          relations: [],
        })
      );
    }
  });

  it('applies both stored owner predicates and omits a returned row that fails recheck', async () => {
    topicRepo.find.mockResolvedValueOnce([
      own('7b8f0c2e-5509-4f9f-94dd-ced7e8d1b920', {
        title: 'valid',
        description: '',
      }),
      {
        ...own('7b8f0c2e-5509-4f9f-94dd-ced7e8d1b921'),
        userId: profileId,
        title: 'foreign',
        description: '',
      },
    ]);
    const result = await service().getAccountExportSnapshot(accountId, session);
    const options = topicRepo.find.mock.calls[0][0];

    expect(options.where.userId).toBe(accountId);
    expect(options.where.profileId).toBeDefined();
    expect(result.data.topics.map(({ title }) => title)).toEqual(['valid']);
    expect(result.uncovered).toContain('topics-owner-mismatch');
  });

  it('uses one extra keyset row as a per-entity truncation probe at 1,000 candidates', async () => {
    const idFor = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    let calls = 0;
    topicRepo.find.mockImplementation(async (options: { take: number }) => {
      calls += 1;
      if (calls === 11)
        return [own(idFor(1001), { title: 'probe', description: '' })];
      const start = (calls - 1) * 100 + 1;
      return Array.from({ length: options.take }, (_, index) =>
        own(idFor(start + index), { title: 'owned', description: '' })
      );
    });
    const result = await service().getAccountExportSnapshot(accountId, session);

    expect(calls).toBe(11);
    expect(
      topicRepo.find.mock.calls
        .slice(0, 10)
        .every(([options]) => options.take === 100)
    ).toBe(true);
    expect(topicRepo.find.mock.calls[10][0].take).toBe(1);
    expect(result.data.topics).toHaveLength(1000);
    expect(result.uncovered).toContain('topics-preview-limit-exceeded');
    expect(topicRepo.find.mock.calls[1][0].where.id._value).toBe(idFor(100));
  });

  it('counts malformed returned rows toward the 1,000-row scan cap and uses one probe', async () => {
    const idFor = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    let calls = 0;
    topicRepo.find.mockImplementation(async (options: { take: number }) => {
      calls += 1;
      if (calls === 11)
        return [own(idFor(1001), { title: 'probe', description: '' })];
      const start = (calls - 1) * 100 + 1;
      return Array.from({ length: options.take }, (_, index) =>
        own(idFor(start + index), {
          title: { untrusted: true },
          description: '',
        })
      );
    });

    const result = await service().getAccountExportSnapshot(accountId, session);

    expect(calls).toBe(11);
    expect(result.data.topics).toEqual([]);
    expect(result.uncovered).toContain('topics-malformed-or-duplicate-row');
    expect(result.uncovered).toContain('topics-preview-limit-exceeded');
  });

  it('rejects backwards or repeated repository page IDs before emitting the page', async () => {
    topicRepo.find.mockResolvedValueOnce([
      own('00000000-0000-4000-8000-000000000020', {
        title: 'later',
        description: '',
      }),
      own('00000000-0000-4000-8000-000000000010', {
        title: 'earlier',
        description: '',
      }),
    ]);

    const result = await service().getAccountExportSnapshot(accountId, session);

    expect(result.data.topics).toEqual([]);
    expect(result.uncovered).toContain('topics-malformed-or-duplicate-row');
    expect(topicRepo.find).toHaveBeenCalledTimes(1);
  });

  it('resolves a valid multi-page profile set before the entity reads', async () => {
    const secondProfile = '7b8f0c2e-5509-4f9f-94dd-ced7e8d1b924';
    profile.send
      .mockReturnValueOnce(
        of({
          accountId,
          profileIds: [profileId],
          hasMore: true,
          nextCursor: profileId,
          unfenced: true,
        })
      )
      .mockReturnValueOnce(
        of({
          accountId,
          profileIds: [secondProfile],
          hasMore: false,
          nextCursor: null,
          unfenced: true,
        })
      );
    const result = await service().getAccountExportSnapshot(accountId, session);
    expect(result.status).toBe('partial');
    expect(profile.send).toHaveBeenCalledTimes(2);
    expect(profile.send.mock.calls[1][1].afterId).toBe(profileId);
    expect(topicRepo.find.mock.calls[0][0].where.profileId._value).toEqual([
      profileId,
      secondProfile,
    ]);
  });

  it('fails closed on Profile resolver errors before any Forum repository read', async () => {
    profile.send.mockReturnValue(
      throwError(() => new Error('private profile RPC details'))
    );
    const result = await service().getAccountExportSnapshot(accountId, session);
    expect(result.status).toBe('partial');
    expect(result.uncovered).toContain('profile-id-resolution-failed');
    expect(topicRepo.find).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('private profile RPC details');
  });

  it('stops after ten bounded Profile ID pages and marks remaining coverage truncated', async () => {
    const idFor = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    let calls = 0;
    profile.send.mockImplementation(() => {
      calls += 1;
      const id = idFor(calls);
      return of({
        accountId,
        profileIds: [id],
        hasMore: true,
        nextCursor: id,
        unfenced: true,
      });
    });
    const result = await service().getAccountExportSnapshot(accountId, session);
    expect(calls).toBe(10);
    expect(result.uncovered).toContain('profile-id-preview-limit-exceeded');
    expect(topicRepo.find.mock.calls[0][0].where.profileId._value).toHaveLength(
      10
    );
  });

  it('omits a malformed projected field rather than serializing nested objects', async () => {
    topicRepo.find.mockResolvedValueOnce([
      own('7b8f0c2e-5509-4f9f-94dd-ced7e8d1b922', {
        title: { nested: 'foreign payload' },
        description: '',
      }),
    ]);
    const result = await service().getAccountExportSnapshot(accountId, session);
    expect(result.data.topics).toEqual([]);
    expect(result.uncovered).toContain('topics-malformed-or-duplicate-row');
    expect(JSON.stringify(result)).not.toContain('foreign payload');
  });

  it('keeps an empty Forum result partial and handles a repository read failure explicitly', async () => {
    topicRepo.find.mockResolvedValueOnce([]);
    const empty = await service().getAccountExportSnapshot(accountId, session);
    expect(empty.status).toBe('partial');
    expect(empty.data.topics).toEqual([]);
    expect(empty.uncovered).toContain('forum-preview-unfenced');

    topicRepo.find.mockRejectedValueOnce(new Error('private database details'));
    const failed = await service().getAccountExportSnapshot(accountId, session);
    expect(failed.status).toBe('partial');
    expect(failed.uncovered).toContain('topics-read-failed');
    expect(JSON.stringify(failed)).not.toContain('private database details');
  });

  it('omits oversized authored strings and participant data that exceeds the byte budget', async () => {
    topicRepo.find.mockResolvedValueOnce([
      own('7b8f0c2e-5509-4f9f-94dd-ced7e8d1b923', {
        title: 'x'.repeat(4097),
        description: '',
      }),
    ]);
    const stringLimited = await service().getAccountExportSnapshot(
      accountId,
      session
    );
    expect(stringLimited.data.topics).toEqual([]);
    expect(stringLimited.uncovered).toContain(
      'forum-preview-string-limit-exceeded'
    );

    const idFor = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    let offset = 0;
    topicRepo.find.mockImplementation(async (options: { take: number }) => {
      const count = Math.min(options.take, 150 - offset);
      const rows = Array.from({ length: count }, (_, index) =>
        own(idFor(offset + index + 1), {
          title: 'x'.repeat(3500),
          description: 'y'.repeat(3500),
        })
      );
      offset += rows.length;
      return rows;
    });
    const byteLimited = await service().getAccountExportSnapshot(
      accountId,
      session
    );
    expect(byteLimited.data).toEqual({ topics: [], threads: [], posts: [] });
    expect(byteLimited.uncovered).toContain(
      'forum-preview-response-budget-exceeded'
    );
    expect(byteLimited.uncovered).toContain(
      'forum-preview-data-omitted-for-budget'
    );
  });

  it('treats foreign or out-of-order Profile pages as unresolved and performs no repository read', async () => {
    profile.send.mockReturnValueOnce(
      of({
        accountId: profileId,
        profileIds: [profileId],
        hasMore: false,
        nextCursor: null,
        unfenced: true,
      })
    );
    const foreign = await service().getAccountExportSnapshot(
      accountId,
      session
    );
    expect(foreign.uncovered).toContain('profile-id-resolution-failed');
    expect(topicRepo.find).not.toHaveBeenCalled();

    const first = '00000000-0000-4000-8000-000000000020';
    const second = '00000000-0000-4000-8000-000000000010';
    profile.send
      .mockReturnValueOnce(
        of({
          accountId,
          profileIds: [first],
          hasMore: true,
          nextCursor: first,
          unfenced: true,
        })
      )
      .mockReturnValueOnce(
        of({
          accountId,
          profileIds: [second],
          hasMore: false,
          nextCursor: null,
          unfenced: true,
        })
      );
    const outOfOrder = await service().getAccountExportSnapshot(
      accountId,
      session
    );
    expect(outOfOrder.uncovered).toContain('profile-id-resolution-failed');
    expect(topicRepo.find).not.toHaveBeenCalled();
  });

  it('rejects invalid Auth responses before any Forum repository read', async () => {
    auth.send.mockReturnValue(
      of({ isValid: false, data: { userId: accountId } })
    );

    await expect(
      service().getAccountExportSnapshot(accountId, session)
    ).rejects.toThrow();

    expect(profile.send).not.toHaveBeenCalled();
    expect(topicRepo.find).not.toHaveBeenCalled();
    expect(threadRepo.find).not.toHaveBeenCalled();
    expect(postRepo.find).not.toHaveBeenCalled();
  });

  it('rejects a repeated profile ID on a later page before any Forum repository read', async () => {
    profile.send
      .mockReturnValueOnce(
        of({
          accountId,
          profileIds: [profileId],
          hasMore: true,
          nextCursor: profileId,
          unfenced: true,
        })
      )
      .mockReturnValueOnce(
        of({
          accountId,
          profileIds: [profileId],
          hasMore: false,
          nextCursor: null,
          unfenced: true,
        })
      );

    const result = await service().getAccountExportSnapshot(accountId, session);

    expect(result.uncovered).toContain('profile-id-resolution-failed');
    expect(topicRepo.find).not.toHaveBeenCalled();
  });

  it('returns a partial deadline result without claiming the pending database read was cancelled', async () => {
    jest.useFakeTimers();
    try {
      topicRepo.find.mockReturnValue(new Promise(() => undefined));
      const pending = service().getAccountExportSnapshot(accountId, session);
      while (topicRepo.find.mock.calls.length === 0) await Promise.resolve();
      await jest.advanceTimersByTimeAsync(15000);
      const result = await pending;
      expect(result.status).toBe('partial');
      expect(result.uncovered).toContain('topics-read-failed');
      expect(result.uncovered).toContain('forum-read-time-budget-exceeded');
      expect(threadRepo.find).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('charges Auth RPC latency against the same 15-second participant budget', async () => {
    jest.useFakeTimers();
    auth.send.mockReturnValueOnce(
      new Observable((subscriber) => {
        setTimeout(() => {
          subscriber.next({ isValid: true, data: { userId: accountId } });
          subscriber.complete();
        }, 2000);
      })
    );
    topicRepo.find.mockReturnValue(new Promise(() => undefined));

    try {
      const pending = service().getAccountExportSnapshot(accountId, session);
      await jest.advanceTimersByTimeAsync(2000);
      while (topicRepo.find.mock.calls.length === 0) await Promise.resolve();
      await jest.advanceTimersByTimeAsync(13000);
      const result = await pending;

      expect(result.status).toBe('partial');
      expect(result.uncovered).toContain('forum-read-time-budget-exceeded');
      expect(threadRepo.find).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects a mismatched Auth response subject before reading Forum repositories', async () => {
    auth.send.mockReturnValue(
      of({ isValid: true, data: { userId: profileId } })
    );
    await expect(
      service().getAccountExportSnapshot(accountId, session)
    ).rejects.toThrow();
    expect(topicRepo.find).not.toHaveBeenCalled();
    expect(threadRepo.find).not.toHaveBeenCalled();
    expect(postRepo.find).not.toHaveBeenCalled();
  });
});
