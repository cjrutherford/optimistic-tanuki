import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  OptomisitcTanukiAPIService as CivicAPIService,
  problem,
  type RequestsStatus,
  type SourceDecisionEntry,
  type SourceHealthEntry,
  type SourceOverride,
  type SourceRequestEntry,
} from '@optimistic-tanuki/civic-briefing-data-access';
import { catchError, map, of, startWith, type Observable } from 'rxjs';
import type { DaylightTownFilter } from './daylight-ops-access';

type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'failed'; message: string };

/** A town the panels can be pointed at. */
export interface DaylightSourceTown {
  slug: string;
  name: string;
}

/** Rows per page of the decision log and the request queue. */
export const SOURCES_PAGE_SIZE = 25;

/** What the operator is about to do, awaiting a reason. */
type Action =
  | { kind: 'block'; panel: 'health' | 'overrides'; sourceKey: string }
  | { kind: 'clear'; panel: 'overrides'; override: SourceOverride }
  | {
      kind: 'approved' | 'rejected';
      panel: 'requests';
      request: SourceRequestEntry;
    };

/** A reply whose body is missing or has the wrong shape is a failed load, not an empty one. */
function body<T>(data: T | null | undefined): T {
  if (data === null || data === undefined || typeof data !== 'object') {
    throw new Error('The reply had no data.');
  }
  return data;
}

function list<T>(value: readonly T[] | null | undefined): T[] {
  if (!Array.isArray(value)) throw new Error('The reply had no list.');
  return [...value];
}

/**
 * The sources admin for Daylight operators (plan slice SD.6): the decision
 * log, overrides on what discovery adopts, per-source health and readers'
 * requests for sources. Reading needs `sources.read`, changing
 * needs `sources.manage` (the parent passes `canManage`); the
 * gateway checks every call again. A failed load says "Unavailable" with a
 * Retry, never an empty list or a zero.
 */
@Component({
  selector: 'ot-daylight-sources',
  imports: [DatePipe, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-sources.component.html',
  styleUrl: './daylight-sources.component.scss',
})
export class DaylightSourcesComponent {
  /** Narrows the panels to one town; null covers every town (the town picker). */
  readonly town = input<DaylightTownFilter | null>(null);
  /** The filtered town's slug, once known. */
  readonly slug = input<string | null>(null);
  /** The towns the picker offers when no town is filtered. */
  readonly towns = input<readonly DaylightSourceTown[]>([]);
  readonly canManage = input(false);

  private readonly civic = inject(CivicAPIService);
  protected readonly pageSize = SOURCES_PAGE_SIZE;

  private readonly picked = signal<string | null>(null);
  /** The town the log, overrides and health are about. */
  protected readonly activeSlug = computed(
    () => this.slug() ?? this.picked() ?? this.towns()[0]?.slug ?? null
  );
  protected readonly activeName = computed(
    () =>
      this.towns().find((town) => town.slug === this.activeSlug())?.name ??
      this.town()?.name ??
      this.activeSlug() ??
      ''
  );
  /** The requests queue covers every town unless one is filtered. */
  private readonly requestSlug = computed(() =>
    this.town() ? this.slug() : null
  );
  private readonly requestsReady = computed(
    () => !this.town() || this.slug() !== null
  );

  protected readonly health = signal<Loaded<SourceHealthEntry[]>>({
    status: 'loading',
  });
  protected readonly overrides = signal<Loaded<SourceOverride[]>>({
    status: 'loading',
  });
  protected readonly decisions = signal<
    Loaded<{ items: SourceDecisionEntry[]; total: number }>
  >({ status: 'loading' });
  protected readonly requests = signal<
    Loaded<{ items: SourceRequestEntry[]; total: number }>
  >({ status: 'loading' });
  protected readonly decisionOffset = signal(0);
  protected readonly requestOffset = signal(0);
  protected readonly requestStatus = signal<RequestsStatus>('pending');

  protected readonly action = signal<Action | null>(null);
  protected readonly reason = signal('');
  protected readonly reasonMissing = signal(false);
  protected readonly busy = signal(false);
  protected readonly actionError = signal('');
  protected readonly message = signal('');
  protected readonly newKey = signal('');
  protected readonly newKeyMissing = signal(false);

  constructor() {
    effect(() => {
      const slug = this.activeSlug();
      untracked(() => {
        this.cancel();
        this.decisionOffset.set(0);
        if (slug) {
          this.loadHealth();
          this.loadOverrides();
          this.loadDecisions();
        }
      });
    });
    effect(() => {
      this.requestSlug();
      if (this.requestsReady())
        untracked(() => {
          this.requestOffset.set(0);
          this.loadRequests();
        });
    });
  }

  protected pick(event: Event): void {
    this.picked.set((event.target as HTMLSelectElement).value);
  }

  protected failure<T>(state: Loaded<T>): string {
    return state.status === 'failed' ? state.message : '';
  }

  protected loadHealth(): void {
    const slug = this.activeSlug();
    if (!slug) return;
    this.track(
      this.civic
        .health(slug)
        .pipe(map((reply) => list(body(reply?.data).sources))),
      'Source health could not be loaded.'
    ).subscribe((state) => this.health.set(state));
  }

  protected loadOverrides(): void {
    const slug = this.activeSlug();
    if (!slug) return;
    this.track(
      this.civic.overrides(slug).pipe(map((reply) => list(reply?.data))),
      'Source overrides could not be loaded.'
    ).subscribe((state) => this.overrides.set(state));
  }

  protected loadDecisions(): void {
    const slug = this.activeSlug();
    if (!slug) return;
    this.track(
      this.civic
        .decisions(slug, {
          limit: String(SOURCES_PAGE_SIZE),
          offset: String(this.decisionOffset()),
        })
        .pipe(map((reply) => this.page(reply?.data))),
      'The decision log could not be loaded.'
    ).subscribe((state) => this.decisions.set(state));
  }

  protected loadRequests(): void {
    const slug = this.requestSlug();
    this.track(
      this.civic
        .requests({
          ...(slug ? { slug } : {}),
          status: this.requestStatus(),
          limit: String(SOURCES_PAGE_SIZE),
          offset: String(this.requestOffset()),
        })
        .pipe(map((reply) => this.page(reply?.data))),
      'Source requests could not be loaded.'
    ).subscribe((state) => this.requests.set(state));
  }

  private page<T>(data: { items: T[]; total: number } | null | undefined): {
    items: T[];
    total: number;
  } {
    const value = body(data);
    return { items: list(value.items), total: Number(value.total) || 0 };
  }

  protected pageDecisions(direction: 1 | -1): void {
    this.decisionOffset.update((offset) =>
      Math.max(0, offset + direction * SOURCES_PAGE_SIZE)
    );
    this.loadDecisions();
  }

  protected pageRequests(direction: 1 | -1): void {
    this.requestOffset.update((offset) =>
      Math.max(0, offset + direction * SOURCES_PAGE_SIZE)
    );
    this.loadRequests();
  }

  protected setRequestStatus(event: Event): void {
    this.requestStatus.set(
      (event.target as HTMLSelectElement).value as RequestsStatus
    );
    this.requestOffset.set(0);
    this.loadRequests();
  }

  protected hasNext(offset: number, total: number): boolean {
    return offset + SOURCES_PAGE_SIZE < total;
  }

  // ── Actions, each confirmed with a reason ───────────────────────────────
  protected ask(action: Action): void {
    this.action.set(action);
    this.reason.set('');
    this.reasonMissing.set(false);
    this.actionError.set('');
    this.message.set('');
  }

  protected askBlockByKey(): void {
    const key = this.newKey().trim();
    this.newKeyMissing.set(!key);
    if (key) this.ask({ kind: 'block', panel: 'overrides', sourceKey: key });
  }

  protected setNewKey(event: Event): void {
    this.newKey.set((event.target as HTMLInputElement).value);
  }

  protected cancel(): void {
    this.action.set(null);
    this.reason.set('');
    this.reasonMissing.set(false);
    this.actionError.set('');
  }

  protected setReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected isAsking(panel: Action['panel']): boolean {
    return this.action()?.panel === panel;
  }

  /** The question the confirmation asks, in plain words. */
  protected question(): string {
    const action = this.action();
    if (!action) return '';
    switch (action.kind) {
      case 'block':
        return `Block ${action.sourceKey}? Discovery will never adopt it again, and a copy already held is switched off.`;
      case 'clear':
        return `Remove the ${action.override.kind} on ${action.override.sourceKey}? Discovery will decide about it afresh.`;
      case 'approved':
        return `Approve the request for ${action.request.townName}?`;
      case 'rejected':
        return `Reject the request for ${action.request.townName}?`;
    }
  }

  protected confirm(): void {
    const action = this.action();
    const reason = this.reason().trim();
    if (!action || this.busy()) return;
    if (!reason) {
      this.reasonMissing.set(true);
      return;
    }
    const slug = this.activeSlug();
    this.busy.set(true);
    this.actionError.set('');
    let call: Observable<unknown>;
    let done: string;
    if (action.kind === 'block') {
      if (!slug) return this.fail('Choose a town first.');
      call = this.civic.setOverride(slug, {
        sourceKey: action.sourceKey,
        kind: 'block',
        reason,
      });
      done = `${action.sourceKey} is blocked.`;
    } else if (action.kind === 'clear') {
      call = this.civic.clearOverride(
        action.override.slug,
        encodeURIComponent(action.override.sourceKey),
        { reason }
      );
      done = `The ${action.override.kind} on ${action.override.sourceKey} was removed.`;
    } else {
      call = this.civic.decide(action.request.id, {
        decision: action.kind,
        reason,
      });
      done = `The request for ${action.request.townName} was ${action.kind}.`;
    }
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.cancel();
        this.newKey.set('');
        this.message.set(done);
        if (action.panel === 'requests') this.loadRequests();
        else {
          this.loadHealth();
          this.loadOverrides();
          this.loadDecisions();
        }
      },
      error: (error: unknown) => this.fail(problem(error)),
    });
  }

  private fail(message: string): void {
    this.busy.set(false);
    this.actionError.set(message);
  }

  // ── Words for the tables ────────────────────────────────────────────────
  protected decisionWords(decision: string): string {
    const words: Record<string, string> = {
      adopted: 'Adopted',
      refused: 'Refused',
      blocked: 'Blocked',
      unblocked: 'Unblocked',
      pinned: 'Pinned',
      unpinned: 'Unpinned',
    };
    return words[decision] ?? decision;
  }

  protected statusWords(status: string): string {
    const words: Record<string, string> = {
      healthy: 'Healthy',
      quiet: 'Quiet',
      failing: 'Failing',
      retired: 'Retired',
    };
    return words[status] ?? status;
  }

  private track<T>(source: Observable<T>, fallback: string) {
    return source.pipe(
      map((value): Loaded<T> => ({ status: 'ready', value })),
      catchError((error: unknown) =>
        of<Loaded<T>>({ status: 'failed', message: problem(error, fallback) })
      ),
      startWith<Loaded<T>>({ status: 'loading' })
    );
  }
}
