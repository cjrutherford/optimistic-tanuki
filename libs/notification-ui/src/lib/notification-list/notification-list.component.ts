import {
  Component,
  inject,
  signal,
  Input,
  Output,
  EventEmitter,
  input
} from '@angular/core';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { CommonModule } from '@angular/common';

export interface NotificationTab {
  id: string;
  label: string;
}

@Component({
  selector: 'notif-notification-list',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div class="notifications-page">
      <div class="page-header">
        <h1>Notifications</h1>
        @if (unreadCount() > 0) {
        <button class="mark-all-btn" (click)="onMarkAllRead.emit()">
          Mark all as read
        </button>
        }
      </div>

      <div class="tabs">
        @for (tab of tabs(); track tab.id) {
        <button
          class="tab"
          [class.active]="activeTab() === tab.id"
          (click)="selectTab(tab.id)"
        >
          {{ tab.label }}
          @if (tab.id === 'all' && unreadCount() > 0) {
          <span class="tab-badge">{{ unreadCount() }}</span>
          }
        </button>
        }
      </div>

      <div class="notification-list">
        @for (notification of filteredNotifications(); track notification.id) {
        <otui-button
          class="notification-card"
          [class.unread]="!notification.isRead"
          (click)="notificationClick.emit(notification)"
        >
          <div class="notification-icon" [class]="notification.type">
            @switch (notification.type) { @case ('like') {
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
            } @case ('comment') {
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              ></path>
            </svg>
            } @case ('follow') {
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            } @case ('mention') {
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
            </svg>
            } @default {
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            </svg>
            } }
          </div>

          @if (notification.senderAvatar) {
          <img [src]="notification.senderAvatar" class="avatar" alt="" />
          } @else {
          <div class="avatar-placeholder">
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
            <p class="notification-body">
              @if (notification.senderName) {
              <strong>{{ notification.senderName }}</strong>
              }
              {{ notification.body }}
            </p>
            <span class="notification-time">{{
              notification.createdAt | date : 'short'
            }}</span>
          </div>

          @if (!notification.isRead) {
          <span class="unread-indicator"></span>
          }
        </otui-button>
        } @empty {
        <div class="empty-state">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <p>No notifications yet</p>
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .notifications-page {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }
      .page-header h1 {
        margin: 0;
        font-size: 28px;
      }
      .mark-all-btn {
        padding: 8px 16px;
        border: 1px solid var(--border, #e0e0e0);
        border-radius: 8px;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
      }
      .mark-all-btn:hover {
        background: var(--hover-bg, rgba(0, 0, 0, 0.05));
      }
      .tabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--border, #e0e0e0);
        margin-bottom: 16px;
      }
      .tab {
        padding: 12px 20px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: var(--muted, #757575);
        position: relative;
      }
      .tab:hover {
        color: var(--foreground, #212121);
      }
      .tab.active {
        color: var(--primary, #1976d2);
      }
      .tab.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--primary, #1976d2);
      }
      .tab-badge {
        margin-left: 6px;
        padding: 2px 6px;
        border-radius: 10px;
        background: var(--primary, #1976d2);
        color: white;
        font-size: 11px;
      }
      .notification-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .notification-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: var(--surface, white);
        border: 1px solid var(--border, #e0e0e0);
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .notification-card:hover {
        background: var(--hover-bg, rgba(0, 0, 0, 0.03));
      }
      .notification-card.unread {
        background: rgba(25, 118, 210, 0.03);
      }
      .notification-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .notification-icon svg {
        width: 18px;
        height: 18px;
      }
      .notification-icon.like {
        background: #ffebee;
        color: #f44336;
      }
      .notification-icon.comment {
        background: #e8f5e9;
        color: #4caf50;
      }
      .notification-icon.follow {
        background: #f3e5f5;
        color: #9c27b0;
      }
      .notification-icon.mention {
        background: #fff3e0;
        color: #ff9800;
      }
      .notification-icon.message {
        background: #e3f2fd;
        color: #2196f3;
      }
      .avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        object-fit: cover;
      }
      .avatar-placeholder {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--muted, #9e9e9e);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .avatar-placeholder svg {
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
      .notification-body strong {
        font-weight: 600;
      }
      .notification-time {
        font-size: 12px;
        color: var(--muted, #757575);
      }
      .unread-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary, #1976d2);
        flex-shrink: 0;
      }
      .empty-state {
        padding: 48px;
        text-align: center;
        color: var(--muted, #757575);
      }
      .empty-state svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
      }
      .empty-state p {
        margin: 0;
      }
    `,
  ],
})
export class NotificationListComponent {
  readonly notifications = input(signal<any[]>([]));
  @Input() unreadCount = signal(0);
  @Output() notificationClick = new EventEmitter<any>();
  @Output() onMarkAllRead = new EventEmitter<void>();

  activeTab = signal('all');

  tabs = signal<NotificationTab[]>([
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'like', label: 'Likes' },
    { id: 'comment', label: 'Comments' },
    { id: 'follow', label: 'Follows' },
  ]);

  filteredNotifications = signal<any[]>([]);

  ngOnInit(): void {
    this.filteredNotifications.set(this.notifications()());
  }

  ngOnChanges(): void {
    this.filterNotifications();
  }

  selectTab(tabId: string): void {
    this.activeTab.set(tabId);
    this.filterNotifications();
  }

  private filterNotifications(): void {
    const all = this.notifications()();
    const tab = this.activeTab();

    if (tab === 'all') {
      this.filteredNotifications.set(all);
    } else if (tab === 'unread') {
      this.filteredNotifications.set(all.filter((n) => !n.isRead));
    } else {
      this.filteredNotifications.set(all.filter((n) => n.type === tab));
    }
  }
}
