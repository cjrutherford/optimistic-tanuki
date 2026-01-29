import { Test, TestingModule } from '@nestjs/testing';
import { SocialGateway } from './social.gateway';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { throwError, of } from 'rxjs';

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

      expect(mockSocialClient.send).toHaveBeenCalled();
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
    it('should broadcast post created event to subscribers', async () => {
      const client: any = { emit: jest.fn() };
      await gateway.handleSubscribePosts({ profileId: 'user123' }, client);
      const post = { id: 'post123', content: 'New post' };
      gateway.broadcastPostCreated(post);
      expect(client.emit).toHaveBeenCalledWith('post_created', post);
    });
  });

  describe('subscriptions and broadcasts', () => {
    it('broadcasts updates to specific post subscribers', async () => {
      const client: any = { emit: jest.fn() };
      await gateway.handleSubscribePosts(
        { profileId: 'user123', postIds: ['post42'] },
        client
      );
      gateway.broadcastPostUpdated({ id: 'post42' });
      expect(client.emit).toHaveBeenCalledWith(
        'post_updated',
        expect.objectContaining({ id: 'post42' })
      );
      client.emit.mockClear();
      gateway.broadcastPostDeleted('post42');
      expect(client.emit).toHaveBeenCalledWith('post_deleted', {
        postId: 'post42',
      });
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
