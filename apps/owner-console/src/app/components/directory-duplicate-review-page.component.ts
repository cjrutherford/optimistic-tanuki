import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
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

export const DUPLICATE_STALE_MESSAGE = 'This pair changed since you opened it';

export type DuplicateState = 'queued' | 'kept_separate' | 'merged';
export type DuplicateRule = 'similar_name' | 'same_name_near';
export type DuplicateAction = 'merge' | 'keep_separate' | 'undo';
type StateFilter = DuplicateState | 'all';
type RuleFilter = DuplicateRule | 'all';
type Tab = 'queue' | 'sample';

export interface DuplicateCaseSummary {
  caseId: string;
  state: DuplicateState;
  rule: DuplicateRule;
  weakerBasis: string;
  distanceMeters: number;
  keptName: string | null;
  hiddenName: string | null;
  createdAt: string;
}

export interface DuplicateListingView {
  name: string | null;
  category: string | null;
  addresses: string[];
  phones: string[];
  websites: string[];
  sources: string[];
  scanId: string;
  sourceFileRowNumber: string;
  hidden: boolean;
}

export interface DuplicateHistoryEvent {
  eventId: string;
  kind: string;
  actorId: string | null;
  note: string | null;
  createdAt: string;
}

export interface DuplicateCaseDetail extends DuplicateCaseSummary {
  decidedAt: string | null;
  keptListing: DuplicateListingView;
  hiddenListing: DuplicateListingView;
  history: DuplicateHistoryEvent[];
}

export interface DuplicatePage {
  cases: DuplicateCaseSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface WrongMergeReport {
  sampleSize: number;
  judged: number;
  unjudged: number;
  wrong: number;
  rate: number | null;
  upperBound95: number | null;
  limit: number;
  withinLimit: boolean;
  complete: boolean;
}

export interface DuplicateSample {
  sampleId: string;
  round: string;
  seed: string;
  populationSize: number;
  createdAt: string;
  createdById: string | null;
  report: WrongMergeReport;
}

export interface DuplicateSampleItem {
  caseId: string;
  state: DuplicateState;
  rule: DuplicateRule;
  distanceMeters: number;
  keptName: string | null;
  hiddenName: string | null;
  verdict: 'duplicate' | 'distinct' | null;
  judgedAt: string | null;
}

/**
 * Duplicate review (owner decisions D13 and D18). The queue is paged on the server and filtered by state and rule;
 * opening a pair shows both listings side by side with the hidden one marked. A reviewer confirms the duplicate
 * (merge), keeps the pair separate (the hidden listing returns) or undoes the last decision. Each decision carries
 * the state the reviewer saw, so a pair that moved is refused and reloaded. The sample tab draws a fixed, seeded
 * random sample of pairs for a review round, records the reviewer's verdicts and reports the wrong-merge rate
 * against the 2% limit.
 */
@Component({
  selector: 'app-directory-duplicate-review-page',
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
  templateUrl: './directory-duplicate-review-page.component.html',
  styleUrls: ['./directory-duplicate-review-page.component.scss'],
})
export class DirectoryDuplicateReviewPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');

  town = '';
  tab: Tab = 'queue';
  state: StateFilter = 'queued';
  rule: RuleFilter = 'all';
  cases: DuplicateCaseSummary[] = [];
  total = 0;
  details: Record<string, DuplicateCaseDetail> = {};
  loading = false;
  deciding = false;
  message = '';

  samples: DuplicateSample[] = [];
  samplesLoaded = false;
  openSample: { sample: DuplicateSample; items: DuplicateSampleItem[] } | null =
    null;
  judging = false;
  drawing = false;

  readonly limit = 25;
  private offset = 0;

  readonly states: Array<{ value: StateFilter; label: string }> = [
    { value: 'queued', label: 'Queued' },
    { value: 'merged', label: 'Merged' },
    { value: 'kept_separate', label: 'Kept separate' },
    { value: 'all', label: 'All' },
  ];
  readonly rules: Array<{ value: RuleFilter; label: string }> = [
    { value: 'all', label: 'Any reason' },
    { value: 'similar_name', label: 'Similar name' },
    { value: 'same_name_near', label: 'Same name, nearby' },
  ];

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.town = params.get('communityId') ?? '';
      this.details = {};
      this.openSample = null;
      this.samples = [];
      this.samplesLoaded = false;
      this.refresh();
    });
  }

  private get url(): string {
    return `${this.api}/directory/towns/${this.town}/duplicate-cases`;
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    if (tab === 'sample' && !this.samplesLoaded) this.loadSamples();
  }

  setState(state: StateFilter): void {
    this.state = state;
    this.refresh();
  }

  setRule(rule: RuleFilter): void {
    this.rule = rule;
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
    return this.cases.length < this.total;
  }

  private load(): void {
    if (!this.town) return;
    this.loading = true;
    const filters =
      (this.state === 'all' ? '' : `state=${this.state}&`) +
      (this.rule === 'all' ? '' : `rule=${this.rule}&`);
    this.http
      .get<DuplicatePage>(
        `${this.url}?${filters}limit=${this.limit}&offset=${this.offset}`
      )
      .subscribe({
        next: (result) => {
          this.loading = false;
          this.total = result.total ?? 0;
          this.cases =
            this.offset === 0
              ? result.cases ?? []
              : [...this.cases, ...(result.cases ?? [])];
        },
        error: () => {
          this.loading = false;
          this.message =
            'The duplicate queue is unavailable. Please try again.';
        },
      });
  }

  toggle(c: DuplicateCaseSummary): void {
    if (this.details[c.caseId]) {
      const { [c.caseId]: _closed, ...rest } = this.details;
      this.details = rest;
      return;
    }
    this.loadDetail(c.caseId);
  }

  private loadDetail(caseId: string): void {
    this.http.get<DuplicateCaseDetail>(`${this.url}/${caseId}`).subscribe({
      next: (detail) => {
        this.details = { ...this.details, [caseId]: detail };
        this.cases = this.cases.map((c) =>
          c.caseId === caseId ? { ...c, state: detail.state } : c
        );
      },
      error: () => {
        this.message = 'The pair detail is unavailable. Try again.';
      },
    });
  }

  /** The pair moved under the reviewer: say so and show its current state. */
  private stale(): void {
    this.message = DUPLICATE_STALE_MESSAGE;
    for (const id of Object.keys(this.details)) this.loadDetail(id);
  }

  canDecide(c: DuplicateCaseSummary): boolean {
    return c.state === 'queued';
  }

  decide(
    c: DuplicateCaseSummary,
    action: DuplicateAction,
    reason: string
  ): void {
    if (this.deciding) return;
    const why = reason.trim();
    if (!why) {
      this.message = 'A reason is required for every decision.';
      return;
    }
    this.deciding = true;
    this.message = '';
    this.http
      .post<{ recorded: boolean; replayed: boolean; state: DuplicateState }>(
        `${this.url}/${c.caseId}/decide`,
        { action, reason: why, expectedState: c.state }
      )
      .subscribe({
        next: (result) => {
          this.deciding = false;
          this.message = result.replayed
            ? 'That decision was already recorded.'
            : 'Decision recorded.';
          this.loadDetail(c.caseId);
        },
        error: (error: HttpErrorResponse) => {
          this.deciding = false;
          if (error?.status === 409) {
            this.stale();
            return;
          }
          this.message =
            error?.status === 400
              ? 'The decision was refused. Check the reason.'
              : 'The decision could not be recorded. Try again.';
        },
      });
  }

  undo(c: DuplicateCaseSummary, request: DecisionUndoRequest): void {
    this.decide(c, 'undo', request.reason);
  }

  historyEntries(caseId: string): DecisionHistoryEntry[] {
    const detail = this.details[caseId];
    const events = detail?.history ?? [];
    const last = events.length - 1;
    return events.map((h, i) => ({
      id: h.eventId,
      label: h.kind.replace(/_/g, ' ').replace(/^./, (ch) => ch.toUpperCase()),
      actor: h.actorId ?? 'System',
      at: h.createdAt,
      reason: h.note ?? '',
      isUndo: h.kind === 'undone',
      reversible:
        i === last &&
        (h.kind === 'merged' || h.kind === 'kept_separate') &&
        detail.state !== 'queued',
    }));
  }

  ruleLabel(rule: string): string {
    return (
      this.rules.find((r) => r.value === rule)?.label ?? rule.replace(/_/g, ' ')
    );
  }

  badgeTone(state: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (state === 'queued') return 'warning';
    if (state === 'merged') return 'danger';
    return 'success';
  }

  stateLabel(state: string): string {
    return this.states.find((s) => s.value === state)?.label ?? state;
  }

  // ---- D18 wrong-merge sample ----

  private loadSamples(): void {
    this.http
      .get<{ samples: DuplicateSample[] }>(`${this.url}/samples`)
      .subscribe({
        next: (result) => {
          this.samples = result.samples ?? [];
          this.samplesLoaded = true;
        },
        error: () => {
          this.message = 'The samples are unavailable. Please try again.';
        },
      });
  }

  draw(round: string, size: string, seed: string): void {
    if (this.drawing) return;
    const body: { round: string; size?: number; seed?: string } = {
      round: round.trim(),
    };
    if (!body.round) {
      this.message = 'A review round name is required.';
      return;
    }
    if (size.trim()) {
      const n = Number(size);
      if (!Number.isInteger(n) || n < 1 || n > 1000) {
        this.message = 'The sample size must be a whole number from 1 to 1000.';
        return;
      }
      body.size = n;
    }
    if (seed.trim()) body.seed = seed.trim();
    this.drawing = true;
    this.message = '';
    this.http
      .post<{ replayed: boolean; sample: DuplicateSample }>(
        `${this.url}/samples`,
        body
      )
      .subscribe({
        next: (result) => {
          this.drawing = false;
          this.message = result.replayed
            ? 'That round already has a sample; showing it.'
            : 'Sample drawn and recorded.';
          this.loadSamples();
          this.showSample(result.sample.sampleId);
        },
        error: (error: HttpErrorResponse) => {
          this.drawing = false;
          this.message =
            error?.status === 400
              ? 'The sample was refused. Check the round, size and seed.'
              : 'The sample could not be drawn. Try again.';
        },
      });
  }

  showSample(sampleId: string): void {
    this.http
      .get<{ sample: DuplicateSample; items: DuplicateSampleItem[] }>(
        `${this.url}/samples/${sampleId}`
      )
      .subscribe({
        next: (result) => {
          this.openSample = result;
        },
        error: () => {
          this.message = 'The sample is unavailable. Try again.';
        },
      });
  }

  judge(item: DuplicateSampleItem, verdict: 'duplicate' | 'distinct'): void {
    if (this.judging || !this.openSample) return;
    const { sampleId } = this.openSample.sample;
    this.judging = true;
    this.message = '';
    this.http
      .post<{ replayed: boolean; report: WrongMergeReport }>(
        `${this.url}/samples/${sampleId}/judge`,
        { caseId: item.caseId, verdict }
      )
      .subscribe({
        next: () => {
          this.judging = false;
          this.showSample(sampleId);
          this.loadSamples();
        },
        error: () => {
          this.judging = false;
          this.message = 'The judgement could not be recorded. Try again.';
        },
      });
  }

  percent(value: number | null): string {
    return value === null ? 'n/a' : `${(value * 100).toFixed(2)}%`;
  }

  verdictLine(r: WrongMergeReport): string {
    if (!r.complete)
      return `${r.unjudged} of ${r.sampleSize} pairs are still unjudged.`;
    return r.withinLimit
      ? 'Within the limit: the 95% upper bound is at or below it.'
      : 'Not within the limit: the 95% upper bound is above it.';
  }
}
