import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import type {
  AcquisitionBudgetPanel,
  AcquisitionImportHistoryResult,
  AcquisitionJobRecord,
  AcquisitionRunAction,
  AcquisitionRunActionResult,
  AcquisitionRunDetail,
  AcquisitionRunList,
  AcquisitionRunQuality,
  AcquisitionRunStatus,
  AcquisitionRunSummary,
} from '@optimistic-tanuki/social-contracts';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  LoadingStateComponent,
} from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QualityRow {
  label: string;
  value: string;
  limit: string;
  breached: boolean;
}

export const ACQUISITION_POLL_MS = 3000;
const ACTIVE: AcquisitionRunStatus[] = [
  'queued',
  'running',
  'cancel_requested',
];
const RESUMABLE: AcquisitionRunStatus[] = [
  'partial',
  'failed_retryable',
  'cancelled',
  'blocked',
];
const CONFIRM_WORD: Record<
  AcquisitionRunAction,
  'CANCEL' | 'RESUME' | 'RETRY'
> = { cancel: 'CANCEL', resume: 'RESUME', retry: 'RETRY' };
const FILTERS: Array<AcquisitionRunStatus | ''> = [
  '',
  'running',
  'queued',
  'partial',
  'blocked',
  'failed_retryable',
  'succeeded',
  'cancelled',
];
const BLOCKED_TEXT: Record<string, string> = {
  acquisition_unauthorized:
    'Real acquisition is not authorised yet, so this run cannot be resumed.',
  budget_exhausted:
    'The monthly provider budget is used up. It can be resumed once the budget allows.',
  quota_exhausted: 'The provider quota is exhausted. Start a new run later.',
  policy_blocked: 'A source policy blocks this run. Start a new run.',
  unconfigured_provider: 'The provider is not configured for this run.',
  invalid_geometry: 'The town boundary is invalid for this run.',
};

/** What the gateway returns for a town run request. */
interface AcquisitionTownRunResult {
  communityId: string;
  replayed: boolean;
  alreadyPending: boolean;
  requestedAt: string;
  providers: string[];
}

/**
 * Acquisition runs. The ledger is written by the local stage scripts, so an operator observes progress here and
 * records requests (cancel, resume, retry one job). A resume or retry never starts work itself: it queues the request
 * and shows the command the operator runs locally, which consumes it. Every write names a reason and a typed
 * confirmation, echoes the run's version token (a stale token is refused) and carries one id per attempt.
 */
@Component({
  selector: 'app-directory-acquisition-runs-page',
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
    TextInputComponent,
  ],
  templateUrl: './directory-acquisition-runs-page.component.html',
  styleUrls: ['./directory-acquisition-runs-page.component.scss'],
})
export class DirectoryAcquisitionRunsPageComponent
  implements OnInit, OnDestroy
{
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');

  readonly filters = FILTERS;
  runs: AcquisitionRunSummary[] = [];
  total = 0;
  budget: AcquisitionBudgetPanel | null = null;
  selected: AcquisitionRunDetail | null = null;
  filter: AcquisitionRunStatus | '' = '';
  loading = false;
  busy = false;
  message = '';
  command = '';
  typed = '';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private readonly ids = new Map<string, string>();

  ngOnInit(): void {
    this.loadBudget();
    this.load(true);
  }

  ngOnDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  inFlight(): boolean {
    return (
      this.runs.some((r) => ACTIVE.includes(r.status)) ||
      (!!this.selected && ACTIVE.includes(this.selected.status))
    );
  }

  private loadBudget(): void {
    this.http
      .get<AcquisitionBudgetPanel>(`${this.api}/directory/runs/budget`)
      .subscribe({
        next: (budget) => (this.budget = budget),
        error: () => (this.message = 'The budget panel is unavailable.'),
      });
  }

  private load(initial = false): void {
    if (initial) this.loading = true;
    const status = this.filter ? `&status=${this.filter}` : '';
    this.http
      .get<AcquisitionRunList>(`${this.api}/directory/runs?limit=25${status}`)
      .subscribe({
        next: (result) => {
          this.loading = false;
          this.runs = result.runs ?? [];
          this.total = result.total ?? this.runs.length;
          if (this.selected) this.refreshSelected();
          else this.schedule();
        },
        error: () => {
          this.loading = false;
          this.message = 'Runs are unavailable. Retrying.';
          this.schedule();
        },
      });
  }

  private refreshSelected(): void {
    const id = this.selected?.id;
    if (!id) return this.schedule();
    this.http
      .get<AcquisitionRunDetail>(`${this.api}/directory/runs/${id}`)
      .subscribe({
        next: (detail) => {
          if (this.selected?.id === id) this.selected = detail;
          this.schedule();
        },
        error: () => this.schedule(),
      });
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.stopped || !this.inFlight()) return;
    this.timer = setTimeout(() => {
      this.loadBudget();
      this.load();
    }, ACQUISITION_POLL_MS);
  }

  setFilter(status: AcquisitionRunStatus | ''): void {
    this.filter = status;
    this.load(true);
  }

  select(run: AcquisitionRunSummary): void {
    this.typed = '';
    this.command = '';
    this.message = '';
    this.http
      .get<AcquisitionRunDetail>(`${this.api}/directory/runs/${run.id}`)
      .subscribe({
        next: (detail) => {
          this.selected = detail;
          this.schedule();
        },
        error: () => (this.message = 'That run could not be loaded.'),
      });
  }

  close(): void {
    this.selected = null;
    this.typed = '';
    this.command = '';
  }

  setTyped(value: string): void {
    this.typed = value;
  }

  // ---- what an operator may ask for ----------------------------------------------------------------------------

  canCancel(r: AcquisitionRunDetail): boolean {
    return r.status === 'queued' || r.status === 'running';
  }

  canResume(r: AcquisitionRunDetail): boolean {
    return RESUMABLE.includes(r.status) && !r.pendingRequest;
  }

  canRetry(r: AcquisitionRunDetail, job: AcquisitionJobRecord): boolean {
    return (
      r.kind !== 'historical' &&
      !ACTIVE.includes(r.status) &&
      ['partial', 'failed_retryable', 'cancelled'].includes(job.status) &&
      !r.pendingRequest
    );
  }

  /** Why a resume would be refused right now, so the operator is told before typing anything. */
  resumeBlock(r: AcquisitionRunDetail): string {
    if (r.kind === 'historical')
      return 'This is an imported history record; there is nothing to resume.';
    if (r.pendingRequest)
      return 'A request is already waiting for the local stage.';
    if (r.status !== 'blocked' || !r.blockedReason) return '';
    return BLOCKED_TEXT[r.blockedReason] ?? 'This run is blocked.';
  }

  blockedText(reason: string | null): string {
    return reason ? BLOCKED_TEXT[reason] ?? reason : '';
  }

  confirmWord(action: AcquisitionRunAction): string {
    return CONFIRM_WORD[action];
  }

  confirmed(action: AcquisitionRunAction): boolean {
    return this.typed === CONFIRM_WORD[action];
  }

  progress(r: AcquisitionRunDetail): number {
    return r.completeness.total
      ? Math.round((100 * r.completeness.done) / r.completeness.total)
      : 0;
  }

  // ---- writes ----------------------------------------------------------------------------------------------------

  private idFor(key: string): string {
    const id = this.ids.get(key) ?? crypto.randomUUID();
    this.ids.set(key, id);
    return id;
  }

  private failed(key: string, error: HttpErrorResponse, what: string): void {
    this.busy = false;
    if (error?.status === 409 || error?.status === 400) this.ids.delete(key);
    const body = error?.error as { code?: string; reason?: string } | undefined;
    this.message =
      error?.status === 409
        ? body?.code === 'run_blocked'
          ? `${what} was refused: ${this.blockedText(body.reason ?? null)}`
          : `${what} was refused: the run changed since you opened it. It has been reloaded.`
        : error?.status === 400
        ? `${what} was refused. Check the reason and the typed confirmation.`
        : `${what} could not be recorded. Try again.`;
    if (error?.status === 409 && this.selected) this.refreshSelected();
  }

  act(action: AcquisitionRunAction, reason: string, unitKey?: string): void {
    const run = this.selected;
    if (this.busy || !run) return;
    if (!this.confirmed(action)) {
      this.message = `Type ${CONFIRM_WORD[action]} to confirm.`;
      return;
    }
    if (!reason.trim()) {
      this.message = 'A reason is required.';
      return;
    }
    const key = `${action}:${run.id}:${unitKey ?? ''}:${run.versionToken}`;
    this.busy = true;
    this.message = '';
    this.http
      .post<AcquisitionRunActionResult>(
        `${this.api}/directory/runs/${run.id}/${action}`,
        {
          decisionId: this.idFor(key),
          reason: reason.trim(),
          expectedVersionToken: run.versionToken,
          confirm: CONFIRM_WORD[action],
          ...(unitKey ? { unitKey } : {}),
        }
      )
      .subscribe({
        next: (result) => {
          this.busy = false;
          this.ids.delete(key);
          this.typed = '';
          this.selected = result.run;
          this.command = result.resumeCommand ?? '';
          this.message =
            action === 'cancel'
              ? 'Cancel recorded. A running stage stops after its current batch.'
              : 'Request recorded. Nothing runs from here: run the command below on the machine that holds the data.';
          this.loadBudget();
          this.load();
        },
        error: (error: HttpErrorResponse) =>
          this.failed(key, error, `The ${action}`),
      });
  }

  importHistory(reason: string): void {
    if (this.busy) return;
    if (!reason.trim()) {
      this.message = 'A reason is required to import history.';
      return;
    }
    const key = `history:${reason.trim()}`;
    this.busy = true;
    this.message = '';
    this.http
      .post<AcquisitionImportHistoryResult>(
        `${this.api}/directory/runs/history/import`,
        { decisionId: this.idFor(key), reason: reason.trim() }
      )
      .subscribe({
        next: (result) => {
          this.busy = false;
          this.ids.delete(key);
          this.message = `History imported: ${result.created} added, ${result.existing} already there.`;
          this.load();
        },
        error: (error: HttpErrorResponse) =>
          this.failed(key, error, 'The history import'),
      });
  }

  /** Asks for one town to be acquired first on the next sweep. The sweep still checks authorization, budget and the kill switch. */
  runTownNow(townId: string, reason: string, confirm: string): void {
    const id = townId.trim();
    if (this.busy) return;
    if (!UUID.test(id)) {
      this.message = 'Enter the town id (a UUID).';
      return;
    }
    if (!reason.trim()) {
      this.message = 'A reason is required.';
      return;
    }
    if (confirm.trim() !== 'RUN') {
      this.message = 'Type RUN to confirm.';
      return;
    }
    const key = `town:${id}:${reason.trim()}`;
    this.busy = true;
    this.message = '';
    this.http
      .post<AcquisitionTownRunResult>(
        `${this.api}/directory/runs/towns/${id}/run`,
        { decisionId: this.idFor(key), reason: reason.trim(), confirm: 'RUN' }
      )
      .subscribe({
        next: (result) => {
          this.busy = false;
          this.ids.delete(key);
          this.message = result.alreadyPending
            ? 'This town already has a pending request. It goes first on the next sweep.'
            : 'Request recorded. The town goes first on the next sweep, which still checks authorization, budget and the kill switch.';
        },
        error: (error: HttpErrorResponse) =>
          this.failed(key, error, 'The town request'),
      });
  }

  async copyCommand(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.command);
      this.message = 'Command copied.';
    } catch {
      this.message =
        'Copy is unavailable here. Select the command and copy it.';
    }
  }

  /** One row per scorecard measure: value, the limit it was held to, and whether it was breached. */
  qualityRows(q: AcquisitionRunQuality): QualityRow[] {
    const pct = (n: number | undefined) =>
      typeof n === 'number' ? `${(n * 100).toFixed(1)}%` : 'n/a';
    const row = (
      label: string,
      value: number,
      key: string,
      kind: 'min' | 'max'
    ): QualityRow => ({
      label,
      value: pct(value),
      limit:
        q.limits[key] === undefined
          ? 'none'
          : `${kind === 'min' ? 'at least' : 'at most'} ${pct(q.limits[key])}`,
      breached: q.breaches.includes(key),
    });
    return [
      row('Name present', q.completeness.name, 'minNameCompleteness', 'min'),
      row(
        'Category present',
        q.completeness.category,
        'minCategoryCompleteness',
        'min'
      ),
      row(
        'Address present',
        q.completeness.address,
        'minAddressCompleteness',
        'min'
      ),
      row('Phone present', q.completeness.phone, 'minPhoneCompleteness', 'min'),
      row(
        'Website present',
        q.completeness.website,
        'minWebsiteCompleteness',
        'min'
      ),
      row('Hours present', q.completeness.hours, 'minHoursCompleteness', 'min'),
      row(
        'Invalid address',
        q.invalid.addressRate,
        'maxInvalidAddressRate',
        'max'
      ),
      row('Invalid phone', q.invalid.phoneRate, 'maxInvalidPhoneRate', 'max'),
      row(
        'Outside boundary',
        q.outOfBoundary.rate,
        'maxOutOfBoundaryRate',
        'max'
      ),
      row('In-run duplicates', q.duplicates.rate, 'maxDuplicateRate', 'max'),
    ];
  }

  badgeTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'succeeded' || status === 'succeeded_empty')
      return 'success';
    if (status === 'failed_permanent' || status === 'blocked') return 'danger';
    if (
      ACTIVE.includes(status as AcquisitionRunStatus) ||
      status === 'partial' ||
      status === 'failed_retryable'
    )
      return 'warning';
    return 'neutral';
  }

  label(value: string): string {
    return value.replace(/_/g, ' ');
  }
}
