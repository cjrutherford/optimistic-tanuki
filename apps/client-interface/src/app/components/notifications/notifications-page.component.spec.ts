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
});
