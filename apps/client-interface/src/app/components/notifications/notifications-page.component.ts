import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  NotificationListComponent,
  NotificationService,
  Notification,
} from '@optimistic-tanuki/notification-ui';
import { ProfileService } from '../../profile.service';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule, NotificationListComponent],
  template: `
    <div class="notifications-page-container">
      <notif-notification-list
        [notifications]="notifications"
        [unreadCount]="unreadCount"
        (notificationClick)="onNotificationClick($event)"
        (markAllRead)="onMarkAllRead()"
      />
    </div>
  `,
  styles: [
    `
      .notifications-page-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px;
      }
    `,
  ],
})
export class NotificationsPageComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private profileService = inject(ProfileService);
  private router = inject(Router);

  notifications = signal<Notification[]>([]);
  unreadCount = signal(0);

  ngOnInit(): void {
    this.loadNotifications();
  }

  private loadNotifications(): void {
    const profile = this.profileService.getCurrentUserProfile();
    if (profile) {
      this.notificationService.loadNotifications(profile.id);

      // Subscribe to service signals
      this.notifications.set(this.notificationService.notifications());
      this.unreadCount.set(this.notificationService.unreadCount());

      // Set up effect to sync with service signals
      setInterval(() => {
        this.notifications.set(this.notificationService.notifications());
        this.unreadCount.set(this.notificationService.unreadCount());
      }, 100);
    }
  }

  onNotificationClick(notification: Notification): void {
    // Mark as read
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id).subscribe();
    }

    // Navigate to action URL if available
    if (notification.actionUrl) {
      this.router.navigate([notification.actionUrl]);
    }
  }

  onMarkAllRead(): void {
    const profile = this.profileService.getCurrentUserProfile();
    if (profile) {
      this.notificationService.markAllAsRead(profile.id).subscribe();
    }
  }
}
