import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import type {
  AddressReviewCandidateDetail,
  AddressReviewHistoryEntry,
} from '@optimistic-tanuki/social-contracts';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  DecisionHistoryComponent,
  type DecisionHistoryEntry,
  type DecisionUndoRequest,
  IconComponent,
  LoadingStateComponent,
} from '@optimistic-tanuki/common-ui';
import {
  CheckboxComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';

type ReviewStatus =
  | 'needs_human'
  | 'auto_approved'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'revoked'
  | 'archived';
type ReviewDecision = 'approve' | 'reject' | 'needs_info' | 'revoke';

export const STALE_MESSAGE = 'This item changed since you opened it';

interface ReviewCandidate {
  id: string;
  communityId: string;
  scanId: string;
  sourceFileRowNumber: string;
  name: string;
  category: string;
  point?: { lat: number; lng: number } | null;
  addresses?: string[];
  websites?: string[];
  phones?: string[];
  rights: string;
  risk?: {
    residential?: boolean;
    sensitive?: boolean;
    adult?: boolean;
  } | null;
  geocode?: {
    status?: string;
    normalizedAddress?: string;
    precision?: string;
    distanceMeters?: number | null;
    provider?: string;
    checkedAt?: string;
  } | null;
  officialEvidence?: {
    url?: string;
    status?: string;
    nameMatch?: boolean;
    addressMatch?: boolean;
    phoneMatch?: boolean;
    websiteMatch?: boolean;
    fetchedAt?: string;
    evidenceHash?: string;
    transport?: 'http' | 'https';
  } | null;
  verdict: string;
  reasons?: string[];
  checks?: Record<string, string>;
  policyVersion: string;
  versionToken: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-directory-address-review-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    DecisionHistoryComponent,
    IconComponent,
    LoadingStateComponent,
    CheckboxComponent,
    TextInputComponent,
  ],
  templateUrl: './directory-address-review-page.component.html',
  styleUrls: ['./directory-address-review-page.component.scss'],
})
export class DirectoryAddressReviewPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');

  town = '';
  status: ReviewStatus = 'needs_human';
  candidates: ReviewCandidate[] = [];
  loading = false;
  message = '';
  histories: Record<string, AddressReviewHistoryEntry[]> = {};
  undoing = false;
  private readonly decisionIds = new Map<string, string>();
  private offset = 0;
  private readonly limit = 25;

  readonly statuses: Array<{ value: ReviewStatus; label: string }> = [
    { value: 'needs_human', label: 'Needs review' },
    { value: 'auto_approved', label: 'Auto-approved' },
    { value: 'approved', label: 'Approved' },
    { value: 'published', label: 'Published' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'revoked', label: 'Revoked' },
    { value: 'archived', label: 'Archived' },
  ];

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.town = params.get('townId') ?? params.get('communityId') ?? '';
      this.refresh();
    });
  }

  setStatus(status: ReviewStatus): void {
    this.status = status;
    this.refresh();
  }

  refresh(): void {
    this.candidates = [];
    this.offset = 0;
    this.load();
  }

  loadMore(): void {
    this.offset = this.candidates.length;
    this.load();
  }

  private load(): void {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        this.town
      )
    ) {
      this.message = 'This town is unavailable.';
      return;
    }
    const town = this.town;
    this.loading = true;
    this.message = '';
    this.http
      .get<{ candidates: ReviewCandidate[] }>(
        `${this.api}/directory/towns/${town}/address-review-candidates?status=${this.status}&limit=${this.limit}&offset=${this.offset}`
      )
      .subscribe({
        next: (result) => {
          if (this.town !== town) return;
          this.loading = false;
          this.candidates =
            this.offset === 0
              ? result.candidates ?? []
              : [...this.candidates, ...(result.candidates ?? [])];
        },
        error: () => {
          if (this.town !== town) return;
          this.loading = false;
          this.message =
            'The address review queue is unavailable. Please try again.';
        },
      });
  }

  decide(
    candidate: ReviewCandidate,
    decision: ReviewDecision,
    evidenceUrl: string,
    attested: boolean,
    reason: string
  ): void {
    if (!attested) {
      this.message =
        'Confirm that you compared the source record and the evidence.';
      return;
    }
    if (decision === 'approve' && !evidenceUrl.trim()) {
      this.message = 'An HTTPS evidence URL is required for approval.';
      return;
    }
    const town = this.town;
    this.message = '';
    // One id per attempt: a retry after a network error replays instead of duplicating.
    const key = `${candidate.id}:${decision}`;
    const decisionId = this.decisionIds.get(key) ?? crypto.randomUUID();
    this.decisionIds.set(key, decisionId);
    this.http
      .post<{ recorded: boolean; status: string }>(
        `${this.api}/directory/towns/${town}/address-review-candidates/${candidate.id}/decisions`,
        {
          decisionId,
          expectedVersionToken: candidate.versionToken,
          decision,
          evidenceUrl: evidenceUrl.trim(),
          reason: reason.trim(),
          attested: true,
          checks: { reviewedFrom: 'owner-console' },
        }
      )
      .subscribe({
        next: () => {
          if (this.town !== town) return;
          this.decisionIds.delete(key);
          this.refresh();
          this.message = `Recorded ${decision.replace('_', ' ')} for ${
            candidate.name
          }.`;
        },
        error: (error: HttpErrorResponse) => {
          if (this.town !== town) return;
          if (error?.status === 409) {
            this.decisionIds.delete(key);
            this.stale();
            return;
          }
          this.message =
            'The review decision could not be recorded. Check the evidence URL and try again.';
        },
      });
  }

  /** The item moved under the reviewer: say so and show the current state. */
  private stale(): void {
    const open = Object.keys(this.histories);
    this.refresh();
    this.message = STALE_MESSAGE;
    // refresh() clears the list but not the open histories; reload those so no stale Undo button stays.
    for (const id of open) this.loadHistory(id);
  }

  private loadHistory(candidateId: string): void {
    const town = this.town;
    this.http
      .get<AddressReviewCandidateDetail>(
        `${this.api}/directory/towns/${town}/address-review-candidates/${candidateId}`
      )
      .subscribe({
        next: (detail) => {
          if (this.town !== town) return;
          this.histories = { ...this.histories, [candidateId]: detail.history };
          this.candidates = this.candidates.map((c) =>
            c.id === candidateId
              ? {
                  ...c,
                  status: detail.status as ReviewStatus,
                  versionToken: detail.versionToken,
                }
              : c
          );
        },
        error: () => {
          if (this.town !== town) return;
          this.message = 'The decision history is unavailable. Try again.';
        },
      });
  }

  toggleHistory(candidate: ReviewCandidate): void {
    if (this.histories[candidate.id]) {
      const { [candidate.id]: _closed, ...rest } = this.histories;
      this.histories = rest;
      return;
    }
    this.histories = { ...this.histories, [candidate.id]: [] };
    this.loadHistory(candidate.id);
  }

  historyEntries(candidateId: string): DecisionHistoryEntry[] {
    return (this.histories[candidateId] ?? []).map((h) => ({
      id: h.decisionId,
      label: h.decision.replace('_', ' ').replace(/^./, (c) => c.toUpperCase()),
      actor: h.actorId,
      at: h.createdAt,
      reason: h.reason,
      undone: !!h.undoneBy,
      isUndo: !!h.undoOf,
      reversible: h.reversible,
    }));
  }

  /** The reviewer confirmed an undo (with a reason) on the panel; one new decisionId per confirmation. */
  undo(candidate: ReviewCandidate, request: DecisionUndoRequest): void {
    if (this.undoing) return;
    const town = this.town;
    this.message = '';
    this.undoing = true;
    this.http
      .post<{ recorded: boolean; status: string }>(
        `${this.api}/directory/towns/${town}/address-review-candidates/${candidate.id}/undo`,
        {
          decisionId: crypto.randomUUID(),
          undoOf: request.entry.id,
          expectedVersionToken: candidate.versionToken,
          reason: request.reason,
        }
      )
      .subscribe({
        next: () => {
          if (this.town !== town) return;
          this.undoing = false;
          const open = Object.keys(this.histories);
          this.refresh();
          this.message = `Undid the ${request.entry.label.toLowerCase()} decision.`;
          for (const id of open) this.loadHistory(id);
        },
        error: (error: HttpErrorResponse) => {
          if (this.town !== town) return;
          this.undoing = false;
          if (error?.status === 409) {
            this.stale();
            return;
          }
          this.message = 'The undo could not be recorded. Try again.';
        },
      });
  }

  badgeTone(value: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (
      value === 'approved' ||
      value === 'auto_approved' ||
      value === 'eligible'
    ) {
      return 'success';
    }
    if (value === 'needs_human' || value === 'review') return 'warning';
    if (value === 'rejected' || value === 'revoked' || value === 'denied') {
      return 'danger';
    }
    return 'neutral';
  }

  isPending(candidate: ReviewCandidate): boolean {
    return candidate.status === 'needs_human';
  }

  canRevoke(candidate: ReviewCandidate): boolean {
    return (
      candidate.status === 'approved' ||
      candidate.status === 'auto_approved' ||
      candidate.status === 'published'
    );
  }

  showMore(): boolean {
    return (
      this.candidates.length > 0 && this.candidates.length % this.limit === 0
    );
  }
}
