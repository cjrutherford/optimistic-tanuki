import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NotificationListComponent } from './notification-list.component';
import { Notification } from '../notification.model';

describe('NotificationListComponent', () => {
  let component: NotificationListComponent;
  let fixture: ComponentFixture<NotificationListComponent>;

  const mockNotifications: Notification[] = [
    {
      id: '1',
      recipientId: 'user1',
      type: 'like',
      title: 'New Like',
      body: 'John liked your post',
      senderId: 'user2',
      senderName: 'John',
      isRead: false,
      createdAt: new Date('2024-01-01T10:00:00'),
    },
    {
      id: '2',
      recipientId: 'user1',
      type: 'comment',
      title: 'New Comment',
      body: 'Jane commented on your post',
      senderId: 'user3',
      senderName: 'Jane',
      isRead: true,
      createdAt: new Date('2024-01-01T09:00:00'),
    },
    {
      id: '3',
      recipientId: 'user1',
      type: 'follow',
      title: 'New Follower',
      body: 'Mike started following you',
      senderId: 'user4',
      senderName: 'Mike',
      isRead: false,
      createdAt: new Date('2024-01-01T08:00:00'),
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('notifications', signal(mockNotifications));
    component.unreadCount = signal(2);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with all tab active', () => {
    expect(component.activeTab()).toBe('all');
  });

  it('should have default tabs defined', () => {
    const tabs = component.tabs();
    expect(tabs.length).toBe(5);
    expect(tabs.map((t) => t.id)).toEqual([
      'all',
      'unread',
      'like',
      'comment',
      'follow',
    ]);
  });

  it('should emit notificationClick when notification is clicked', () => {
    const emitSpy = jest.spyOn(component.notificationClick, 'emit');
    const notification = mockNotifications[0];

    component.notificationClick.emit(notification);

    expect(emitSpy).toHaveBeenCalledWith(notification);
  });

  it('should emit markAllRead when mark all read is clicked', () => {
    const emitSpy = jest.spyOn(component.markAllRead, 'emit');

    component.markAllRead.emit();

    expect(emitSpy).toHaveBeenCalled();
  });

  describe('tab filtering', () => {
    it('should filter by all tab', () => {
      component.activeTab.set('all');
      component.filteredNotifications.set(component.notifications()());

      const filtered = component.filteredNotifications();
      expect(filtered.length).toBe(3);
    });

    it('should filter by unread tab', () => {
      component.activeTab.set('unread');
      component.filteredNotifications.set(
        component
          .notifications()()
          .filter((n: any) => !n.isRead)
      );

      const filtered = component.filteredNotifications();
      expect(filtered.length).toBe(2);
      expect(filtered.every((n: any) => !n.isRead)).toBe(true);
    });

    it('should filter by type', () => {
      component.activeTab.set('like');
      component.filteredNotifications.set(
        component
          .notifications()()
          .filter((n: any) => n.type === 'like')
      );

      const filtered = component.filteredNotifications();
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe('like');
    });
  });

  describe('template rendering', () => {
    it('should render page header', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const header = compiled.querySelector('.page-header h1');
      expect(header?.textContent).toBe('Notifications');
    });

    it('should render tabs', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const tabs = compiled.querySelectorAll('.tab');
      expect(tabs.length).toBe(5);
    });

    it('should render notification cards', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const cards = compiled.querySelectorAll('.notification-card');
      expect(cards.length).toBe(3);
    });

    it('should show mark all read button when unread count > 0', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('.mark-all-btn');
      expect(button).toBeTruthy();
    });

    it('should not show mark all read button when all read', () => {
      component.unreadCount.set(0);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const button = compiled.querySelector('.mark-all-btn');
      expect(button).toBeFalsy();
    });

    it('should show unread indicator for unread notifications', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const indicators = compiled.querySelectorAll('.unread-indicator');
      expect(indicators.length).toBe(2);
    });

    it('should show notification type icons', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const likeIcons = compiled.querySelectorAll('.notification-icon.like');
      const commentIcons = compiled.querySelectorAll(
        '.notification-icon.comment'
      );
      const followIcons = compiled.querySelectorAll(
        '.notification-icon.follow'
      );

      expect(likeIcons.length).toBe(1);
      expect(commentIcons.length).toBe(1);
      expect(followIcons.length).toBe(1);
    });
  });
});
