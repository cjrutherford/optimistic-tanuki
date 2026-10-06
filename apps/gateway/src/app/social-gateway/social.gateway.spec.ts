import { Test, TestingModule } from '@nestjs/testing';
import { SocialGateway } from './social.gateway';
import { PostCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { throwError, of, NEVER } from 'rxjs';
import { SocketSessionAuthService } from '../../auth/socket-session-auth.service';

describe('SocialGateway', () => {
  let gateway: SocialGateway;
  let mockSocialClient: any;

  beforeEach(async () => {
    mockSocialClient = {
      send: jest.fn().mockReturnValue(of([])),
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
          useValue: {
            authenticate: jest.fn(),
            assertProfile: jest.fn((_client: unknown, profileId: string) => ({
              userId: 'user-id',
              profileId,
            })),
          },
        },
      ],
    }).compile();

    gateway = module.get<SocialGateway>(SocialGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
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
      gateway.broadcastSocialContentInvalidated();
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
      gateway.broadcastFollowEvent('user123', 'other', 'follow');
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
