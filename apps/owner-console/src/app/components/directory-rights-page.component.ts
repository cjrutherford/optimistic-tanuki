import { DirectoryAdminService } from '../services/directory-admin.service';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import type {
  RightsCaseDetail,
  RightsCaseStatus,
  RightsCaseSummary,
  RightsDecisionAction,
  RightsSyncResult,
} from '@optimistic-tanuki/social-contracts';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  DecisionHistoryComponent,
  type DecisionHistoryEntry,
  type DecisionUndoRequest,
  EmptyStateComponent,
  IconComponent,
  LoadingStateComponent,
} from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';

export const STALE_MESSAGE = 'This case changed since you opened it';
const SHA256 = /^[0-9a-f]{64}$/;

type StatusFilter = RightsCaseStatus | 'all';

/**
 * Rights cases: the operator reads what a source's terms allow and records a
 * decision. A decision never grants public display. It excludes a field from
 * what could be shown, records that the terms were read, or parks the case.
 */
@Component({
  selector: 'app-directory-rights-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    DecisionHistoryComponent,
    EmptyStateComponent,
    IconComponent,
    LoadingStateComponent,
    TextInputComponent,
  ],
  templateUrl: './directory-rights-page.component.html',
  styleUrls: ['./directory-rights-page.component.scss'],
})
export class DirectoryRightsPageComponent implements OnInit {
  private readonly admin = inject(DirectoryAdminService);

  status: StatusFilter = 'review';
  cases: RightsCaseSummary[] = [];
  details: Record<string, RightsCaseDetail> = {};
  loading = false;
  message = '';
  undoing = false;
  syncing = false;
  private readonly limit = 25;
  private offset = 0;
  // One id per attempt: a retry after a network error replays instead of duplicating.
  private readonly decisionIds = new Map<string, string>();
  private syncId: string | null = null;

  readonly statuses: Array<{ value: StatusFilter; label: string }> = [
    { value: 'review', label: 'Needs review' },
    { value: 'excluded', label: 'Excluded' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'withdrawn', label: 'Withdrawn' },
    { value: 'all', label: 'All' },
  ];

  ngOnInit(): void {
    this.refresh();
  }

  setStatus(status: StatusFilter): void {
    this.status = status;
    this.refresh();
  }

  refresh(): void {
    this.cases = [];
    this.offset = 0;
    this.load();
  }

  loadMore(): void {
    this.offset = this.cases.length;
    this.load();
  }

  showMore(): boolean {
    return this.cases.length > 0 && this.cases.length % this.limit === 0;
  }

  private load(): void {
    this.loading = true;
    const filter = this.status === 'all' ? '' : `status=${this.status}&`;
    this.admin
      .listRightsCases<{ cases: RightsCaseSummary[] }>(
        `${filter}limit=${this.limit}&offset=${this.offset}`
      )
      .subscribe({
        next: (result) => {
          this.loading = false;
          this.cases =
            this.offset === 0
              ? result.cases ?? []
              : [...this.cases, ...(result.cases ?? [])];
        },
        error: () => {
          this.loading = false;
          this.message = 'The rights queue is unavailable. Please try again.';
        },
      });
  }

  sync(releaseId: string): void {
    const release = releaseId.trim();
    if (release && !/^[A-Za-z0-9._-]{1,100}$/.test(release)) {
      this.message = 'Enter the release id, for example 2026-01-01.0.';
      return;
    }
    if (this.syncing) return;
    this.syncing = true;
    this.message = '';
    this.syncId ??= crypto.randomUUID();
    this.admin
      .syncRightsCases<RightsSyncResult>({
        syncId: this.syncId,
        ...(release ? { releaseId: release } : {}),
      })
      .subscribe({
        next: (result) => {
          this.syncing = false;
          this.syncId = null;
          this.message = `Sync complete: ${result.created} new, ${
            result.existing
          } already known${
            result.resolved
              ? `, ${result.resolved} resolved by the approved policy`
              : ''
          }.`;
          this.refresh();
        },
        error: () => {
          this.syncing = false;
          this.message = 'The sync could not run. Try again.';
        },
      });
  }

  toggle(rightsCase: RightsCaseSummary): void {
    if (this.details[rightsCase.id]) {
      const { [rightsCase.id]: _closed, ...rest } = this.details;
      this.details = rest;
      return;
    }
    this.loadDetail(rightsCase.id);
  }

  private loadDetail(id: string): void {
    this.admin.getRightsCase<RightsCaseDetail>(id).subscribe({
      next: (detail) => {
        this.details = { ...this.details, [id]: detail };
        this.cases = this.cases.map((c) =>
          c.id === id
            ? {
                ...c,
                status: detail.status,
                versionToken: detail.versionToken,
              }
            : c
        );
      },
      error: () => {
        this.message = 'The case detail is unavailable. Try again.';
      },
    });
  }

  /** The case moved under the operator: say so and show its current state. */
  private stale(): void {
    const open = Object.keys(this.details);
    this.message = STALE_MESSAGE;
    for (const id of open) this.loadDetail(id);
  }

  canExclude(c: RightsCaseSummary): boolean {
    return c.scope === 'field' && c.status === 'review';
  }

  canConfirm(c: RightsCaseSummary): boolean {
    return !c.ambiguous && c.status === 'review';
  }

  canDefer(c: RightsCaseSummary): boolean {
    return c.status === 'review';
  }

  canReopen(c: RightsCaseSummary): boolean {
    return c.status === 'excluded' || c.status === 'resolved';
  }

  decide(
    c: RightsCaseSummary,
    action: RightsDecisionAction,
    reason: string,
    termsUrl: string,
    termsSha256: string
  ): void {
    const why = reason.trim();
    if (!why) {
      this.message = 'A reason is required for every rights decision.';
      return;
    }
    const body: Record<string, unknown> = {
      action,
      reason: why,
      expectedVersionToken: c.versionToken,
    };
    if (action === 'confirm_terms') {
      if (
        !/^https:\/\//.test(termsUrl.trim()) ||
        !SHA256.test(termsSha256.trim())
      ) {
        this.message =
          'Confirming terms needs an HTTPS terms URL and the SHA-256 of the terms you read.';
        return;
      }
      body['termsUrl'] = termsUrl.trim();
      body['termsSha256'] = termsSha256.trim();
    }
    const key = `${c.id}:${action}`;
    const decisionId = this.decisionIds.get(key) ?? crypto.randomUUID();
    this.decisionIds.set(key, decisionId);
    this.message = '';
    this.admin
      .decideRightsCase<{ recorded: boolean; status: string }>(c.id, {
        ...body,
        decisionId,
      })
      .subscribe({
        next: () => {
          this.decisionIds.delete(key);
          this.message = `Recorded ${action.replace('_', ' ')}.`;
          this.loadDetail(c.id);
        },
        error: (error: HttpErrorResponse) => {
          if (error?.status === 409) {
            this.decisionIds.delete(key);
            this.stale();
            return;
          }
          this.message = 'The decision could not be recorded. Try again.';
        },
      });
  }

  historyEntries(id: string): DecisionHistoryEntry[] {
    return (this.details[id]?.history ?? []).map((h) => ({
      id: h.decisionId,
      label: h.action.replace('_', ' ').replace(/^./, (ch) => ch.toUpperCase()),
      actor: h.actorId,
      at: h.createdAt,
      reason: h.reason,
      undone: !!h.undoneBy,
      isUndo: !!h.undoOf,
      reversible: h.reversible,
    }));
  }

  undo(c: RightsCaseSummary, request: DecisionUndoRequest): void {
    if (this.undoing) return;
    this.undoing = true;
    this.message = '';
    this.admin
      .undoRightsCaseDecision<{ recorded: boolean; status: string }>(c.id, {
        decisionId: crypto.randomUUID(),
        undoOf: request.entry.id,
        expectedVersionToken: c.versionToken,
        reason: request.reason,
      })
      .subscribe({
        next: () => {
          this.undoing = false;
          this.message = `Undid the ${request.entry.label.toLowerCase()} decision.`;
          this.loadDetail(c.id);
        },
        error: (error: HttpErrorResponse) => {
          this.undoing = false;
          if (error?.status === 409) {
            this.stale();
            return;
          }
          this.message = 'The undo could not be recorded. Try again.';
        },
      });
  }

  badgeTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'resolved') return 'success';
    if (status === 'review') return 'warning';
    if (status === 'excluded' || status === 'withdrawn') return 'danger';
    return 'neutral';
  }
}
