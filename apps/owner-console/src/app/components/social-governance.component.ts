import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ModerationReport,
  SocialGovernanceService,
} from '../services/social-governance.service';
import { OperatorQueuePanelComponent } from './operator-queue-panel.component';
import {
  OperatorQueueItem,
  OperatorQueueService,
} from '../services/operator-queue.service';

@Component({
  selector: 'app-social-governance',
  standalone: true,
  imports: [CommonModule, FormsModule, OperatorQueuePanelComponent],
  template: `
    <section class="governance-page">
      <header class="hero">
        <p class="hero-kicker">Community Ops</p>
        <h1>Social Governance</h1>
        <p>
          Review and triage incoming social content reports directly from
          owner-console.
        </p>
      </header>

      <section class="summary-grid">
        <article class="summary-card">
          <span class="eyebrow">Reports</span>
          <strong>{{ reports.length }}</strong>
          <p>{{ pendingCount }} pending review</p>
        </article>
        <article class="summary-card">
          <span class="eyebrow">Actioned</span>
          <strong>{{ actionedCount }}</strong>
          <p>{{ dismissedCount }} dismissed</p>
        </article>
      </section>

      <div class="error" *ngIf="error">{{ error }}</div>

      <app-operator-queue-panel
        [items]="queueItems"
        heading="Community Moderation Queue"
        description="Shared queue items that still require moderation review or follow-through."
        emptyStateCopy="No community moderation queue items are currently prioritized."
      ></app-operator-queue-panel>

      <section class="panel" *ngIf="handoffContext">
        <div class="panel-heading">
          <h2>Opened from Community Ops</h2>
          <p>
            Investigating {{ handoffContext.entityType }} context for
            {{ handoffContext.entityTitle }} in
            {{ handoffContext.communityName }}.
          </p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Report triage queue</h2>
          <p>
            Update moderation status and capture operator notes while takedown
            actions remain a separate follow-up slice.
          </p>
        </div>
        <div class="report-list" *ngIf="reports.length; else noReports">
          <article class="report-card" *ngFor="let report of reports">
            <div class="report-copy">
              <div class="status-row">
                <span class="status-pill">{{ report.status }}</span>
                <span class="status-pill soft">{{ report.contentType }}</span>
                <span class="status-pill soft">{{ report.reason }}</span>
              </div>
              <h3>{{ report.contentType }} · {{ report.contentId }}</h3>
              <p>
                {{ report.description || 'No reporter description provided.' }}
              </p>
            </div>
            <div class="report-actions">
              <select
                [ngModel]="getDraft(report).status"
                (ngModelChange)="updateDraft(report.id, 'status', $event)"
              >
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="actioned">Actioned</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <textarea
                rows="3"
                [ngModel]="getDraft(report).adminNotes"
                (ngModelChange)="updateDraft(report.id, 'adminNotes', $event)"
                placeholder="Operator notes"
              ></textarea>
              <div class="action-row">
                <button class="btn" (click)="saveReport(report)">Save</button>
                <button
                  class="btn warning"
                  *ngIf="supportsContentModeration(report)"
                  (click)="applyContentModeration(report, 'hidden')"
                >
                  Hide
                </button>
                <button
                  class="btn"
                  *ngIf="supportsContentModeration(report)"
                  (click)="applyContentModeration(report, 'visible')"
                >
                  Restore
                </button>
              </div>
            </div>
          </article>
        </div>
        <ng-template #noReports>
          <p class="empty-state">No content reports are currently queued.</p>
        </ng-template>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Remaining social gaps</h2>
          <p>These items remain outside the current slice.</p>
        </div>
        <ul class="gap-list">
          <li>
            Privacy block and mute signals are not yet unified into one review
            console.
          </li>
          <li>
            Reported profiles, communities, and messages still do not have
            dedicated moderation actions here.
          </li>
        </ul>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .governance-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .panel,
      .summary-card {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 24px;
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--accent, #2563eb) 10%, transparent),
            transparent 28%
          ),
          linear-gradient(
            180deg,
            color-mix(
              in srgb,
              var(--surface, #ffffff) 96%,
              var(--background, #f3f4f6)
            ),
            color-mix(
              in srgb,
              var(--surface, #ffffff) 90%,
              var(--background, #f3f4f6)
            )
          );
        padding: 24px;
        color: var(--foreground, #111827);
      }

      .hero-kicker,
      .eyebrow {
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 78%,
          var(--foreground, #111827)
        );
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }

      .summary-card strong {
        display: block;
        font-size: 2rem;
        margin: 0.5rem 0;
      }

      .panel-heading {
        margin-bottom: 16px;
      }

      .report-list {
        display: grid;
        gap: 16px;
      }

      .report-card {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 18px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--background, #f3f4f6)
        );
      }

      .report-copy,
      .report-actions {
        display: grid;
        gap: 8px;
      }

      .report-actions {
        min-width: 240px;
      }

      .action-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .status-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .status-pill {
        padding: 4px 10px;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--accent, #2563eb) 14%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 78%,
          var(--foreground, #111827)
        );
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .status-pill.soft {
        background: color-mix(
          in srgb,
          var(--accent, #2563eb) 8%,
          var(--surface, #ffffff)
        );
      }

      .btn,
      select,
      textarea {
        padding: 0.55rem 0.85rem;
        border-radius: 8px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
      }

      .btn {
        cursor: pointer;
      }

      .btn.warning {
        background: color-mix(
          in srgb,
          var(--warning, #b45309) 12%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--warning, #b45309) 82%,
          var(--foreground, #111827)
        );
      }

      .gap-list {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 10px;
      }

      .empty-state,
      .error {
        margin: 0;
      }

      .error {
        color: color-mix(
          in srgb,
          var(--danger, #b91c1c) 82%,
          var(--foreground, #111827)
        );
        font-weight: 600;
      }
    `,
  ],
})
export class SocialGovernanceComponent implements OnInit {
  private readonly socialGovernanceService = inject(SocialGovernanceService);
  private readonly operatorQueueService = inject(OperatorQueueService);
  private readonly route = inject(ActivatedRoute);

  reports: ModerationReport[] = [];
  queueItems: OperatorQueueItem[] = [];
  error: string | null = null;
  handoffContext: {
    source: string;
    entityType: string;
    entityId: string;
    communityId: string;
    communityName: string;
    entityTitle: string;
  } | null = null;
  reportDrafts: Record<
    string,
    { status: ModerationReport['status']; adminNotes: string }
  > = {};

  get pendingCount(): number {
    return this.reports.filter((report) => report.status === 'pending').length;
  }

  get actionedCount(): number {
    return this.reports.filter((report) => report.status === 'actioned').length;
  }

  get dismissedCount(): number {
    return this.reports.filter((report) => report.status === 'dismissed')
      .length;
  }

  ngOnInit(): void {
    this.loadHandoffContext();
    this.loadReports();
    this.loadQueue();
  }

  loadHandoffContext(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    const source = queryParams.get('source');
    if (source !== 'community-ops') {
      this.handoffContext = null;
      return;
    }

    this.handoffContext = {
      source,
      entityType: queryParams.get('entityType') ?? 'entity',
      entityId: queryParams.get('entityId') ?? '',
      communityId: queryParams.get('communityId') ?? '',
      communityName: queryParams.get('communityName') ?? 'Unknown community',
      entityTitle: queryParams.get('entityTitle') ?? 'Unknown entity',
    };
  }

  loadQueue(): void {
    this.operatorQueueService.getQueueByDomain('Community Ops').subscribe({
      next: (items) => {
        this.queueItems = items;
      },
      error: () => {
        this.queueItems = [];
      },
    });
  }

  loadReports(): void {
    this.socialGovernanceService.getReports().subscribe({
      next: (reports) => {
        this.reports = reports;
        this.reportDrafts = {};
        for (const report of reports) {
          this.reportDrafts[report.id] = {
            status: report.status,
            adminNotes: report.adminNotes ?? '',
          };
        }
      },
      error: (err) => {
        this.error = 'Failed to load moderation reports';
        console.error(err);
      },
    });
  }

  getDraft(report: ModerationReport): {
    status: ModerationReport['status'];
    adminNotes: string;
  } {
    return (
      this.reportDrafts[report.id] ?? {
        status: report.status,
        adminNotes: report.adminNotes ?? '',
      }
    );
  }

  updateDraft(
    reportId: string,
    key: 'status' | 'adminNotes',
    value: string
  ): void {
    const current = this.reportDrafts[reportId] ?? {
      status: 'pending' as const,
      adminNotes: '',
    };
    this.reportDrafts[reportId] = {
      ...current,
      [key]: value,
    };
  }

  saveReport(report: ModerationReport): void {
    const draft = this.getDraft(report);
    this.socialGovernanceService
      .updateReport(report.id, {
        status: draft.status,
        adminNotes: draft.adminNotes,
      })
      .subscribe({
        next: (updated) => {
          this.reports = this.reports.map((existing) =>
            existing.id === updated.id ? updated : existing
          );
          this.reportDrafts[updated.id] = {
            status: updated.status,
            adminNotes: updated.adminNotes ?? '',
          };
        },
        error: (err) => {
          this.error = 'Failed to update moderation report';
          console.error(err);
        },
      });
  }

  supportsContentModeration(report: ModerationReport): boolean {
    return report.contentType === 'post' || report.contentType === 'comment';
  }

  applyContentModeration(
    report: ModerationReport,
    moderationStatus: 'visible' | 'hidden'
  ): void {
    if (!this.supportsContentModeration(report)) {
      return;
    }

    const draft = this.getDraft(report);
    this.socialGovernanceService
      .moderateContent({
        contentType: report.contentType as 'post' | 'comment',
        contentId: report.contentId,
        moderationStatus,
        adminNotes: draft.adminNotes,
      })
      .subscribe({
        next: () => {
          const nextStatus =
            moderationStatus === 'hidden' ? 'actioned' : draft.status;
          this.socialGovernanceService
            .updateReport(report.id, {
              status: nextStatus,
              adminNotes: draft.adminNotes,
            })
            .subscribe({
              next: (updated) => {
                this.reports = this.reports.map((existing) =>
                  existing.id === updated.id ? updated : existing
                );
                this.reportDrafts[updated.id] = {
                  status: updated.status,
                  adminNotes: updated.adminNotes ?? '',
                };
              },
              error: (err) => {
                this.error = 'Failed to update moderation report';
                console.error(err);
              },
            });
        },
        error: (err) => {
          this.error = 'Failed to apply content moderation';
          console.error(err);
        },
      });
  }
}
