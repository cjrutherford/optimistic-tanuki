import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DropdownComponent } from '@optimistic-tanuki/common-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

export interface ProfileInfo {
  id: string;
  profileName: string;
  profilePic?: string;
}

@Component({
  selector: 'app-toolbar-enhanced',
  standalone: true,
  imports: [CommonModule, RouterModule, DropdownComponent],
  template: `
    <header
      class="toolbar"
      [style.--toolbar-primary]="themeService.getCurrentTheme().primary"
    >
      <div class="toolbar-brand" routerLink="/feed">
        <svg class="logo" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
          />
        </svg>
        <span class="brand-name">SocialApp</span>
      </div>

      <div class="toolbar-search">
        <ng-content select="[toolbar-search]"></ng-content>
      </div>

      <div class="toolbar-actions">
        <ng-content select="[toolbar-actions]"></ng-content>

        <div class="icon-button-wrapper">
          <button class="icon-button" routerLink="/messages">
            @if (unreadMessages() > 0) {
            <span class="unread-badge">{{
              unreadMessages() > 9 ? '9+' : unreadMessages()
            }}</span>
            }
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
          </button>
        </div>

        <otui-dropdown [triggerLabel]="''">
          <button class="user-avatar-btn" dropdown-trigger>
            <img
              [src]="
                currentProfile()?.profilePic || '/assets/default-avatar.png'
              "
              class="avatar"
              alt="Profile"
            />
          </button>
          <div class="dropdown-menu">
            <a
              class="dropdown-item"
              routerLink="/profile/{{ currentProfile()?.id }}"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Profile
            </a>
            <a class="dropdown-item" routerLink="/activity">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Activity
            </a>
            <a class="dropdown-item" routerLink="/settings">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                ></path>
              </svg>
              Settings
            </a>
            <a class="dropdown-item" routerLink="/settings/privacy">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              Privacy
            </a>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item logout" (click)="logout()">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
          </div>
        </otui-dropdown>
      </div>
    </header>
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 16px;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .toolbar-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        .logo {
          font-size: 28px;
          width: 28px;
          height: 28px;
          color: var(--toolbar-primary, var(--primary));
        }
        .brand-name {
          font-size: 20px;
          font-weight: 700;
        }
      }
      .toolbar-search {
        flex: 1;
        max-width: 500px;
      }
      .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .icon-button-wrapper {
        position: relative;
      }
      .icon-button {
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
        position: relative;
        &:hover {
          background: var(--hover-bg);
        }
        svg {
          width: 20px;
          height: 20px;
        }
        .unread-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          background: #f44336;
          color: white;
          font-size: 10px;
          font-weight: 600;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
      .user-avatar-btn {
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }
      }
      .dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        min-width: 200px;
        margin-top: 8px;
        padding: 8px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
      }
      .dropdown-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border: none;
        background: transparent;
        border-radius: 6px;
        color: var(--foreground);
        font-size: 14px;
        text-decoration: none;
        cursor: pointer;
        width: 100%;
        transition: background 0.2s;
        &:hover {
          background: var(--hover-bg);
        }
        svg {
          width: 18px;
          height: 18px;
          color: var(--muted);
        }
        &.logout {
          color: var(--error);
          svg {
            color: var(--error);
          }
        }
      }
      .dropdown-divider {
        height: 1px;
        background: var(--border);
        margin: 8px 0;
      }
    `,
  ],
})
export class ToolbarEnhancedComponent implements OnDestroy {
  @Input() currentProfile: () => ProfileInfo | null = () => null;
  @Input() unreadMessages: () => number = () => 0;
  @Output() logoutEvent = new EventEmitter<void>();

  themeService = inject(ThemeService);

  logout() {
    this.logoutEvent.emit();
  }

  ngOnDestroy() {}
}
