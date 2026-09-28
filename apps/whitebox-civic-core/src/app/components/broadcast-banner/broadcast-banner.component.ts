import {
  Component,
  OnDestroy,
  OnInit,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { EmergencyBroadcastDto } from '@optimistic-tanuki/models';
import { CivicApiService } from '../../services/civic-api.service';

@Component({
  selector: 'civic-broadcast-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="broadcasts.length > 0"
      class="broadcast-banner"
      role="alert"
      aria-live="assertive"
      aria-label="Emergency advisories"
    >
      <div class="banner-inner">
        <strong class="banner-kicker">Public advisory</strong>
        <ul class="banner-list">
          <li *ngFor="let broadcast of broadcasts" class="banner-item">
            <span
              class="severity-pill"
              [class]="'severity-' + broadcast.severity"
            >
              {{ broadcast.severity }}
            </span>
            <span class="banner-headline">{{ broadcast.headline }}</span>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [
    `
      .broadcast-banner {
        background: var(--civic-advisory-background);
        color: var(--civic-advisory-foreground);
        border-bottom: 3px solid var(--civic-advisory-emphasis);
      }
      .banner-inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 10px 24px;
      }
      .banner-kicker {
        display: block;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--civic-advisory-kicker);
        margin-bottom: 4px;
      }
      .banner-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .banner-item {
        display: flex;
        gap: 10px;
        align-items: baseline;
        font-size: 0.95rem;
      }
      .severity-pill {
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        background: var(--civic-advisory-emphasis);
        color: var(--civic-advisory-emphasis-foreground);
        border-radius: 4px;
        padding: 1px 8px;
        white-space: nowrap;
      }
      .severity-emergency {
        background: var(--civic-advisory-foreground);
        color: var(--civic-advisory-background);
      }
      .banner-headline {
        font-weight: 600;
      }
    `,
  ],
})
export class BroadcastBannerComponent implements OnInit, OnDestroy {
  broadcasts: EmergencyBroadcastDto[] = [];
  private subscription: Subscription | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly api: CivicApiService,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.subscription = this.api.watchBroadcasts().subscribe({
      next: (broadcasts) => {
        this.updateBroadcasts(broadcasts ?? []);
      },
      // A transient stream failure should not erase notices. Local expiration
      // still removes stale advisories while EventSource attempts to reconnect.
      error: () => undefined,
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private updateBroadcasts(broadcasts: EmergencyBroadcastDto[]): void {
    this.broadcasts = this.keepActive(broadcasts);
    this.scheduleNextExpiry();
  }

  private keepActive(
    broadcasts: EmergencyBroadcastDto[]
  ): EmergencyBroadcastDto[] {
    const now = Date.now();
    return broadcasts.filter((broadcast) => {
      if (!broadcast.expiresAt) {
        return true;
      }
      const expiresAt = Date.parse(broadcast.expiresAt);
      return Number.isFinite(expiresAt) && expiresAt > now;
    });
  }

  private scheduleNextExpiry(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    const expirations = this.broadcasts
      .map((broadcast) =>
        broadcast.expiresAt ? Date.parse(broadcast.expiresAt) : Number.NaN
      )
      .filter((expiresAt) => Number.isFinite(expiresAt));
    if (expirations.length === 0) {
      return;
    }
    const nextExpiry = Math.min(...expirations);
    const delay = Math.min(Math.max(nextExpiry - Date.now(), 0), 2_147_483_647);
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      this.broadcasts = this.keepActive(this.broadcasts);
      this.scheduleNextExpiry();
    }, delay);
  }
}
