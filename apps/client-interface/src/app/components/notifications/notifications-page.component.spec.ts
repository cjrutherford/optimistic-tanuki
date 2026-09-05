import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { NotificationsPageComponent } from './notifications-page.component';
import { ProfileService } from '../../profile.service';
import { NotificationService } from '@optimistic-tanuki/notification-ui';

describe('NotificationsPageComponent', () => {
  let fixture: ComponentFixture<NotificationsPageComponent>;

  const profileServiceMock = {
    getCurrentUserProfile: jest.fn().mockReturnValue({ id: 'profile-1' }),
  };

  const notificationState = signal([]);
  const unreadCountState = signal(0);
  const notificationServiceMock = {
    loadNotifications: jest.fn(),
    notifications: notificationState,
    unreadCount: unreadCountState,
    markAsRead: jest.fn().mockReturnValue(of(undefined)),
    markAllAsRead: jest.fn().mockReturnValue(of(undefined)),
  };

  const routerMock = {
    navigate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profileServiceMock.getCurrentUserProfile.mockReturnValue({
      id: 'profile-1',
    });

    await TestBed.configureTestingModule({
      imports: [NotificationsPageComponent],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsPageComponent);
  });

  it('loads notifications for the current selected profile only', () => {
    fixture.detectChanges();

    expect(notificationServiceMock.loadNotifications).toHaveBeenCalledWith(
      'profile-1'
    );
  });

  it('does not load notifications without a selected profile', () => {
    profileServiceMock.getCurrentUserProfile.mockReturnValue(null);

    fixture.detectChanges();

    expect(notificationServiceMock.loadNotifications).not.toHaveBeenCalled();
  });

  it('marks an unread notification read and follows its action url', () => {
    fixture.detectChanges();

    fixture.componentInstance.onNotificationClick({
      id: 'n1',
      isRead: false,
      actionUrl: '/feed/post/1',
    } as never);

    expect(notificationServiceMock.markAsRead).toHaveBeenCalledWith('n1');
    expect(routerMock.navigate).toHaveBeenCalledWith(['/feed/post/1']);
  });

  it('leaves an already read notification alone and stays put without an action url', () => {
    fixture.detectChanges();

    fixture.componentInstance.onNotificationClick({
      id: 'n1',
      isRead: true,
    } as never);

    expect(notificationServiceMock.markAsRead).not.toHaveBeenCalled();
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });

  it('marks everything read for the selected profile', () => {
    fixture.detectChanges();

    fixture.componentInstance.onMarkAllRead();

    expect(notificationServiceMock.markAllAsRead).toHaveBeenCalledWith(
      'profile-1'
    );
  });

  it('does not mark everything read without a selected profile', () => {
    profileServiceMock.getCurrentUserProfile.mockReturnValue(null);
    fixture.detectChanges();

    fixture.componentInstance.onMarkAllRead();

    expect(notificationServiceMock.markAllAsRead).not.toHaveBeenCalled();
  });
});
