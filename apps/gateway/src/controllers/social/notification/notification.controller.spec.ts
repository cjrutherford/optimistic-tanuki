import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { NotificationController } from './notification.controller';
import {
  ServiceTokens,
  NotificationCommands,
} from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../../auth/auth.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SocialGateway } from '../../../app/social-gateway/social.gateway';
import { ForbiddenException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { GatewayNotificationRecipientService } from './gateway-notification-recipient.service';

const accountId = '11111111-1111-4111-8111-111111111111';
const profileId = '22222222-2222-4222-8222-222222222222';

describe('NotificationController', () => {
  let controller: NotificationController;
  let mockSocialClient: { send: jest.Mock };
  let mockSocialGateway: { broadcastNotification: jest.Mock };

  beforeEach(async () => {
    mockSocialClient = {
      send: jest.fn(),
    };

    mockSocialGateway = {
      broadcastNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: ServiceTokens.SOCIAL_SERVICE,
          useValue: mockSocialClient,
        },
        {
          provide: SocialGateway,
          useValue: mockSocialGateway,
        },
        {
          provide: GatewayNotificationRecipientService,
          useValue: {
            assertSelected: jest.fn(async (user, requested) => {
              if (requested && requested !== user?.profileId) {
                throw new ForbiddenException();
              }
              return user?.profileId ?? profileId;
            }),
          },
        },
        {
          provide: AuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications', () => {
    it('should get notifications for a profile', async () => {
      const mockNotifications = [
        {
          id: '1',
          type: 'like',
          title: 'New Like',
          body: 'User liked your post',
          isRead: false,
        },
        {
          id: '2',
          type: 'comment',
          title: 'New Comment',
          body: 'User commented',
          isRead: true,
        },
      ];
      mockSocialClient.send.mockReturnValue(of(mockNotifications));

      const result = await controller.getNotifications(profileId, {
        userId: accountId,
        profileId,
      } as any);

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.FIND_BY_RECIPIENT },
        { recipientId: profileId }
      );
      expect(result).toEqual(mockNotifications);
    });

    it('should return empty array when no notifications', async () => {
      mockSocialClient.send.mockReturnValue(of([]));

      const result = await controller.getNotifications(profileId, {
        userId: accountId,
        profileId,
      } as any);

      expect(result).toEqual([]);
    });

    it('should reject cross-profile notification reads', async () => {
      await expect(
        controller.getNotifications('33333333-3333-4333-8333-333333333333', {
          userId: accountId,
          profileId,
        } as any)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockSocialClient.send).not.toHaveBeenCalled();
    });
  });

  it('forbids arbitrary notification creation without Social RPC or broadcast', async () => {
    await expect(
      controller.create({ recipientId: profileId } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockSocialClient.send).not.toHaveBeenCalled();
    expect(mockSocialGateway.broadcastNotification).not.toHaveBeenCalled();
  });

  it('forbids creation for the caller own recipient too', async () => {
    await expect(
      controller.create({ recipientId: profileId } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockSocialClient.send).not.toHaveBeenCalled();
    expect(mockSocialGateway.broadcastNotification).not.toHaveBeenCalled();
  });

  describe('getUnreadCount', () => {
    it('should get unread notification count', async () => {
      mockSocialClient.send.mockReturnValue(of({ count: 5 }));

      const result = await controller.getUnreadCount(profileId, {
        userId: accountId,
        profileId,
      } as any);

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.GET_UNREAD_COUNT },
        { recipientId: profileId }
      );
      expect(result).toEqual({ count: 5 });
    });

    it('should return zero when no unread notifications', async () => {
      mockSocialClient.send.mockReturnValue(of({ count: 0 }));

      const result = await controller.getUnreadCount(profileId, {
        userId: accountId,
        profileId,
      } as any);

      expect(result).toEqual({ count: 0 });
    });

    it('should reject cross-profile unread count reads', async () => {
      await expect(
        controller.getUnreadCount('33333333-3333-4333-8333-333333333333', {
          userId: accountId,
          profileId,
        } as any)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockSocialClient.send).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('always rejects arbitrary recipients without Social RPC or broadcast', async () => {
      await expect(
        controller.create({
          recipientId: '33333333-3333-4333-8333-333333333333',
        } as any)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockSocialClient.send).not.toHaveBeenCalled();
      expect(mockSocialGateway.broadcastNotification).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      mockSocialClient.send.mockReturnValue(of({ success: true }));

      await controller.markAsRead('33333333-3333-4333-8333-333333333333', {
        userId: accountId,
        profileId,
      } as any);

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.MARK_READ },
        { id: '33333333-3333-4333-8333-333333333333', recipientId: profileId }
      );
    });

    it('rejects malformed notification ids before sending a mutation', async () => {
      await expect(
        controller.markAsRead('notif-1', {
          userId: accountId,
          profileId,
        } as any)
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockSocialClient.send).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a profile', async () => {
      mockSocialClient.send.mockReturnValue(of({ success: true }));

      await controller.markAllAsRead(profileId, {
        userId: accountId,
        profileId,
      } as any);

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.MARK_ALL_READ },
        { recipientId: profileId }
      );
    });

    it('should reject cross-profile mark-all requests', async () => {
      await expect(
        controller.markAllAsRead('33333333-3333-4333-8333-333333333333', {
          userId: accountId,
          profileId,
        } as any)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockSocialClient.send).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a notification', async () => {
      mockSocialClient.send.mockReturnValue(of({ success: true }));

      await controller.delete('33333333-3333-4333-8333-333333333333', {
        userId: accountId,
        profileId,
      } as any);

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.DELETE },
        { id: '33333333-3333-4333-8333-333333333333', recipientId: profileId }
      );
    });

    it('rejects malformed notification ids before sending a mutation', async () => {
      await expect(
        controller.delete('notif-1', { userId: accountId, profileId } as any)
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockSocialClient.send).not.toHaveBeenCalled();
    });
  });
});
