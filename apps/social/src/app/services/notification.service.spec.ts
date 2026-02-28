import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import {
  Notification,
  NotificationType,
} from '../../entities/notification.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: jest.Mocked<Repository<Notification>>;

  const mockNotificationRepo = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useFactory: mockNotificationRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepo = module.get(getRepositoryToken(Notification));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const createData = {
        recipientId: 'user1',
        type: 'like',
        title: 'New Like',
        body: 'User liked your post',
        senderId: 'user2',
        resourceType: 'post',
        resourceId: 'post1',
      };

      const notification = {
        id: 'notif-1',
        ...createData,
        type: NotificationType.LIKE,
        isRead: false,
        createdAt: new Date(),
      } as Notification;

      notificationRepo.create.mockReturnValue(notification);
      notificationRepo.save.mockResolvedValue(notification);

      const result = await service.create(createData);

      expect(notificationRepo.create).toHaveBeenCalledWith({
        ...createData,
        type: NotificationType.LIKE,
      });
      expect(notificationRepo.save).toHaveBeenCalledWith(notification);
      expect(result).toBe(notification);
    });

    it('should create notification with all optional fields', async () => {
      const createData = {
        recipientId: 'user1',
        type: 'comment',
        title: 'New Comment',
        body: 'User commented on your post',
        senderId: 'user2',
        resourceType: 'post',
        resourceId: 'post1',
        actionUrl: '/feed/post/post1',
      };

      const notification = {
        id: 'notif-1',
        ...createData,
        type: NotificationType.COMMENT,
        isRead: false,
        createdAt: new Date(),
      } as Notification;

      notificationRepo.create.mockReturnValue(notification);
      notificationRepo.save.mockResolvedValue(notification);

      const result = await service.create(createData);

      expect(notificationRepo.create).toHaveBeenCalledWith({
        ...createData,
        type: NotificationType.COMMENT,
      });
      expect(result).toBe(notification);
    });
  });

  describe('findByRecipient', () => {
    it('should return notifications for recipient ordered by date', async () => {
      const notifications = [
        { id: '1', recipientId: 'user1' },
        { id: '2', recipientId: 'user1' },
      ] as Notification[];

      notificationRepo.find.mockResolvedValue(notifications);

      const result = await service.findByRecipient('user1');

      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: { recipientId: 'user1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(notifications);
    });

    it('should return empty array when no notifications', async () => {
      notificationRepo.find.mockResolvedValue([]);

      const result = await service.findByRecipient('user1');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return notification by id', async () => {
      const notification = { id: 'notif-1' } as Notification;
      notificationRepo.findOne.mockResolvedValue(notification);

      const result = await service.findOne('notif-1');

      expect(notificationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });
      expect(result).toBe(notification);
    });

    it('should return null when notification not found', async () => {
      notificationRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('notif-1');

      expect(result).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      notificationRepo.update.mockResolvedValue({} as any);

      await service.markAsRead('notif-1');

      expect(notificationRepo.update).toHaveBeenCalledWith('notif-1', {
        isRead: true,
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for recipient', async () => {
      notificationRepo.update.mockResolvedValue({} as any);

      await service.markAllAsRead('user1');

      expect(notificationRepo.update).toHaveBeenCalledWith(
        { recipientId: 'user1', isRead: false },
        { isRead: true }
      );
    });
  });

  describe('delete', () => {
    it('should delete notification', async () => {
      notificationRepo.delete.mockResolvedValue({} as any);

      await service.delete('notif-1');

      expect(notificationRepo.delete).toHaveBeenCalledWith('notif-1');
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      notificationRepo.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user1');

      expect(notificationRepo.count).toHaveBeenCalledWith({
        where: { recipientId: 'user1', isRead: false },
      });
      expect(result).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      notificationRepo.count.mockResolvedValue(0);

      const result = await service.getUnreadCount('user1');

      expect(result).toBe(0);
    });
  });

  describe('getUnreadCountByRecipient', () => {
    it('should return count object', async () => {
      notificationRepo.count.mockResolvedValue(3);

      const result = await service.getUnreadCountByRecipient('user1');

      expect(result).toEqual({ count: 3 });
    });
  });
});
