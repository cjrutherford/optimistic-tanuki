import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { NotificationService } from './notification.service';
import { Notification } from './notification.model';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;

  const mockNotification: Notification = {
    id: '1',
    recipientId: 'user1',
    type: 'like',
    title: 'New Like',
    body: 'User liked your post',
    senderId: 'user2',
    senderName: 'John Doe',
    resourceType: 'post',
    resourceId: 'post1',
    isRead: false,
    actionUrl: '/feed/post/post1',
    createdAt: new Date(),
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NotificationService],
    });
    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have empty notifications initially', () => {
    expect(service.notifications()).toEqual([]);
  });

  it('should have zero unread count initially', () => {
    expect(service.unreadCount()).toBe(0);
  });

  describe('loadNotifications', () => {
    it('should load notifications and update signals', () => {
      const notifications = [
        mockNotification,
        { ...mockNotification, id: '2', isRead: true },
      ];

      service.loadNotifications('user1');

      const req = httpMock.expectOne('/api/notifications/user1');
      req.flush(notifications);

      expect(service.notifications()).toEqual(notifications);
      expect(service.unreadCount()).toBe(1);
    });

    it('should handle error gracefully', () => {
      service.loadNotifications('user1');

      const req = httpMock.expectOne('/api/notifications/user1');
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      expect(service.notifications()).toEqual([]);
    });
  });

  describe('getNotifications', () => {
    it('should return observable of notifications', () => {
      const notifications = [mockNotification];

      service.getNotifications('user1').subscribe((result) => {
        expect(result).toEqual(notifications);
      });

      const req = httpMock.expectOne('/api/notifications/user1');
      req.flush(notifications);
    });
  });

  describe('getUnreadCount', () => {
    it('should return observable of unread count', () => {
      service.getUnreadCount('user1').subscribe((result) => {
        expect(result).toEqual({ count: 5 });
      });

      const req = httpMock.expectOne('/api/notifications/user1/unread-count');
      req.flush({ count: 5 });
    });
  });

  describe('markAsRead', () => {
    it('should update notification to read and decrement count', () => {
      service.notifications.set([mockNotification]);
      service.unreadCount.set(1);

      service.markAsRead('1').subscribe();

      const req = httpMock.expectOne('/api/notifications/1/read');
      req.flush({});

      expect(service.notifications()[0].isRead).toBe(true);
      expect(service.unreadCount()).toBe(0);
    });

    it('should not decrement count below zero', () => {
      service.notifications.set([{ ...mockNotification, isRead: true }]);
      service.unreadCount.set(0);

      service.markAsRead('1').subscribe();

      const req = httpMock.expectOne('/api/notifications/1/read');
      req.flush({});

      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read and reset count', () => {
      service.notifications.set([
        mockNotification,
        { ...mockNotification, id: '2' },
      ]);
      service.unreadCount.set(2);

      service.markAllAsRead('user1').subscribe();

      const req = httpMock.expectOne('/api/notifications/user1/read-all');
      req.flush({});

      expect(service.notifications().every((n) => n.isRead)).toBe(true);
      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should remove notification from list and decrement count if unread', () => {
      service.notifications.set([
        mockNotification,
        { ...mockNotification, id: '2' },
      ]);
      service.unreadCount.set(1);

      service.deleteNotification('1').subscribe();

      const req = httpMock.expectOne('/api/notifications/1');
      req.flush({});

      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].id).toBe('2');
      expect(service.unreadCount()).toBe(0);
    });

    it('should not decrement count if notification was already read', () => {
      service.notifications.set([{ ...mockNotification, isRead: true }]);
      service.unreadCount.set(0);

      service.deleteNotification('1').subscribe();

      const req = httpMock.expectOne('/api/notifications/1');
      req.flush({});

      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('createNotification', () => {
    it('should post notification data', () => {
      const newNotification: Partial<Notification> = {
        recipientId: 'user1',
        type: 'comment',
        title: 'New Comment',
        body: 'User commented on your post',
      };

      service.createNotification(newNotification as any).subscribe((result) => {
        expect(result).toEqual(mockNotification);
      });

      const req = httpMock.expectOne('/api/notifications');
      req.flush(mockNotification);
    });
  });

  describe('newNotification$', () => {
    it('should emit new notification', (done) => {
      service.newNotification$.subscribe((notification) => {
        expect(notification).toEqual(mockNotification);
        done();
      });

      service['notificationSubject'].next(mockNotification);
    });
  });
});
