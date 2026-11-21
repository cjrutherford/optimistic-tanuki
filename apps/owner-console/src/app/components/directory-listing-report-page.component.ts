import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  LoadingStateComponent,
} from '@optimistic-tanuki/common-ui';
import type {
  ListingReportReviewItem,
  ListingReportStatus,
} from '@optimistic-tanuki/social-contracts';

export type ReportFilter = 'open' | ListingReportStatus;
export const REPORT_FILTERS: readonly ReportFilter[] = [
  'open',
  'received',
  'under_review',
  'resolved',
  'declined',
];
const STATUS_LABELS: Record<ListingReportStatus, string> = {
  received: 'Received',
  under_review: 'Under review',
  resolved: 'Resolved',
  declined: 'Declined',
};

@Component({
  selector: 'app-directory-listing-report-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    LoadingStateComponent,
  ],
  templateUrl: './directory-listing-report-page.component.html',
  styleUrls: ['./directory-listing-report-page.component.scss'],
})
export class DirectoryListingReportPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(API_BASE_URL);

  readonly filters = REPORT_FILTERS;
  town = '';
  filter: ReportFilter = 'open';
  reports: ListingReportReviewItem[] | null = null;
  loading = false;
  submitting = false;
  message = '';
  declineFor: string | null = null;
  declineNote = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.town = params.get('communityId') ?? '';
      this.reports = null;
      this.load();
    });
  }

  private get url(): string {
    return `${this.api}/directory/towns/${this.town}/listing-reports`;
  }

  statusLabel(status: ListingReportStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  filterLabel(filter: ReportFilter): string {
    return filter === 'open' ? 'Open' : STATUS_LABELS[filter];
  }

  reasonLabel(code: string): string {
    return code.split('-').join(' ');
  }

  isOpen(report: ListingReportReviewItem): boolean {
    return report.status === 'received' || report.status === 'under_review';
  }

  setFilter(filter: ReportFilter): void {
    this.filter = filter;
    this.load();
  }

  load(): void {
    if (!this.town) return;
    const town = this.town;
    this.loading = true;
    this.http
      .get<{ reports: ListingReportReviewItem[] }>(this.url, {
        params: { status: this.filter },
      })
      .subscribe({
        next: (result) => {
          if (this.town !== town) return;
          this.loading = false;
          this.reports = result?.reports ?? [];
        },
        error: (error: HttpErrorResponse) => {
          if (this.town !== town) return;
          this.loading = false;
          this.reports = this.reports ?? [];
          this.message = this.failure(error);
        },
      });
  }

  markUnderReview(report: ListingReportReviewItem): void {
    this.act(report, 'review', {}, 'Report marked under review.');
  }

  openDecline(report: ListingReportReviewItem): void {
    this.declineFor = report.reportId;
    this.declineNote = '';
    this.message = '';
  }

  setDeclineNote(value: string): void {
    this.declineNote = value;
  }

  cancel(): void {
    this.declineFor = null;
    this.declineNote = '';
  }

  submitDecline(report: ListingReportReviewItem): void {
    const note = this.declineNote.trim();
    if (!note) {
      this.message = 'Add a note explaining why the report is declined.';
      return;
    }
    this.act(report, 'decline', { note }, 'Report declined.');
  }

  /**
   * Suppress the reported listing using the existing suppression route, then
   * resolve the report linking the suppression. Both calls are replay-safe.
   */
  openSuppression(report: ListingReportReviewItem): void {
    if (this.submitting || !this.isOpen(report)) return;
    const suppressionId = report.suppressionId ?? crypto.randomUUID();
    const town = this.town;
    this.message = '';
    this.submitting = true;
    this.http
      .post(`${this.api}/directory/towns/${town}/listing-suppressions`, {
        suppressionId,
        listingId: report.listingId,
        reasonCode: report.reasonCode,
        attested: true,
      })
      .subscribe({
        next: () => {
          if (this.town !== town) return;
          this.submitting = false;
          this.act(
            report,
            'resolve',
            { suppressionId },
            'Listing suppressed and report resolved.'
          );
        },
        error: (error: HttpErrorResponse) => {
          if (this.town !== town) return;
          this.submitting = false;
          this.message = this.failure(error);
        },
      });
  }

  private act(
    report: ListingReportReviewItem,
    action: 'review' | 'decline' | 'resolve',
    body: Record<string, string>,
    done: string
  ): void {
    if (this.submitting) return;
    const town = this.town;
    this.message = '';
    this.submitting = true;
    this.http.post(`${this.url}/${report.reportId}/${action}`, body).subscribe({
      next: () => {
        if (this.town !== town) return;
        this.submitting = false;
        this.declineFor = null;
        this.declineNote = '';
        this.message = done;
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        if (this.town !== town) return;
        this.submitting = false;
        this.message = this.failure(error);
      },
    });
  }

  private failure(error: HttpErrorResponse): string {
    if (error?.status === 409)
      return 'That report was already handled. Refresh to see its current state.';
    if (error?.status === 404) return 'That report is not available.';
    if (error?.status === 400 || error?.status === 403)
      return 'That action was not accepted.';
    return 'Listing reports are unavailable. Try again.';
  }
}
