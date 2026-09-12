import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import type { OwnerWorkspaceDashboard } from '@optimistic-tanuki/app-config-data-access';
import {
  OwnerWorkspaceDashboardStore,
  WorkspaceDiscoveryStore,
} from '@optimistic-tanuki/app-config-data-access';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-owner-workspace-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ModalComponent],
  template: `
    <main class="owner-dashboard" aria-labelledby="owner-dashboard-title">
      <header class="dashboard-header">
        <a class="wordmark" [routerLink]="['/']"
          >Configurable Client <span>/ owner desk</span></a
        >
        <div class="header-note">
          Private workspace control room
          <span class="signal-dot" aria-hidden="true"></span>
        </div>
      </header>

      @if (state === 'loading') {
      <section class="state-card" aria-live="polite">
        <span class="loader" aria-hidden="true"></span>
        <h1>Loading your workspace</h1>
        <p>Verifying the owner context and preparing the latest release.</p>
      </section>
      } @else if (state === 'empty') {
      <section class="state-card">
        <p class="kicker">OWNER DESK</p>
        <h1>No configuration yet</h1>
        <p>
          This workspace is ready for its first client doorway. Start in the
          editor when a configuration is available.
        </p>
        <button type="button" data-action="retry" (click)="retry()">
          Refresh workspace
        </button>
      </section>
      } @else if (state === 'unavailable') {
      <section class="state-card" role="alert">
        <p class="kicker">ACCESS CHECK</p>
        <h1>Workspace unavailable</h1>
        <p>{{ error || 'This workspace is not available to your account.' }}</p>
        <button type="button" data-action="retry" (click)="retry()">
          Try again</button
        ><a [routerLink]="['/']">Back to discovery</a>
      </section>
      } @else if (state === 'error') {
      <section class="state-card" role="alert">
        <p class="kicker">CONNECTION LOST</p>
        <h1>We could not load this workspace</h1>
        <p>{{ error || 'The workspace service did not respond.' }}</p>
        <button type="button" data-action="retry" (click)="retry()">
          Try again
        </button>
      </section>
      } @else if (dashboard; as current) {
      <section class="dashboard-intro">
        <div>
          <p class="kicker">OWNER WORKSPACE / {{ current.workspace.slug }}</p>
          <h1 id="owner-dashboard-title">{{ current.workspace.name }}</h1>
          <p class="lede">
            A focused control room for <strong>{{ current.app.name }}</strong
            >.
          </p>
        </div>
        <div class="identity-stamp">
          <span class="stamp-label">AUTHENTICATED AS</span><strong>Owner</strong
          ><span>{{ current.membership.status }} membership</span>
        </div>
      </section>

      <section class="release-banner" aria-label="Release status">
        <div>
          <span
            class="status-orb"
            [class]="
              'status-orb status-orb--' + current.configuration.releaseStatus
            "
            aria-hidden="true"
          ></span>
          <div>
            <p class="kicker">CURRENT RELEASE</p>
            <h2>{{ releaseLabel(current.configuration.releaseStatus) }}</h2>
          </div>
        </div>
        <div class="revision">
          <span>Revision</span
          ><strong>{{ current.configuration.revision }}</strong
          ><small>{{
            current.configuration.updatedAt
              ? (current.configuration.updatedAt | date : 'MMM d, y · h:mm a')
              : 'Not published yet'
          }}</small>
        </div>
      </section>

      <section
        class="panel release-history"
        aria-labelledby="release-history-title"
      >
        <p class="kicker">RELEASE LEDGER</p>
        <h2 id="release-history-title">
          Published version {{ current.configuration.publishedVersion ?? '—' }}
        </h2>
        @if (current.configuration.releaseHistory?.length) {
        <div class="release-history__list">
          @for (release of current.configuration.releaseHistory; track
          release.version) {
          <div class="release-history__item">
            <span>v{{ release.version }} · {{ release.action }}</span
            ><small>{{
              release.releaseNotes ||
                release.changeSummary ||
                'No release notes'
            }}</small
            ><button
              type="button"
              data-action="rollback"
              [attr.data-version]="release.version"
              [disabled]="
                rollingBack ||
                release.version === current.configuration.publishedVersion
              "
              (click)="openRollback(release.version)"
            >
              {{
                release.version === current.configuration.publishedVersion
                  ? 'Current'
                  : 'Restore'
              }}
            </button>
          </div>
          }
        </div>
        } @else {
        <p class="gated">No published releases yet.</p>
        } @if (rollbackError) {
        <p class="notice notice--error" role="alert">
          Rollback did not complete. {{ rollbackError }}
          <button
            type="button"
            data-action="retry-rollback"
            (click)="retryRollback()"
          >
            Try again
          </button>
        </p>
        }
      </section>

      <div class="content-grid">
        <section class="panel panel--identity">
          <p class="kicker">AUTHORITATIVE CONTEXT</p>
          <h2>One workspace. One doorway.</h2>
          <dl>
            <div>
              <dt>Workspace</dt>
              <dd>
                {{ current.workspace.name }}
                <small>{{ current.workspace.id }}</small>
              </dd>
            </div>
            <div>
              <dt>Application</dt>
              <dd>
                {{ current.app.name }} <small>{{ current.app.scope }}</small>
              </dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                {{ current.membership.role | titlecase }}
                <small>{{ current.membership.status }}</small>
              </dd>
            </div>
          </dl>
        </section>
        <section class="panel panel--actions">
          <p class="kicker">NEXT MOVES</p>
          <h2>Shape the handoff</h2>
          @if (current.membership.canEdit) {
          <a class="action action--primary" [routerLink]="current.links.edit"
            ><span>01</span><strong>Edit configuration</strong
            ><small>Refine the client-facing surface</small></a
          >@if (hasFunctionalAuthoring(current)) {
          <a class="action" [routerLink]="authorHref(current)"
            ><span>02</span><strong>Author content</strong
            ><small>Prepare the message behind the doorway</small></a
          >
          } @else {
          <p class="gated" role="status">
            Content authoring is unavailable for this workspace.
          </p>
          } } @else {
          <p class="gated" role="status">
            Owner actions are unavailable for this session.
          </p>
          }
          <a class="action" [href]="current.links.preview"
            ><span>03</span><strong>Preview doorway</strong
            ><small>See the scoped public experience</small></a
          >
          @if (current.membership.canPublish) {
          <button
            class="action action--publish"
            data-action="publish"
            type="button"
            (click)="openPublish()"
          >
            <span>04</span
            ><strong
              >Publish revision {{ current.configuration.revision }}</strong
            ><small>Make this release available to clients</small>
          </button>
          }
        </section>
      </div>

      @if (publishSuccess; as published) {
      <div
        class="notice notice--success"
        data-server-confirmed="true"
        role="status"
      >
        <strong
          >Published revision {{ published.configuration.revision }}.</strong
        >
        Server confirmed the release{{
          published.configuration.updatedAt
            ? ' at ' +
              (published.configuration.updatedAt | date : 'MMM d, y · h:mm a')
            : '.'
        }}
      </div>
      } @if (publishError) {
      <div class="notice notice--error" role="alert">
        <strong>Publish did not complete.</strong> {{ publishError }}
        <button
          type="button"
          data-action="retry-publish"
          (click)="openPublish()"
        >
          Retry publish
        </button>
      </div>
      } }
    </main>

    @if (confirming && dashboard; as current) {
    <otui-modal
      [visible]="true"
      heading="Publish this revision?"
      [closable]="false"
      [closeOnBackdrop]="true"
      [closeOnEscape]="true"
      ariaLabelledBy="modal-title"
      ariaDescribedBy="publish-description"
      (close)="cancelPublish()"
    >
      <div
        [attr.data-config-id]="current.configuration.id"
        [attr.data-workspace-slug]="current.workspace.slug"
        [attr.data-revision]="current.configuration.revision"
      >
        <p class="kicker">RELEASE CHECK</p>
        <p>
          You are publishing <strong>{{ current.app.name }}</strong> for
          <strong>{{ current.workspace.name }}</strong
          >, revision <strong>{{ current.configuration.revision }}</strong
          >.
        </p>
        @if (publishing) {
        <p class="publish-progress" role="status">
          <span class="loader" aria-hidden="true"></span> Publishing securely…
        </p>
        }
      </div>
      <div modal-footer class="dialog-actions">
        <button type="button" (click)="cancelPublish()" [disabled]="publishing">
          Cancel</button
        ><button
          class="confirm-button"
          data-action="confirm-publish"
          type="button"
          (click)="confirmPublish()"
          [disabled]="publishing"
        >
          {{ publishing ? 'Publishing…' : 'Confirm publish' }}
        </button>
      </div>
    </otui-modal>
    } @if (rollbackConfirmVersion !== null && dashboard; as current) {
    <otui-modal
      [visible]="true"
      heading="Restore this release?"
      [closable]="false"
      [closeOnBackdrop]="true"
      [closeOnEscape]="true"
      (close)="cancelRollback()"
    >
      <div
        [attr.data-config-id]="current.configuration.id"
        [attr.data-workspace-slug]="current.workspace.slug"
        [attr.data-revision]="current.configuration.revision"
        [attr.data-rollback-version]="rollbackConfirmVersion"
      >
        <p class="kicker">ROLLBACK CHECK</p>
        <p>
          Restore <strong>{{ current.app.name }}</strong> to immutable release
          <strong>v{{ rollbackConfirmVersion }}</strong
          >? This creates a new release and refreshes the owner revision.
        </p>
      </div>
      <div modal-footer class="dialog-actions">
        <button
          type="button"
          (click)="cancelRollback()"
          [disabled]="rollingBack"
        >
          Cancel</button
        ><button
          class="confirm-button"
          data-action="confirm-rollback"
          type="button"
          (click)="confirmRollback()"
          [disabled]="rollingBack"
        >
          {{ rollingBack ? 'Restoring…' : 'Confirm restore' }}
        </button>
      </div>
    </otui-modal>
    }
  `,
  styleUrls: ['./owner-workspace-dashboard.component.scss'],
})
export class OwnerWorkspaceDashboardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dashboardStore = inject(OwnerWorkspaceDashboardStore);
  private readonly discoveryStore = inject(WorkspaceDiscoveryStore);
  private readonly destroyRef = inject(DestroyRef);
  confirming = false;
  publishSuccess: OwnerWorkspaceDashboard | null = null;
  private publishInFlight = false;
  private publishFailure: string | null = null;
  private publishSubscription?: Subscription;
  private rollbackSubscription?: Subscription;
  private rollbackTarget: number | null = null;
  rollbackConfirmVersion: number | null = null;
  private rollbackInFlight = false;
  private rollbackFailure: string | null = null;

  ngOnInit(): void {
    this.applyRouteContext(
      this.route.snapshot.paramMap.get('workspaceSlug') ??
        this.route.snapshot.queryParamMap.get('workspaceSlug')
    );
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) =>
        this.applyRouteContext(params.get('workspaceSlug'))
      );
    this.discoveryStore.load();
  }

  get dashboard(): OwnerWorkspaceDashboard | null {
    return this.dashboardStore.dashboard();
  }
  get state() {
    return this.dashboardStore.state();
  }
  get error() {
    return this.dashboardStore.error();
  }
  get publishError() {
    return this.publishFailure || this.dashboardStore.publishError();
  }
  get publishing() {
    return this.publishInFlight || this.dashboardStore.publishing();
  }
  get rollingBack() {
    const store = this.dashboardStore as OwnerWorkspaceDashboardStore & {
      rollingBack?: () => boolean;
    };
    return this.rollbackInFlight || Boolean(store.rollingBack?.());
  }
  get rollbackError() {
    const store = this.dashboardStore as OwnerWorkspaceDashboardStore & {
      rollbackError?: () => string | null;
    };
    return this.rollbackFailure || store.rollbackError?.() || null;
  }

  hasFunctionalAuthoring(current: OwnerWorkspaceDashboard): boolean {
    return this.discoveryStore
      .workspaces()
      .some(
        (workspace) =>
          workspace.slug === current.workspace.slug &&
          workspace.kind === 'business-site' &&
          workspace.status === 'active' &&
          workspace.membershipRole === 'owner' &&
          workspace.membershipStatus === 'active'
      );
  }

  retry(): void {
    this.dashboardStore.retry();
  }
  openPublish(): void {
    if (this.dashboard?.membership.canPublish && !this.publishing)
      this.confirming = true;
  }
  cancelPublish(): void {
    if (!this.publishing) this.confirming = false;
  }
  confirmPublish(): void {
    if (!this.dashboard || this.publishing) return;
    this.publishInFlight = true;
    this.publishFailure = null;
    this.publishSubscription?.unsubscribe();
    this.publishSubscription = this.dashboardStore
      .publish('Owner workspace release')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (published) => {
          this.publishSuccess = published;
          this.publishInFlight = false;
          this.confirming = false;
        },
        error: (error: unknown) => {
          this.publishInFlight = false;
          this.publishFailure =
            error instanceof Error && error.message
              ? error.message
              : 'Unable to publish this configuration.';
        },
      });
  }
  rollback(version: number): void {
    if (!this.dashboard?.membership.canPublish || this.rollingBack) return;
    this.rollbackTarget = version;
    this.rollbackInFlight = true;
    this.rollbackFailure = null;
    this.rollbackSubscription?.unsubscribe();
    const store = this.dashboardStore as OwnerWorkspaceDashboardStore & {
      rollback: (
        target: number,
        notes?: string
      ) => import('rxjs').Observable<OwnerWorkspaceDashboard>;
    };
    if (typeof store.rollback !== 'function') {
      this.rollbackInFlight = false;
      this.rollbackFailure = 'Rollback is unavailable for this workspace.';
      return;
    }
    this.rollbackSubscription = store
      .rollback(version, `Restore release v${version}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.rollbackInFlight = false;
          this.rollbackTarget = null;
        },
        error: (error: unknown) => {
          this.rollbackInFlight = false;
          this.rollbackFailure =
            error instanceof Error && error.message
              ? error.message
              : 'Unable to rollback this configuration.';
        },
      });
  }
  openRollback(version: number): void {
    if (this.dashboard?.membership.canPublish && !this.rollingBack)
      this.rollbackConfirmVersion = version;
  }
  cancelRollback(): void {
    if (!this.rollingBack) this.rollbackConfirmVersion = null;
  }
  confirmRollback(): void {
    if (this.rollbackConfirmVersion === null) return;
    const version = this.rollbackConfirmVersion;
    this.rollbackConfirmVersion = null;
    this.rollback(version);
  }
  retryRollback(): void {
    if (this.rollbackTarget !== null) this.rollback(this.rollbackTarget);
  }
  releaseLabel(
    status: OwnerWorkspaceDashboard['configuration']['releaseStatus']
  ): string {
    return {
      draft: 'Draft · Changes saved as draft',
      published: 'Published',
      pending: 'Changes pending',
      'rolled-back': 'Rolled back',
    }[status];
  }
  authorHref(current: OwnerWorkspaceDashboard): string {
    return `/owner/workspace/${encodeURIComponent(
      current.workspace.slug
    )}/author`;
  }

  private applyRouteContext(slug: string | null): void {
    this.publishSubscription?.unsubscribe();
    this.rollbackSubscription?.unsubscribe();
    this.publishSubscription = undefined;
    this.confirming = false;
    this.publishInFlight = false;
    this.publishFailure = null;
    this.publishSuccess = null;
    this.rollbackTarget = null;
    this.rollbackConfirmVersion = null;
    this.rollbackInFlight = false;
    this.rollbackFailure = null;
    if (slug) this.dashboardStore.load(slug);
  }
}
