import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import {
  TabsComponent,
  ListComponent,
  ButtonComponent,
  CardComponent,
} from '@optimistic-tanuki/common-ui';
import {
  ActivityService,
  ActivityItem,
  SavedItem,
} from '../../activity.service';
import { ProfileService } from '../../profile.service';

@Component({
  selector: 'app-activity-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TabsComponent,
    ListComponent,
    ButtonComponent,
    CardComponent,
  ],
  template: `
    <div class="activity-page">
      <header class="page-header">
        <h1>Activity</h1>
        <p>Your posts, likes, comments, and more</p>
      </header>

      <otui-tabs
        [tabs]="tabOptions"
        [activeTab]="activeTab()"
        (tabChange)="onTabChange($event)"
      >
        <div class="activity-list">
          @for (activity of filteredActivities(); track activity.id) {
          <div class="activity-item" (click)="navigateTo(activity)">
            <div class="activity-icon" [class]="activity.type">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                @switch (activity.type) { @case ('post') {
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                ></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                } @case ('comment') {
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                ></path>
                } @case ('like') {
                <path
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                ></path>
                } @case ('follow') {
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
                } @case ('mention') {
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
                } @case ('share') {
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                } }
              </svg>
            </div>
            <div class="activity-content">
              <span class="activity-description">{{
                activity.description
              }}</span>
              <span class="activity-time">{{
                activity.createdAt | date : 'medium'
              }}</span>
            </div>
            <svg
              class="arrow-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
          } @empty {
          <div class="empty-state">No activity yet</div>
          }
        </div>

        <div class="saved-list">
          @for (item of savedItems(); track item.id) {
          <div class="saved-item" (click)="navigateToSaved(item)">
            <svg
              class="item-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
              ></path>
            </svg>
            <div class="item-content">
              <span class="item-title">{{
                item.itemTitle || 'Saved ' + item.itemType
              }}</span>
              <span class="item-time"
                >Saved {{ item.savedAt | date : 'mediumDate' }}</span
              >
            </div>
            <button class="icon-button" (click)="unsaveItem(item, $event)">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                ></path>
              </svg>
            </button>
          </div>
          } @empty {
          <div class="empty-state">No saved items</div>
          }
        </div>
      </otui-tabs>
    </div>
  `,
  styles: [
    `
      .activity-page {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px;
      }
      .page-header {
        margin-bottom: 24px;
        padding: 24px;
        border-radius: 24px;
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        border: 1px solid color-mix(in srgb, var(--border, var(--muted)) 80%, transparent);
        box-shadow: var(--shadow-card, 0 18px 40px rgba(15, 23, 42, 0.12));
        h1 {
          margin-bottom: 8px;
        }
        p {
          color: var(--muted);
        }
      }
      .activity-list {
        padding-top: 0;
        margin-top: 16px;
        border-radius: 24px;
        overflow: hidden;
        background: color-mix(in srgb, var(--surface) 94%, transparent);
        border: 1px solid color-mix(in srgb, var(--border, var(--muted)) 80%, transparent);
      }
      .activity-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border-bottom: 1px solid var(--border);
        cursor: pointer;
        transition: background 0.2s;
        &:hover {
          background: var(--hover-bg);
        }
      }
      .activity-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        background: color-mix(in srgb, var(--surface) 60%, var(--background));
        border: 1px solid color-mix(in srgb, var(--border, var(--muted)) 75%, transparent);
        svg {
          width: 20px;
          height: 20px;
        }
        &.post {
          color: color-mix(in srgb, var(--primary) 82%, white);
        }
        &.comment {
          color: color-mix(in srgb, var(--success, #22c55e) 82%, white);
        }
        &.like {
          color: color-mix(in srgb, var(--error, #ef4444) 82%, white);
        }
        &.follow {
          color: color-mix(in srgb, var(--secondary, var(--primary)) 82%, white);
        }
        &.mention {
          color: color-mix(in srgb, var(--warning, #f59e0b) 82%, white);
        }
        &.share {
          color: color-mix(in srgb, var(--tertiary, var(--secondary, var(--primary))) 82%, white);
        }
      }
      .activity-content {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .activity-description {
        font-size: 14px;
      }
      .activity-time {
        font-size: 12px;
        color: var(--muted);
      }
      .arrow-icon {
        width: 16px;
        height: 16px;
        color: var(--muted);
      }
      .saved-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border-bottom: 1px solid var(--border);
        cursor: pointer;
        transition: background 0.2s;
        background: color-mix(in srgb, var(--surface) 94%, transparent);
        &:hover {
          background: var(--hover-bg);
        }
      }
      .item-icon {
        width: 24px;
        height: 24px;
        color: var(--primary);
      }
      .item-content {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .item-title {
        font-size: 14px;
      }
      .item-time {
        font-size: 12px;
        color: var(--muted);
      }
      .icon-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.2s;
        &:hover {
          background: var(--hover-bg);
        }
        svg {
          width: 18px;
          height: 18px;
        }
      }
      .empty-state {
        padding: 48px;
        text-align: center;
        color: var(--muted);
        background: color-mix(in srgb, var(--surface) 88%, transparent);
        border: 1px dashed color-mix(in srgb, var(--border, var(--muted)) 75%, transparent);
        border-radius: 18px;
      }
    `,
  ],
})
export class ActivityPageComponent implements OnInit {
  private activityService = inject(ActivityService);
  private profileService = inject(ProfileService);
  private router = inject(Router);

  activities = signal<ActivityItem[]>([]);
  savedItems = signal<SavedItem[]>([]);
  activeTab = signal('activity');

  tabOptions = [
    { id: 'activity', label: 'Activity' },
    { id: 'saved', label: 'Saved' },
  ];

  ngOnInit() {
    const profile = this.profileService.getCurrentUserProfile();
    if (profile) {
      this.loadActivity(profile.id);
      this.loadSavedItems(profile.id);
    }
  }

  private loadActivity(profileId: string) {
    this.activityService.getUserActivity(profileId).subscribe({
      next: (activities) => this.activities.set(activities),
    });
  }

  private loadSavedItems(profileId: string) {
    this.activityService.getSavedItems(profileId).subscribe({
      next: (items) => this.savedItems.set(items),
    });
  }

  filteredActivities(): ActivityItem[] {
    return this.activities();
  }

  onTabChange(tabId: string) {
    this.activeTab.set(tabId);
  }

  navigateTo(activity: ActivityItem) {
    if (activity.resourceType === 'post') {
      this.router.navigate(['/feed/post', activity.resourceId]);
    } else if (activity.resourceType === 'profile') {
      this.router.navigate(['/profile', activity.resourceId]);
    }
  }

  navigateToSaved(item: SavedItem) {
    if (item.itemType === 'post') {
      this.router.navigate(['/feed/post', item.itemId]);
    }
  }

  unsaveItem(item: SavedItem, event: Event) {
    event.stopPropagation();
    const profile = this.profileService.getCurrentUserProfile();
    if (profile) {
      this.activityService.unsaveItem(profile.id, item.itemId).subscribe({
        next: () => {
          this.savedItems.update((items) =>
            items.filter((i) => i.id !== item.id)
          );
        },
      });
    }
  }
}
