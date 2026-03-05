import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PrivacyService,
  BlockedUser,
  MutedUser,
  ContentReport,
} from '../../privacy.service';
import { ProfileService } from '../../profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div class="privacy-settings">
      <h2>Privacy & Safety</h2>

      <!-- Blocked Users -->
      <section class="settings-section">
        <h3>Blocked Users</h3>
        <p class="section-description">
          Blocked users cannot see your posts, follow you, or send you messages.
        </p>
        @if (blockedUsers().length > 0) {
        <div class="user-list">
          @for (user of blockedUsers(); track user.id) {
          <div class="list-item">
            <img
              class="item-avatar"
              [src]="user.blockedAvatar || '/assets/default-avatar.png'"
            />
            <div class="item-content">
              <span class="item-title">{{ user.blockedName }}</span>
              <span class="item-subtitle"
                >Blocked {{ user.createdAt | date : 'mediumDate' }}</span
              >
            </div>
            <otui-button variant="text" (click)="unblockUser(user.blockedId)">
              Unblock
            </otui-button>
          </div>
          }
        </div>
        } @else {
        <div class="empty-state">No blocked users</div>
        }
      </section>

      <!-- Muted Users -->
      <section class="settings-section">
        <h3>Muted Users</h3>
        <p class="section-description">
          Muted users' posts will be hidden from your feed but you can still see
          their messages.
        </p>
        @if (mutedUsers().length > 0) {
        <div class="user-list">
          @for (user of mutedUsers(); track user.id) {
          <div class="list-item">
            <div class="item-avatar-placeholder">
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
            <div class="item-content">
              <span class="item-title">{{ user.mutedName }}</span>
              <span class="item-subtitle">
                @if (user.expiresAt) { Muted until
                {{ user.expiresAt | date : 'medium' }}
                } @else { Muted indefinitely }
              </span>
            </div>
            <otui-button variant="text" (click)="unmuteUser(user.mutedId)">
              Unmute
            </otui-button>
          </div>
          }
        </div>
        } @else {
        <div class="empty-state">No muted users</div>
        }
      </section>

      <!-- Reports -->
      <section class="settings-section">
        <h3>My Reports</h3>
        <p class="section-description">
          Track the status of content you've reported.
        </p>
        @if (reports().length > 0) {
        <div class="user-list">
          @for (report of reports(); track report.id) {
          <div class="list-item">
            <div class="item-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
                ></path>
                <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
            </div>
            <div class="item-content">
              <span class="item-title"
                >{{ report.contentType | titlecase }} Report</span
              >
              <span class="item-subtitle"
                >{{ report.reason }} -
                {{ report.createdAt | date : 'mediumDate' }}</span
              >
            </div>
            <span class="status-badge" [class]="'status-' + report.status">{{
              report.status
            }}</span>
          </div>
          }
        </div>
        } @else {
        <div class="empty-state">No reports submitted</div>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .privacy-settings {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px;
      }
      h2 {
        margin-bottom: 32px;
      }
      .settings-section {
        margin-bottom: 32px;
      }
      h3 {
        margin-bottom: 8px;
      }
      .section-description {
        color: var(--muted);
        margin-bottom: 16px;
        font-size: 14px;
      }
      .empty-state {
        padding: 24px;
        text-align: center;
        background: var(--hover-bg);
        border-radius: 8px;
        color: var(--muted);
      }
      .user-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .list-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
      }
      .item-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
      }
      .item-avatar-placeholder {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--hover-bg);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .item-avatar-placeholder svg {
        width: 20px;
        height: 20px;
        color: var(--muted);
      }
      .item-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--hover-bg);
        border-radius: 8px;
      }
      .item-icon svg {
        width: 20px;
        height: 20px;
        color: var(--muted);
      }
      .item-content {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .item-title {
        font-weight: 500;
        font-size: 14px;
      }
      .item-subtitle {
        font-size: 12px;
        color: var(--muted);
      }
      .status-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        text-transform: capitalize;
      }
      .status-pending {
        background: var(--warning-bg, #fff3cd);
        color: var(--warning, #856404);
      }
      .status-reviewed {
        background: var(--primary-bg, #e3f2fd);
        color: var(--primary, #1976d2);
      }
      .status-actioned {
        background: var(--success-bg, #d4edda);
        color: var(--success, #155724);
      }
      .status-dismissed {
        background: var(--secondary-bg, #f8f9fa);
        color: var(--secondary, #6c757d);
      }
    `,
  ],
})
export class PrivacySettingsComponent implements OnInit {
  private privacyService = inject(PrivacyService);
  private messageService = inject(MessageService);

  blockedUsers = signal<BlockedUser[]>([]);
  mutedUsers = signal<MutedUser[]>([]);
  reports = signal<ContentReport[]>([]);

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.privacyService.getBlockedUsers().subscribe({
      next: (users) => this.blockedUsers.set(users),
      error: () =>
        this.messageService.addMessage({
          content: 'Failed to load blocked users',
          type: 'error',
        }),
    });

    this.privacyService.getMutedUsers().subscribe({
      next: (users) => this.mutedUsers.set(users),
      error: () =>
        this.messageService.addMessage({
          content: 'Failed to load muted users',
          type: 'error',
        }),
    });

    this.privacyService.getMyReports().subscribe({
      next: (reports) => this.reports.set(reports),
      error: () =>
        this.messageService.addMessage({
          content: 'Failed to load reports',
          type: 'error',
        }),
    });
  }

  unblockUser(userId: string) {
    this.privacyService.unblockUser(userId).subscribe({
      next: () => {
        this.blockedUsers.update((users) =>
          users.filter((u) => u.blockedId !== userId)
        );
        this.messageService.addMessage({
          content: 'User unblocked',
          type: 'success',
        });
      },
      error: () =>
        this.messageService.addMessage({
          content: 'Failed to unblock user',
          type: 'error',
        }),
    });
  }

  unmuteUser(userId: string) {
    this.privacyService.unmuteUser(userId).subscribe({
      next: () => {
        this.mutedUsers.update((users) =>
          users.filter((u) => u.mutedId !== userId)
        );
        this.messageService.addMessage({
          content: 'User unmuted',
          type: 'success',
        });
      },
      error: () =>
        this.messageService.addMessage({
          content: 'Failed to unmute user',
          type: 'error',
        }),
    });
  }

  getStatusVariant(
    status: string
  ): 'primary' | 'secondary' | 'success' | 'warning' | 'error' {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'reviewed':
        return 'primary';
      case 'actioned':
        return 'success';
      case 'dismissed':
        return 'secondary';
      default:
        return 'primary';
    }
  }
}
