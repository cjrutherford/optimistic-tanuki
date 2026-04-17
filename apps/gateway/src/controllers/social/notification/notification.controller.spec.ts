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

      const result = await controller.getNotifications('user1');

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.FIND_BY_RECIPIENT },
        { recipientId: 'user1' }
      );
      expect(result).toEqual(mockNotifications);
    });

    it('should return empty array when no notifications', async () => {
      mockSocialClient.send.mockReturnValue(of([]));

      const result = await controller.getNotifications('user1');

      expect(result).toEqual([]);
    });
  });

  describe('getUnreadCount', () => {
    it('should get unread notification count', async () => {
      mockSocialClient.send.mockReturnValue(of({ count: 5 }));

      const result = await controller.getUnreadCount('user1');

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.GET_UNREAD_COUNT },
        { recipientId: 'user1' }
      );
      expect(result).toEqual({ count: 5 });
    });

    it('should return zero when no unread notifications', async () => {
      mockSocialClient.send.mockReturnValue(of({ count: 0 }));

      const result = await controller.getUnreadCount('user1');

      expect(result).toEqual({ count: 0 });
    });
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const createDto = {
        recipientId: 'user1',
        type: 'like',
        title: 'New Like',
        body: 'User liked your post',
        senderId: 'user2',
        resourceType: 'post',
        resourceId: 'post1',
      };
      const createdNotification = { id: 'notif-1', ...createDto };
      mockSocialClient.send.mockReturnValue(of(createdNotification));

      const result = await controller.create(createDto);

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.CREATE },
        createDto
      );
      expect(result).toEqual(createdNotification);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      mockSocialClient.send.mockReturnValue(of({ success: true }));

      await controller.markAsRead('notif-1');

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.MARK_READ },
        { id: 'notif-1' }
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a profile', async () => {
      mockSocialClient.send.mockReturnValue(of({ success: true }));

      await controller.markAllAsRead('user1');

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.MARK_ALL_READ },
        { recipientId: 'user1' }
      );
    });
  });

  describe('delete', () => {
    it('should delete a notification', async () => {
      mockSocialClient.send.mockReturnValue(of({ success: true }));

      await controller.delete('notif-1');

      expect(mockSocialClient.send).toHaveBeenCalledWith(
        { cmd: NotificationCommands.DELETE },
        { id: 'notif-1' }
      );
    });
  });
});
