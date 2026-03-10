import {
  Component,
  inject,
  signal,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'notif-notification-bell',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div class="notification-bell-wrapper">
      <otui-button class="icon-button" [variant]="'text'" (click)="toggleDropdown()">
        @if (unreadCount() > 0) {
        <span class="badge">{{
          unreadCount() > 99 ? '99+' : unreadCount()
        }}</span>
        }
        <svg
          class="icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      </otui-button>

      @if (isOpen()) {
      <div class="notification-dropdown">
        <div class="notification-header">
          <h3>Notifications</h3>
          @if (unreadCount() > 0) {
          <otui-button class="text-button" [variant]="'outlined'" (click)="onMarkAllRead.emit()">
            Mark all read
          </otui-button>
          }
        </div>

        <div class="notification-list">
          @for (notification of notifications(); track notification.id) {
          <otui-button
            class="notification-item"
            [class.unread]="!notification.isRead"
            [variant]="'outlined'"
            (click)="onNotificationClick(notification)"
          >
            @if (notification.senderAvatar) {
            <img
              [src]="notification.senderAvatar"
              class="notification-avatar"
              alt=""
            />
            } @else {
            <div class="notification-avatar-placeholder">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            }
            <div class="notification-content">
              <p class="notification-body">{{ notification.body }}</p>
              <span class="notification-time">{{
                notification.createdAt | date : 'shortTime'
              }}</span>
            </div>
            @if (!notification.isRead) {
            <span class="unread-dot"></span>
            }
          </otui-button>
          } @empty {
          <div class="empty-state">No notifications yet</div>
          }
        </div>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .notification-bell-wrapper {
        position: relative;
        display: inline-block;
      }
      .icon-button {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: none;
        background: transparent;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.2s;
      }
      .icon-button:hover {
        background: var(--hover-bg, rgba(0, 0, 0, 0.05));
      }
      .icon {
        width: 24px;
        height: 24px;
      }
      .badge {
        position: absolute;
        top: 0;
        right: 0;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 9px;
        background: #f44336;
        color: white;
        font-size: 10px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .notification-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        width: 360px;
        max-height: 480px;
        background: var(--surface, white);
        border: 1px solid var(--border, #e0e0e0);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        z-index: 1000;
      }
      .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border, #e0e0e0);
      }
      .notification-header h3 {
        margin: 0;
        font-size: 16px;
      }
      .text-button {
        border: none;
        background: transparent;
        color: var(--primary, #1976d2);
        cursor: pointer;
        font-size: 13px;
      }
      .text-button:hover {
        text-decoration: underline;
      }
      .notification-list {
        max-height: 400px;
        overflow-y: auto;
        min-width: 320px;
      }
      .notification-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .notification-item:hover {
        background: var(--hover-bg, rgba(0, 0, 0, 0.05));
      }
      .notification-item.unread {
        background: rgba(25, 118, 210, 0.05);
      }
      .notification-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
      }
      .notification-avatar-placeholder {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--muted, #9e9e9e);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .notification-avatar-placeholder svg {
        width: 20px;
        height: 20px;
        color: white;
      }
      .notification-content {
        flex: 1;
      }
      .notification-body {
        margin: 0 0 4px;
        font-size: 14px;
      }
      .notification-time {
        font-size: 12px;
        color: var(--muted, #757575);
      }
      .unread-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary, #1976d2);
        flex-shrink: 0;
      }
      .empty-state {
        padding: 24px;
        text-align: center;
        color: var(--muted, #757575);
      }
    `,
  ],
})
export class NotificationBellComponent {
  @Input() notifications = signal<any[]>([]);
  @Input() unreadCount = signal(0);
  @Output() notificationClick = new EventEmitter<any>();
  @Output() onMarkAllRead = new EventEmitter<void>();

  isOpen = signal(false);

  toggleDropdown(): void {
    this.isOpen.update((v) => !v);
  }

  onNotificationClick(notification: any): void {
    this.notificationClick.emit(notification);
  }
}
