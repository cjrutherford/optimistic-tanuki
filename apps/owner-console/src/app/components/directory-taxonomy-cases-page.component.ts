import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  DIRECTORY_TAXONOMY_CATEGORIES,
  DIRECTORY_TAXONOMY_PLACE_TYPES,
  type TaxonomyCaseDetail,
  type TaxonomyCaseStatus,
  type TaxonomyCaseSummary,
  type TaxonomyDecisionAction,
  type TaxonomyRaiseCaseResult,
} from '@optimistic-tanuki/social-contracts/directory';
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

export const TAXONOMY_STALE_MESSAGE = 'This case changed since you opened it';
type StatusFilter = TaxonomyCaseStatus | 'all';

/**
 * Taxonomy cases: an operator corrects the category of one listing. An assignment is an override that
 * outranks the mapping and survives rescans of the same business; every decision is audited and reversible.
 * The adult category is never assignable here.
 */
@Component({
  selector: 'app-directory-taxonomy-cases-page',
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
  templateUrl: './directory-taxonomy-cases-page.component.html',
  styleUrls: ['./directory-taxonomy-cases-page.component.scss'],
})
export class DirectoryTaxonomyCasesPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');

  status: StatusFilter = 'open';
  cases: TaxonomyCaseSummary[] = [];
  details: Record<string, TaxonomyCaseDetail> = {};
  loading = false;
  undoing = false;
  raising = false;
  message = '';
  private readonly limit = 25;
  private offset = 0;
  // One id per attempt: a retry after a network error replays instead of duplicating.
  private readonly decisionIds = new Map<string, string>();
  private raiseId: string | null = null;

  readonly statuses: Array<{ value: StatusFilter; label: string }> = [
    { value: 'open', label: 'Open' },
    { value: 'deferred', label: 'Deferred' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
  ];
  /** The operator cannot assign adult: adult rows are served only to a visitor who opted in. */
  readonly categories = DIRECTORY_TAXONOMY_CATEGORIES.filter(
    (c) => c.id !== 'adult'
  );

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
    this.http
      .get<{ cases: TaxonomyCaseSummary[] }>(
        `${this.api}/directory/taxonomy/cases?${filter}limit=${this.limit}&offset=${this.offset}`
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
          this.message = 'The taxonomy queue is unavailable. Please try again.';
        },
      });
  }

  private readonly choices: Record<
    string,
    { category: string; place: string }
  > = {};

  choice(id: string): { category: string; place: string } {
    return (this.choices[id] ??= { category: '', place: '' });
  }

  setCategory(id: string, event: Event): void {
    this.choice(id).category = (event.target as HTMLSelectElement).value;
    this.choice(id).place = '';
  }

  setPlace(id: string, event: Event): void {
    this.choice(id).place = (event.target as HTMLSelectElement).value;
  }

  placeTypesFor(categoryId: string) {
    return DIRECTORY_TAXONOMY_PLACE_TYPES.filter(
      (p) => p.categoryId === categoryId
    );
  }

  categoryLabel(id: string | null): string {
    return (
      DIRECTORY_TAXONOMY_CATEGORIES.find((c) => c.id === id)?.label ??
      id ??
      'None'
    );
  }

  raise(townId: string, listingId: string, reason: string): void {
    if (this.raising) return;
    if (!townId.trim() || !listingId.trim() || !reason.trim()) {
      this.message = 'A town id, a listing id and a reason are required.';
      return;
    }
    this.raising = true;
    this.message = '';
    this.raiseId ??= crypto.randomUUID();
    this.http
      .post<TaxonomyRaiseCaseResult>(`${this.api}/directory/taxonomy/cases`, {
        caseId: this.raiseId,
        townId: townId.trim(),
        listingId: listingId.trim(),
        reason: reason.trim(),
      })
      .subscribe({
        next: (result) => {
          this.raising = false;
          this.raiseId = null;
          this.message = result.replayed
            ? 'That listing already has an open case.'
            : 'Case raised.';
          this.refresh();
        },
        error: (error: HttpErrorResponse) => {
          this.raising = false;
          if (error?.status === 400 || error?.status === 404)
            this.raiseId = null;
          this.message =
            error?.status === 404
              ? 'That listing was not found in that town.'
              : 'The case could not be raised. Try again.';
        },
      });
  }

  toggle(taxonomyCase: TaxonomyCaseSummary): void {
    if (this.details[taxonomyCase.id]) {
      const { [taxonomyCase.id]: _closed, ...rest } = this.details;
      this.details = rest;
      return;
    }
    this.loadDetail(taxonomyCase.id);
  }

  private loadDetail(id: string): void {
    this.http
      .get<TaxonomyCaseDetail>(`${this.api}/directory/taxonomy/cases/${id}`)
      .subscribe({
        next: (detail) => {
          this.details = { ...this.details, [id]: detail };
          this.cases = this.cases.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: detail.status,
                  versionToken: detail.versionToken,
                  assignedCategoryId: detail.assignedCategoryId,
                  assignedPlaceTypeId: detail.assignedPlaceTypeId,
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
    this.message = TAXONOMY_STALE_MESSAGE;
    for (const id of Object.keys(this.details)) this.loadDetail(id);
  }

  canAssign(c: TaxonomyCaseSummary): boolean {
    return c.status === 'open' || c.status === 'deferred';
  }

  canReject(c: TaxonomyCaseSummary): boolean {
    return c.status === 'open' || c.status === 'deferred';
  }

  canDefer(c: TaxonomyCaseSummary): boolean {
    return c.status === 'open';
  }

  canReopen(c: TaxonomyCaseSummary): boolean {
    return c.status === 'rejected';
  }

  decide(
    c: TaxonomyCaseSummary,
    action: TaxonomyDecisionAction,
    reason: string,
    categoryId = '',
    placeTypeId = ''
  ): void {
    const why = reason.trim();
    if (!why) {
      this.message = 'A reason is required for every taxonomy decision.';
      return;
    }
    const body: Record<string, unknown> = {
      action,
      reason: why,
      expectedVersionToken: c.versionToken,
    };
    if (action === 'assign') {
      if (!categoryId) {
        this.message = 'Choose the category to assign.';
        return;
      }
      body['categoryId'] = categoryId;
      if (placeTypeId) body['placeTypeId'] = placeTypeId;
    }
    const key = `${c.id}:${action}:${categoryId}:${placeTypeId}`;
    const decisionId = this.decisionIds.get(key) ?? crypto.randomUUID();
    this.decisionIds.set(key, decisionId);
    this.message = '';
    this.http
      .post<{ recorded: boolean; status: string }>(
        `${this.api}/directory/taxonomy/cases/${c.id}/decisions`,
        { ...body, decisionId }
      )
      .subscribe({
        next: () => {
          this.decisionIds.delete(key);
          this.message = `Recorded ${action}.`;
          this.loadDetail(c.id);
        },
        error: (error: HttpErrorResponse) => {
          if (error?.status === 409) {
            this.decisionIds.delete(key);
            this.stale();
            return;
          }
          this.message =
            error?.status === 400
              ? 'The decision was refused. Check the category and the reason.'
              : 'The decision could not be recorded. Try again.';
        },
      });
  }

  historyEntries(id: string): DecisionHistoryEntry[] {
    return (this.details[id]?.history ?? []).map((h) => ({
      id: h.decisionId,
      label: (h.action === 'assign' && h.categoryId
        ? `Assign ${this.categoryLabel(h.categoryId)}`
        : h.action
      ).replace(/^./, (ch) => ch.toUpperCase()),
      actor: h.actorId,
      at: h.createdAt,
      reason: h.reason ?? '',
      undone: !!h.undoneBy,
      isUndo: !!h.undoOf,
      reversible: h.reversible,
    }));
  }

  undo(c: TaxonomyCaseSummary, request: DecisionUndoRequest): void {
    if (this.undoing) return;
    this.undoing = true;
    this.message = '';
    this.http
      .post<{ recorded: boolean; status: string }>(
        `${this.api}/directory/taxonomy/cases/${c.id}/undo`,
        {
          decisionId: crypto.randomUUID(),
          undoOf: request.entry.id,
          expectedVersionToken: c.versionToken,
          reason: request.reason,
        }
      )
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
    if (status === 'assigned') return 'success';
    if (status === 'open') return 'warning';
    if (status === 'rejected') return 'danger';
    return 'neutral';
  }
}
