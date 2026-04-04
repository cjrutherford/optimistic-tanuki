import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  NotificationBellComponent,
  NotificationListComponent,
  type Notification,
} from '@optimistic-tanuki/notification-ui';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

@Component({
  selector: 'pg-notification-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    NotificationBellComponent,
    NotificationListComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/notification-ui"
      title="Notification UI"
      description="Notification components for alerts, bells, and notification lists."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card [element]="el" [config]="configs[el.id]">
        @switch (el.id) { @case ('notification-bell') {
        <div class="preview-centered">
          <notif-notification-bell
            [notifications]="notificationsSignal"
            [unreadCount]="unreadCount"
          />
        </div>
        } @case ('notification-list') {
        <div class="preview-list">
          <notif-notification-list
            [notifications]="notificationsSignal"
            [unreadCount]="unreadCount"
          />
        </div>
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-centered {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
      }

      .preview-list {
        min-height: 300px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationUiPageComponent {
  readonly importSnippet = `import { NotificationBellComponent, NotificationListComponent } from '@optimistic-tanuki/notification-ui';`;
  configs: Record<string, ElementConfig> = {};
  readonly notifications: Notification[] = [
    {
      id: 'notif-1',
      recipientId: 'demo-profile',
      type: 'comment',
      title: 'New comment',
      body: 'commented on your playground documentation post.',
      senderId: 'peer-profile',
      senderName: 'Mika Vale',
      senderAvatar: 'https://placehold.co/96x96/334155/e2e8f0?text=MV',
      isRead: false,
      createdAt: new Date('2026-04-03T12:05:00Z'),
    },
    {
      id: 'notif-2',
      recipientId: 'demo-profile',
      type: 'follow',
      title: 'New follower',
      body: 'started following your design system experiments.',
      senderId: 'author-profile',
      senderName: 'Ari Stone',
      senderAvatar: 'https://placehold.co/96x96/0f172a/e2e8f0?text=AS',
      isRead: true,
      createdAt: new Date('2026-04-03T10:15:00Z'),
    },
  ];
  readonly notificationsSignal = signal(this.notifications);
  readonly unreadCount = signal(
    this.notifications.filter((notification) => !notification.isRead).length
  );

  readonly elements: PlaygroundElement[] = [
    {
      id: 'notification-bell',
      title: 'Notification Bell',
      headline: 'Bell with count badge',
      importName: 'NotificationBellComponent',
      selector: 'notif-notification-bell',
      summary: 'Notification bell icon with unread count badge.',
      props: [],
    },
    {
      id: 'notification-list',
      title: 'Notification List',
      headline: 'Inbox-style notification feed',
      importName: 'NotificationListComponent',
      selector: 'notif-notification-list',
      summary: 'Tabbed notification feed for all, unread, and activity categories.',
      props: [],
    },
  ];

  constructor() {
    for (const el of this.elements) {
      this.configs[el.id] = {};
    }
  }

  resetConfig(id: string): void {
    this.configs[id] = {};
  }
}
