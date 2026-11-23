import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  OwnerConfirmService,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import {
  ControlCenterService,
  ControlCenterStatus,
  RolloutPreview,
  RolloutState,
  RolloutHistoryEntry,
  OAuthProviderDetail,
} from '../services/control-center.service';

@Component({
  selector: 'app-admin-control-center',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './admin-control-center.component.html',
  styleUrls: ['./admin-control-center.component.scss'],
})
export class AdminControlCenterComponent implements OnInit {
  private readonly controlCenter = inject(ControlCenterService);
  private readonly confirmService = inject(OwnerConfirmService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly status = signal<ControlCenterStatus | null>(null);
  readonly rollout = signal<RolloutPreview | null>(null);
  readonly latestRollout = signal<RolloutState | null>(null);
  readonly rolloutHistory = signal<RolloutHistoryEntry[]>([]);
  readonly oauthProviders = signal<OAuthProviderDetail[]>([]);
  targetTag = 'latest';

  readonly statusError = signal<string | null>(null);
  readonly historyError = signal<string | null>(null);
  readonly providersError = signal<string | null>(null);
  readonly rolloutError = signal<string | null>(null);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.loadStatus();
    this.controlCenter.getLatestRollout().subscribe({
      // With no rollout recorded the API answers `{ status: 'pending' }` and
      // nothing else, so a reply without a target tag is "none yet".
      next: (state) => this.latestRollout.set(state?.targetTag ? state : null),
      error: () => this.latestRollout.set(null),
    });
    this.loadHistory();
    this.loadProviders();
  }

  loadStatus(): void {
    this.statusError.set(null);
    this.controlCenter.getPublicStatus().subscribe({
      next: (status) => {
        this.status.set(status);
        this.targetTag = status.defaultTag;
        this.refreshRollout();
      },
      error: () =>
        this.statusError.set('Could not load the production status.'),
    });
  }

  loadHistory(): void {
    this.historyError.set(null);
    this.controlCenter.getRolloutHistory(10).subscribe({
      next: (history) => this.rolloutHistory.set(history),
      error: () => this.historyError.set('Could not load rollout history.'),
    });
  }

  loadProviders(): void {
    this.providersError.set(null);
    this.controlCenter.getOAuthProviders().subscribe({
      next: (data) => this.oauthProviders.set(data.providers),
      error: () => this.providersError.set('Could not load sign-in providers.'),
    });
  }

  refreshRollout(): void {
    this.rolloutError.set(null);
    this.controlCenter.getRolloutPreview(this.targetTag).subscribe({
      next: (preview) => this.rollout.set(preview),
      error: () => {
        this.rollout.set(null);
        this.rolloutError.set('Could not load the rollout plan.');
      },
    });
  }

  async startRollout(): Promise<void> {
    // The rollout API takes only a tag, so no reason is sent.
    const result = await this.confirmService.confirm({
      level: 'typed',
      title: 'Deploy to production',
      body: `Roll every service to ${this.targetTag}. This restarts production services.`,
      confirmLabel: 'Deploy',
      typedPhrase: this.targetTag,
      destructive: true,
    });
    if (!result.confirmed) return;
    this.rolloutError.set(null);
    this.controlCenter.startRollout(this.targetTag).subscribe({
      next: (state) => this.latestRollout.set(state),
      error: () => this.rolloutError.set('The rollout could not be started.'),
    });
  }
}
