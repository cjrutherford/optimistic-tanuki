import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NotificationBellComponent } from './notification-bell.component';
import { Notification } from '../notification.model';

describe('NotificationBellComponent', () => {
  let component: NotificationBellComponent;
  let fixture: ComponentFixture<NotificationBellComponent>;

  const mockNotifications: Notification[] = [
    {
      id: '1',
      recipientId: 'user1',
      type: 'like',
      title: 'New Like',
      body: 'John liked your post',
      senderId: 'user2',
      senderName: 'John',
      senderAvatar: 'https://example.com/avatar.jpg',
      isRead: false,
      createdAt: new Date(),
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
      createdAt: new Date(),
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationBellComponent);
    component = fixture.componentInstance;
    component.notifications = signal(mockNotifications);
    component.unreadCount = signal(1);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with closed dropdown', () => {
    expect(component.isOpen()).toBe(false);
  });

  it('should toggle dropdown when toggleDropdown is called', () => {
    expect(component.isOpen()).toBe(false);

    component.toggleDropdown();
    expect(component.isOpen()).toBe(true);

    component.toggleDropdown();
    expect(component.isOpen()).toBe(false);
  });

  it('should emit notificationClick when notification is clicked', () => {
    const emitSpy = jest.spyOn(component.notificationClick, 'emit');
    const notification = mockNotifications[0];

    component.onNotificationClick(notification);

    expect(emitSpy).toHaveBeenCalledWith(notification);
  });

  describe('template rendering', () => {
    it('should render bell icon', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const icon = compiled.querySelector('.icon-button svg');
      expect(icon).toBeTruthy();
    });

    it('should show badge when unread count > 0', () => {
      component.unreadCount = signal(5);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const badge = compiled.querySelector('.badge');
      expect(badge).toBeTruthy();
      expect(badge?.textContent).toBe('5');
    });

    it('should show 99+ when unread count > 99', () => {
      component.unreadCount = signal(150);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const badge = compiled.querySelector('.badge');
      expect(badge?.textContent).toBe('99+');
    });

    it('should not show badge when unread count is 0', () => {
      component.unreadCount = signal(0);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const badge = compiled.querySelector('.badge');
      expect(badge).toBeFalsy();
    });

    it('should render dropdown when open', () => {
      component.isOpen.set(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const dropdown = compiled.querySelector('.notification-dropdown');
      expect(dropdown).toBeTruthy();
    });

    it('should render notification items in dropdown', () => {
      component.isOpen.set(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const items = compiled.querySelectorAll('.notification-item');
      expect(items.length).toBe(2);
    });

    it('should show unread indicator for unread notifications', () => {
      component.isOpen.set(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const unreadDots = compiled.querySelectorAll('.unread-dot');
      expect(unreadDots.length).toBe(1);
    });
  });
});
