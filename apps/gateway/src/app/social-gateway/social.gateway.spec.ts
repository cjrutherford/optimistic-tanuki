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
    it('should broadcast post created event to subscribers', () => {
      const post = { id: 'post123', content: 'New post' };

      // This is a public method but relies on internal state
      // In a real scenario, we'd need to set up mock clients first
      // Just verify it doesn't throw
      expect(() => gateway.broadcastPostCreated(post)).not.toThrow();
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
