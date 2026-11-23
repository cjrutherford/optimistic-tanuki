import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  OwnerConfirmService,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import {
  ModerationReport,
  SocialGovernanceService,
} from '../services/social-governance.service';
import { scrollToFocused } from '../focus-item';
import { OperatorQueuePanelComponent } from './operator-queue-panel.component';
import {
  OperatorQueueItem,
  OperatorQueueService,
} from '../services/operator-queue.service';

@Component({
  selector: 'app-social-governance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OperatorQueuePanelComponent,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './social-governance.component.html',
  styleUrls: ['./social-governance.component.scss'],
})
export class SocialGovernanceComponent implements OnInit {
  private readonly socialGovernanceService = inject(SocialGovernanceService);
  private readonly operatorQueueService = inject(OperatorQueueService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmService = inject(OwnerConfirmService);

  reports: ModerationReport[] = [];
  /** Report to mark, from `?focus=` (set by the moderation queue). */
  focusId: string | null = null;
  queueItems: OperatorQueueItem[] = [];
  error: string | null = null;
  loadFailed = false;
  reportsLoaded = false;
  queueError: string | null = null;
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
  private operatorQueueAppScope: 'local-hub' | 'client-interface' | null = null;

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
    this.focusId = this.route.snapshot.queryParamMap.get('focus');
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
    this.queueError = null;
    this.operatorQueueService.getQueueByDomain('Community Ops').subscribe({
      next: (items) => {
        this.queueItems = items;
      },
      error: () => {
        this.queueError = 'Could not load the moderation queue.';
      },
    });
  }

  loadReports(): void {
    this.operatorQueueAppScope = null;
    this.error = null;
    this.loadFailed = false;
    this.socialGovernanceService.getReports().subscribe({
      next: (reports) => {
        this.reports = reports;
        this.reportsLoaded = true;
        this.reportDrafts = {};
        for (const report of reports) {
          this.reportDrafts[report.id] = {
            status: report.status,
            adminNotes: report.adminNotes ?? '',
          };
        }
        scrollToFocused(this.focusId);
      },
      error: (err) => {
        this.error = 'Failed to load moderation reports';
        this.loadFailed = true;
        this.reportsLoaded = false;
        console.error(err);
      },
    });
  }

  retryLoad(): void {
    if (this.operatorQueueAppScope) {
      this.loadOperatorReports(this.operatorQueueAppScope);
    } else {
      this.loadReports();
    }
  }

  loadLocalHubOperatorReports(): void {
    this.loadOperatorReports('local-hub');
  }

  loadClientInterfaceOperatorReports(): void {
    this.loadOperatorReports('client-interface');
  }

  private loadOperatorReports(
    appScope: 'local-hub' | 'client-interface'
  ): void {
    this.operatorQueueAppScope = appScope;
    this.error = null;
    this.loadFailed = false;
    const productName =
      appScope === 'local-hub' ? 'Towne Square' : 'Optimistic Tanuki';
    const source =
      appScope === 'local-hub'
        ? this.socialGovernanceService.getLocalHubOperatorReports()
        : this.socialGovernanceService.getClientInterfaceOperatorReports();
    source.subscribe({
      next: (reports) => {
        this.reports = reports;
        this.reportsLoaded = true;
        this.reportDrafts = {};
        for (const report of reports) {
          this.reportDrafts[report.id] = {
            status: report.status,
            adminNotes: report.adminNotes ?? '',
          };
        }
      },
      error: () => {
        this.error = `Failed to load ${productName} app reports`;
        this.loadFailed = true;
        this.reportsLoaded = false;
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
    const update =
      this.operatorQueueAppScope === 'local-hub'
        ? this.socialGovernanceService.updateLocalHubOperatorReport(
            report.id,
            draft
          )
        : this.operatorQueueAppScope === 'client-interface'
        ? this.socialGovernanceService.updateClientInterfaceOperatorReport(
            report.id,
            draft
          )
        : this.socialGovernanceService.updateReport(report.id, draft);
    update.subscribe({
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

  async applyContentModeration(
    report: ModerationReport,
    moderationStatus: 'visible' | 'hidden'
  ): Promise<void> {
    if (!this.supportsContentModeration(report)) {
      return;
    }

    const hiding = moderationStatus === 'hidden';
    const result = await this.confirmService.confirm(
      hiding
        ? {
            level: 'reason',
            title: 'Hide this content',
            body: `Hide this ${report.contentType} from everyone. The author is affected.`,
            confirmLabel: 'Hide content',
            destructive: true,
          }
        : {
            level: 'plain',
            title: 'Restore this content',
            body: `Make this ${report.contentType} visible again.`,
            confirmLabel: 'Restore content',
          }
    );
    if (!result.confirmed) return;

    const baseDraft = this.getDraft(report);
    // The moderation API has no reason field, so the reason is kept as the
    // operator note when none was typed.
    const draft = {
      ...baseDraft,
      adminNotes: baseDraft.adminNotes || (hiding ? result.reason ?? '' : ''),
    };
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
