import { Test, TestingModule } from '@nestjs/testing';
import { SocialGateway } from './social.gateway';
import { PostCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { throwError, of, NEVER, Subject } from 'rxjs';
import { SocketSessionAuthService } from '../../auth/socket-session-auth.service';

describe('SocialGateway', () => {
  let gateway: SocialGateway;
  let mockSocialClient: any;
  let mockSocketSessionAuth: any;

  beforeEach(async () => {
    mockSocialClient = {
      send: jest.fn().mockReturnValue(of([])),
    };
    mockSocketSessionAuth = {
      authenticate: jest.fn(async (client: any) => {
        client.data ??= {};
        const user = client.data.user ?? {
          userId: 'user-id',
          profileId: 'reader',
        };
        client.data.user = user;
        return user;
      }),
      assertProfile: jest.fn((client: any, profileId: string) => {
        client.data ??= {};
        const user = { userId: 'user-id', profileId };
        client.data.user = user;
        return user;
      }),
      getUser: jest.fn((client: any) => client.data.user),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialGateway,
        {
          provide: ServiceTokens.SOCIAL_SERVICE,
          useValue: mockSocialClient,
        },
        {
          provide: SocketSessionAuthService,
          useValue: mockSocketSessionAuth,
        },
      ],
    }).compile();

    gateway = module.get<SocialGateway>(SocialGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('waits for cookie-session authentication before accepting initial feed messages', async () => {
    let resolveAuthentication!: (user: {
      userId: string;
      profileId: string;
    }) => void;
    const authentication = new Promise<{
      userId: string;
      profileId: string;
    }>((resolve) => {
      resolveAuthentication = resolve;
    });
    mockSocketSessionAuth.authenticate.mockImplementation(
      async (client: any) => {
        const user = await authentication;
        client.data.user = user;
        return user;
      }
    );
    mockSocketSessionAuth.assertProfile.mockImplementation(
      (client: any, requestedProfileId: string) => {
        const user = client.data.user;
        if (!user || user.profileId !== requestedProfileId) {
          throw new Error('Socket session is not ready');
        }
        return user;
      }
    );
    const client: any = {
      id: 'socket-before-auth-ready',
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const feed = [{ id: 'public-post', visibility: 'public' }];
    mockSocialClient.send.mockReturnValue(of(feed));

    const connection = gateway.handleConnection(client);
    const initialMessages = Promise.allSettled([
      gateway.handleGetFeed({ profileId: 'reader' }, client),
      gateway.handleSubscribePosts({ profileId: 'reader' }, client),
    ]);
    resolveAuthentication({ userId: 'reader-account', profileId: 'reader' });
    await connection;
    const messageResults = await initialMessages;

    expect(messageResults.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ]);
    expect(client.emit).toHaveBeenCalledWith('feed', feed);
    expect(client.emit).toHaveBeenCalledWith('subscribed', {
      type: 'posts',
      postIds: ['all'],
    });
  });

  it('suppresses a deferred feed result when the session is revoked in flight', async () => {
    const response = new Subject<any[]>();
    let resolveFeedStarted!: () => void;
    const feedStarted = new Promise<void>((resolve) => {
      resolveFeedStarted = resolve;
    });
    let revoked = false;
    mockSocketSessionAuth.authenticate.mockImplementation(
      async (client: any) => {
        if (revoked) throw new Error('session revoked');
        client.data.user ??= { userId: 'account-1', profileId: 'reader' };
        return client.data.user;
      }
    );
    mockSocialClient.send.mockImplementation(() => {
      resolveFeedStarted();
      return response;
    });
    const client: any = {
      id: 'socket-revoked-during-feed',
      data: { user: { userId: 'account-1', profileId: 'reader' } },
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client);
    const pendingFeed = gateway.handleGetFeed({ profileId: 'reader' }, client);
    await feedStarted;
    revoked = true;
    response.next([{ id: 'private-feed-result' }]);
    response.complete();
    await pendingFeed;

    expect(client.emit).not.toHaveBeenCalledWith('feed', expect.anything());
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect((gateway as any).connectedClients.size).toBe(0);
    expect((gateway as any).clientToConnectedClient(client)).toBeUndefined();
  });

  it('disconnects and never subscribes when cookie-session validation fails', async () => {
    let rejectAuthentication!: (error: Error) => void;
    const authentication = new Promise<never>((_resolve, reject) => {
      rejectAuthentication = reject;
    });
    mockSocketSessionAuth.authenticate.mockReturnValue(authentication);
    const client: any = {
      id: 'socket-rejected-auth',
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    const connection = gateway.handleConnection(client);
    const subscription = Promise.allSettled([
      gateway.handleSubscribePosts({ profileId: 'reader' }, client),
    ]);
    rejectAuthentication(new Error('invalid session'));
    await connection;
    const [subscriptionResult] = await subscription;

    expect(subscriptionResult.status).toBe('rejected');
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.emit).not.toHaveBeenCalledWith(
      'subscribed',
      expect.anything()
    );
    expect(gateway['connectedClients'].size).toBe(0);
  });

  it('revalidates an active socket before protected packets and disconnects revoked users', async () => {
    const user = { userId: 'minor-user', profileId: 'minor-profile' };
    let revoked = false;
    mockSocketSessionAuth.authenticate.mockImplementation(async (client: any) => {
      if (revoked) throw new Error('revoked session');
      client.data.user = user;
      return user;
    });
    mockSocketSessionAuth.assertProfile.mockImplementation(
      (client: any, requestedProfileId: string) => {
        if (client.data.user?.profileId !== requestedProfileId) {
          throw new Error('wrong profile');
        }
        return client.data.user;
      }
    );
    const client: any = {
      id: 'revoked-active-socket',
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    await gateway.handleConnection(client);
    expect(gateway['connectedClients'].get('minor-profile')?.size).toBe(1);
    await gateway.handleGetFollowing(
      { profileId: 'minor-profile' },
      client
    );
    expect(mockSocialClient.send).toHaveBeenCalled();
    mockSocialClient.send.mockClear();

    revoked = true;
    await expect(
      gateway.handleGetFollowing({ profileId: 'minor-profile' }, client)
    ).rejects.toThrow('revoked session');

    expect(mockSocialClient.send).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(gateway['connectedClients'].size).toBe(0);
    expect(gateway['clientToProfileMap'].size).toBe(0);
  });

  it('does not send private broadcasts to an active socket after session revocation', async () => {
    const user = { userId: 'minor-user', profileId: 'minor-profile' };
    let revoked = false;
    mockSocketSessionAuth.authenticate.mockImplementation(async (client: any) => {
      if (revoked) throw new Error('revoked session');
      client.data.user = user;
      return user;
    });
    mockSocketSessionAuth.assertProfile.mockImplementation(
      (client: any, requestedProfileId: string) => {
        if (client.data.user?.profileId !== requestedProfileId) {
          throw new Error('wrong profile');
        }
        return client.data.user;
      }
    );
    const client: any = {
      id: 'revoked-broadcast-socket',
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    await gateway.handleConnection(client);
    await gateway.handleSubscribeNotifications(
      { profileId: 'minor-profile' },
      client
    );
    const notification = {
      recipientId: 'minor-profile',
      message: 'private notification',
    };
    await gateway.broadcastNotification(notification);
    expect(client.emit).toHaveBeenCalledWith('notification', notification);
    client.emit.mockClear();

    revoked = true;
    await gateway.broadcastNotification(notification);

    expect(client.emit).not.toHaveBeenCalledWith(
      'notification',
      expect.anything()
    );
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(gateway['connectedClients'].size).toBe(0);
    expect(gateway['clientToProfileMap'].size).toBe(0);
  });

  it('does not register or serve messages when a socket disconnects during authentication', async () => {
    let resolveAuthentication!: (user: {
      userId: string;
      profileId: string;
    }) => void;
    const authentication = new Promise<{
      userId: string;
      profileId: string;
    }>((resolve) => {
      resolveAuthentication = resolve;
    });
    mockSocketSessionAuth.authenticate.mockImplementation(
      async (client: any) => {
        const user = await authentication;
        client.data.user = user;
        return user;
      }
    );
    const client: any = {
      id: 'socket-disconnected-before-auth-ready',
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    const connection = gateway.handleConnection(client);
    const pendingMessages = Promise.allSettled([
      gateway.handleGetFeed({ profileId: 'reader' }, client),
      gateway.handleSubscribePosts({ profileId: 'reader' }, client),
    ]);
    gateway.handleDisconnect(client);
    resolveAuthentication({ userId: 'reader-account', profileId: 'reader' });
    await connection;
    const messageResults = await pendingMessages;

    expect(messageResults.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(mockSocialClient.send).not.toHaveBeenCalled();
    expect(client.emit).not.toHaveBeenCalled();
    expect(gateway['connectedClients'].size).toBe(0);
  });

  describe('handleGetFeed', () => {
    it('should fetch and emit feed for a profile', async () => {
      const mockClient: any = {
        emit: jest.fn(),
      };

      const payload = { profileId: 'user123', limit: 10, offset: 0 };
      const mockPosts = [{ id: 'post1', content: 'Test post' }];

      mockSocialClient.send.mockReturnValue(of(mockPosts));

      await gateway.handleGetFeed(payload, mockClient);

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: PostCommands.FIND_MANY },
        expect.objectContaining({
          viewerProfileId: 'user123',
        })
      );
      expect(mockClient.emit).toHaveBeenCalledWith('feed', mockPosts);
    });

    it('should handle errors when fetching feed', async () => {
      const mockClient: any = {
        emit: jest.fn(),
      };

      const payload = { profileId: 'user123' };

      mockSocialClient.send.mockReturnValue(
        throwError(() => new Error('Service error'))
      );

      await gateway.handleGetFeed(payload, mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Failed to fetch feed',
      });
    });

    it('does not emit a feed snapshot started before creation and subscription', async () => {
      const client: any = { emit: jest.fn() };
      const staleFeed = new Subject<any[]>();
      const newPost = { id: 'new-public-post', content: 'new' };
      let markFeedStarted!: () => void;
      const feedStarted = new Promise<void>((resolve) => {
        markFeedStarted = resolve;
      });
      mockSocialClient.send.mockImplementation((pattern: any) => {
        if (pattern.cmd === PostCommands.FIND_MANY) {
          markFeedStarted();
          return staleFeed;
        }
        return of(newPost);
      });

      const pendingFeed = gateway.handleGetFeed(
        { profileId: 'reader' },
        client
      );
      await feedStarted;
      await gateway.broadcastPostCreated(newPost);
      await gateway.handleSubscribePosts({ profileId: 'reader' }, client);
      staleFeed.next([{ id: 'old-post', content: 'old snapshot' }]);
      staleFeed.complete();
      await pendingFeed;

      expect(client.emit).not.toHaveBeenCalledWith('post_created', newPost);
      expect(client.emit).not.toHaveBeenCalledWith('feed', [
        { id: 'old-post', content: 'old snapshot' },
      ]);
      expect(client.emit).toHaveBeenCalledWith('subscribed', {
        type: 'posts',
        postIds: ['all'],
      });
    });

    it('drops a feed read started before audience narrowing and recovers on the next authorized read', async () => {
      const client: any = { emit: jest.fn() };
      const pendingRead = new Subject<any[]>();
      const previouslyVisible = {
        id: 'followers-post',
        content: 'must not return after narrowing',
      };
      const freshAuthorizedFeed = [
        { id: 'public-post', content: 'still authorized' },
      ];
      let feedRequests = 0;
      let markReadStarted!: () => void;
      const readStarted = new Promise<void>((resolve) => {
        markReadStarted = resolve;
      });
      mockSocialClient.send.mockImplementation((pattern: any) => {
        if (pattern.cmd === PostCommands.FIND_MANY) {
          feedRequests++;
          if (feedRequests === 1) {
            markReadStarted();
            return pendingRead;
          }
          return of(freshAuthorizedFeed);
        }
        return of(null);
      });

      const staleRequest = gateway.handleGetFeed(
        { profileId: 'reader' },
        client
      );
      await readStarted;
      await gateway.broadcastPostUpdated({
        id: previouslyVisible.id,
        visibility: 'private',
      });
      pendingRead.next([previouslyVisible]);
      pendingRead.complete();
      await staleRequest;

      expect(client.emit).toHaveBeenCalledWith(
        'social_content_invalidated',
        {}
      );
      expect(client.emit).not.toHaveBeenCalledWith('feed', [previouslyVisible]);

      await gateway.handleGetFeed({ profileId: 'reader' }, client);
      expect(client.emit).toHaveBeenCalledWith('feed', freshAuthorizedFeed);
      expect(client.emit).not.toHaveBeenCalledWith('feed', [previouslyVisible]);
    });
  });

  describe('handleSubscribePosts', () => {
    it('should subscribe client to specific posts', async () => {
      const mockClient: any = {
        emit: jest.fn(),
      };

      const payload = { profileId: 'user123', postIds: ['post1', 'post2'] };
      mockSocialClient.send.mockReturnValue(of({ id: 'post1' }));

      await gateway.handleSubscribePosts(payload, mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('subscribed', {
        type: 'posts',
        postIds: ['post1', 'post2'],
      });
    });

    it('should subscribe client to all posts when no postIds provided', async () => {
      const mockClient: any = {
        emit: jest.fn(),
      };

      const payload = { profileId: 'user123' };

      await gateway.handleSubscribePosts(payload, mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('subscribed', {
        type: 'posts',
        postIds: ['all'],
      });
    });
  });

  describe('broadcastPostCreated', () => {
    it('authorizes each subscriber before broadcasting post content', async () => {
      const client: any = { emit: jest.fn() };
      await gateway.handleSubscribePosts({ profileId: 'user123' }, client);
      const post = { id: 'post123', content: 'New post' };
      mockSocialClient.send.mockReturnValue(of(post));
      await gateway.broadcastPostCreated(post);
      expect(client.emit).toHaveBeenCalledWith('post_created', post);
    });

    it('sends only a content-free invalidation when scoped post lookup denies access', async () => {
      const client: any = { emit: jest.fn() };
      await gateway.handleSubscribePosts({ profileId: 'outsider' }, client);
      mockSocialClient.send.mockReturnValue(of(null));
      await gateway.broadcastPostCreated({
        id: 'private-post',
        content: 'secret',
      });
      expect(client.emit).not.toHaveBeenCalledWith(
        'post_created',
        expect.anything()
      );
      expect(client.emit).toHaveBeenCalledWith(
        'social_content_invalidated',
        {}
      );
      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: PostCommands.FIND },
        { id: 'private-post', viewerProfileId: 'outsider' }
      );
    });

    it('does not acknowledge an unauthorized requested post id', async () => {
      const client: any = { emit: jest.fn() };
      mockSocialClient.send.mockReturnValue(of(null));
      await gateway.handleSubscribePosts(
        { profileId: 'outsider', postIds: ['private-post'] },
        client
      );
      expect(client.emit).toHaveBeenCalledWith('subscribed', {
        type: 'posts',
        postIds: [],
      });
      expect(client.emit).not.toHaveBeenCalledWith('subscribed', {
        type: 'posts',
        postIds: ['private-post'],
      });
    });

    it('does not acknowledge a requested id when the authorization lookup times out', async () => {
      jest.useFakeTimers();
      try {
        const client: any = { emit: jest.fn() };
        mockSocialClient.send.mockReturnValue(NEVER);
        const pending = gateway.handleSubscribePosts(
          { profileId: 'outsider', postIds: ['private-post'] },
          client
        );
        await jest.advanceTimersByTimeAsync(3000);
        await pending;
        expect(client.emit).toHaveBeenCalledWith('subscribed', {
          type: 'posts',
          postIds: [],
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('sends a post only to recipients whose scoped lookup returns it', async () => {
      const member: any = { emit: jest.fn() };
      const outsider: any = { emit: jest.fn() };
      await gateway.handleSubscribePosts({ profileId: 'member' }, member);
      await gateway.handleSubscribePosts({ profileId: 'outsider' }, outsider);
      const post = { id: 'private-post', content: 'private' };
      mockSocialClient.send.mockImplementation((_pattern, payload) =>
        of(payload.viewerProfileId === 'member' ? post : null)
      );
      await gateway.broadcastPostCreated(post);
      expect(member.emit).toHaveBeenCalledWith('post_created', post);
      expect(outsider.emit).not.toHaveBeenCalledWith(
        'post_created',
        expect.anything()
      );
      expect(outsider.emit).toHaveBeenCalledWith(
        'social_content_invalidated',
        {}
      );
    });

    it('fails closed when a scoped lookup errors', async () => {
      const client: any = { emit: jest.fn() };
      await gateway.handleSubscribePosts({ profileId: 'member' }, client);
      mockSocialClient.send.mockReturnValue(
        throwError(() => new Error('offline'))
      );
      await gateway.broadcastPostCreated({ id: 'post1', content: 'secret' });
      expect(client.emit).not.toHaveBeenCalledWith(
        'post_created',
        expect.anything()
      );
      expect(client.emit).toHaveBeenCalledWith(
        'social_content_invalidated',
        {}
      );
    });

    it('invalidates every socket when two tabs share a profile', async () => {
      const firstTab: any = { emit: jest.fn() };
      const secondTab: any = { emit: jest.fn() };
      await gateway.handleSubscribePosts({ profileId: 'member' }, firstTab);
      await gateway.handleSubscribePosts({ profileId: 'member' }, secondTab);
      await gateway.broadcastSocialContentInvalidated();
      expect(firstTab.emit).toHaveBeenCalledWith(
        'social_content_invalidated',
        {}
      );
      expect(secondTab.emit).toHaveBeenCalledWith(
        'social_content_invalidated',
        {}
      );
    });
  });

  describe('subscriptions and broadcasts', () => {
    it('broadcasts updates to specific post subscribers', async () => {
      const client: any = { emit: jest.fn() };
      mockSocialClient.send.mockReturnValue(of({ id: 'post42' }));
      await gateway.handleSubscribePosts(
        { profileId: 'user123', postIds: ['post42'] },
        client
      );
      await gateway.broadcastPostUpdated({ id: 'post42' });
      expect(client.emit).toHaveBeenCalledWith(
        'post_updated',
        expect.objectContaining({ id: 'post42' })
      );
      client.emit.mockClear();
      await gateway.broadcastPostDeleted('post42');
      expect(client.emit).toHaveBeenCalledWith(
        'social_content_invalidated',
        {}
      );
    });

    it('authorizes the parent before broadcasting comment or vote metadata', async () => {
      const client: any = { emit: jest.fn() };
      mockSocialClient.send.mockReturnValue(of({ id: 'restricted' }));
      await gateway.handleSubscribePosts(
        { profileId: 'outsider', postIds: ['restricted'] },
        client
      );
      client.emit.mockClear();
      mockSocialClient.send.mockReturnValue(of(null));
      await gateway.broadcastCommentCreated({
        id: 'comment1',
        postId: 'restricted',
        content: 'secret',
      });
      await gateway.broadcastVoteUpdated({
        id: 'vote1',
        postId: 'restricted',
        profileId: 'author',
      });
      expect(client.emit).not.toHaveBeenCalledWith(
        'comment_created',
        expect.anything()
      );
      expect(client.emit).not.toHaveBeenCalledWith(
        'vote_updated',
        expect.anything()
      );
      expect(client.emit).toHaveBeenCalledWith(
        'social_content_invalidated',
        {}
      );
    });

    it('resolves relation-only parent ids and invalidates when a mutation has no parent', async () => {
      const client: any = { emit: jest.fn() };
      mockSocialClient.send.mockReturnValue(of({ id: 'relation-parent' }));
      await gateway.handleSubscribePosts(
        { profileId: 'member', postIds: ['relation-parent'] },
        client
      );
      client.emit.mockClear();
      await gateway.broadcastCommentCreated({
        id: 'comment-relation',
        post: { id: 'relation-parent' },
        content: 'visible to authorized member',
      });
      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: PostCommands.FIND },
        { id: 'relation-parent', viewerProfileId: 'member' }
      );
      expect(client.emit).toHaveBeenCalledWith(
        'comment_created',
        expect.objectContaining({ id: 'comment-relation' })
      );

      client.emit.mockClear();
      mockSocialClient.send.mockClear();
      await gateway.broadcastVoteUpdated({ id: 'orphan-vote' });
      expect(mockSocialClient.send).not.toHaveBeenCalledWith(
        { cmd: PostCommands.FIND },
        expect.objectContaining({ id: undefined })
      );
      expect(client.emit).toHaveBeenCalledWith(
        'social_content_invalidated',
        {}
      );
    });

    it('broadcasts user follow events', async () => {
      const client: any = { emit: jest.fn() };
      await gateway.handleSubscribeUserActivity(
        { profileId: 'user123' },
        client
      );
      await gateway.broadcastFollowEvent('user123', 'other', 'follow');
      expect(client.emit).toHaveBeenCalledWith(
        'user_follow',
        expect.objectContaining({ followerId: 'user123' })
      );
    });
  });

  describe('unsubscriptions', () => {
    it('unsubscribes from specific posts', async () => {
      const client: any = { emit: jest.fn() };
      mockSocialClient.send.mockReturnValue(of({ id: 'p1' }));
      await gateway.handleSubscribePosts(
        { profileId: 'user123', postIds: ['p1', 'p2'] },
        client
      );
      client.emit.mockClear();
      await gateway.handleUnsubscribePosts(
        { profileId: 'user123', postIds: ['p1'] },
        client
      );
      expect(client.emit).toHaveBeenCalledWith('unsubscribed', {
        type: 'posts',
        postIds: ['p1'],
      });
    });

    it('unsubscribes from all posts', async () => {
      const client: any = { emit: jest.fn() };
      await gateway.handleSubscribePosts({ profileId: 'user123' }, client);
      client.emit.mockClear();
      await gateway.handleUnsubscribePosts({ profileId: 'user123' }, client);
      expect(client.emit).toHaveBeenCalledWith('unsubscribed', {
        type: 'posts',
        postIds: ['all'],
      });
    });

    it('unsubscribes from user activity', async () => {
      const client: any = { emit: jest.fn() };
      await gateway.handleSubscribeUserActivity(
        { profileId: 'user123', targetUserIds: ['other'] },
        client
      );
      client.emit.mockClear();
      await gateway.handleUnsubscribeUserActivity(
        { profileId: 'user123', targetUserIds: ['other'] },
        client
      );
      expect(client.emit).toHaveBeenCalledWith('unsubscribed', {
        type: 'user_activity',
        userIds: ['other'],
      });
    });
  });

  describe('followers/following', () => {
    it('emits following list', async () => {
      const client: any = { emit: jest.fn() };
      mockSocialClient.send.mockReturnValue(of(['a']));
      await gateway.handleGetFollowing({ profileId: 'u1' }, client);
      expect(client.emit).toHaveBeenCalledWith('following', ['a']);
    });

    it('emits error when following fetch fails', async () => {
      const client: any = { emit: jest.fn() };
      mockSocialClient.send.mockReturnValue(throwError(() => new Error('x')));
      await gateway.handleGetFollowing({ profileId: 'u1' }, client);
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Failed to fetch following',
      });
    });

    it('emits followers list', async () => {
      const client: any = { emit: jest.fn() };
      mockSocialClient.send.mockReturnValue(of(['a']));
      await gateway.handleGetFollowers({ profileId: 'u1' }, client);
      expect(client.emit).toHaveBeenCalledWith('followers', ['a']);
    });

    it('emits error when followers fetch fails', async () => {
      const client: any = { emit: jest.fn() };
      mockSocialClient.send.mockReturnValue(throwError(() => new Error('x')));
      await gateway.handleGetFollowers({ profileId: 'u1' }, client);
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Failed to fetch followers',
      });
    });
  });

  describe('handleDisconnect', () => {
    it('should remove client on disconnect', async () => {
      const mockClient: any = {
        emit: jest.fn(),
      };

      // First register a client
      const payload = { profileId: 'user123' };
      await gateway.handleSubscribePosts(payload, mockClient);

      // Then disconnect - should not throw
      expect(() => gateway.handleDisconnect(mockClient)).not.toThrow();
    });

    it('should handle disconnect of unregistered client gracefully', () => {
      const mockClient: any = {
        emit: jest.fn(),
      };

      // Disconnect a client that was never registered
      expect(() => gateway.handleDisconnect(mockClient)).not.toThrow();
    });
  });
});
