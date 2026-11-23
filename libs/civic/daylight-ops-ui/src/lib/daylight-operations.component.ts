import { DaylightSourcesComponent } from './daylight-sources.component';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  type BackfillStatus,
  OptomisitcTanukiAPIService as CivicAPIService,
  DENSITY_TARGET,
  type OfficialCandidate,
  type PipelineHealthReport,
  problem,
  type TakedownNoticeRecord,
  type TownDensity,
} from '@optimistic-tanuki/civic-briefing-data-access';
import { catchError, map, of, startWith, type Observable } from 'rxjs';
import {
  DAYLIGHT_OPS_ACCESS,
  type DaylightTownFilter,
} from './daylight-ops-access';

type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'failed'; message: string };

interface CandidateGroup {
  slug: string;
  townName: string;
  townHasOfficials: boolean;
  candidates: OfficialCandidate[];
}

/**
 * A reply whose body is missing or has the wrong shape (an empty 200 from a
 * proxy, a gateway that answers with its own envelope) is a failed load, not
 * a value to read fields from. Throwing here lands in `track`'s failed state.
 */
function body<T>(data: T | null | undefined): T {
  if (data === null || data === undefined || typeof data !== 'object') {
    throw new Error('The reply had no data.');
  }
  return data;
}

/** A list the server may have left out or nulled. */
function list<T>(value: readonly T[] | null | undefined): T[] {
  return Array.isArray(value) ? [...value] : [];
}

const HTTPS_URL = /^https:\/\/[^\s/$.?#][^\s]*$/iu;

type NoticeAction = 'upheld' | 'declined' | 'restored';

/**
 * Daylight's operator tools (D24: operator actions are API routes used from
 * here, not a CLI). Each panel shows only with its permission, and the
 * gateway checks every call again.
 *
 * Contributor density is not public: a town's thinness is a recruiting
 * problem, and publishing it would also tell anyone which town is easiest to
 * flood. Ported from the Daylight POC (plan slice P4.4).
 */
@Component({
  selector: 'ot-daylight-operations',
  imports: [DatePipe, ReactiveFormsModule, DaylightSourcesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-operations.component.html',
  styleUrl: './daylight-operations.component.scss',
})
export class DaylightOperationsComponent {
  /** Narrows the town-based panels to one town; null shows every town. */
  readonly town = input<DaylightTownFilter | null>(null);
  /** The kicker and page title; an app with its own page header turns it off. */
  readonly showHeading = input(true);

  private readonly access = inject(DAYLIGHT_OPS_ACCESS);
  private readonly civic = inject(CivicAPIService);
  private readonly fb = inject(FormBuilder);
  protected readonly target = DENSITY_TARGET;

  private readonly permissions = toSignal(
    this.access().pipe(
      map((permissions): string[] | null => [...permissions]),
      catchError(() => of([] as string[]))
    ),
    { initialValue: null }
  );
  protected readonly checked = computed(() => this.permissions() !== null);
  private can(permission: string) {
    return computed(() => this.permissions()?.includes(permission) ?? false);
  }
  protected readonly canPipeline = this.can('town.configure');
  protected readonly canDensity = this.can('density.read');
  protected readonly canTakedowns = this.can('takedown.manage');
  protected readonly canVerify = this.can('official.verify');
  protected readonly canMaintain = this.can('community.maintain');
  protected readonly canSourcesRead = this.can('sources.read');
  protected readonly canSourcesManage = this.can('sources.manage');
  protected readonly anything = computed(
    () =>
      this.canPipeline() ||
      this.canDensity() ||
      this.canTakedowns() ||
      this.canVerify() ||
      this.canMaintain() ||
      this.canSourcesRead()
  );

  // ── Pipeline health ────────────────────────────────────────────────────
  protected readonly pipeline = signal<Loaded<PipelineHealthReport>>({
    status: 'loading',
  });
  private readonly fullPipelineReport = computed(() => {
    const state = this.pipeline();
    return state.status === 'ready' ? state.value : null;
  });
  protected readonly pipelineReport = computed(() => {
    const report = this.fullPipelineReport();
    if (!report || !this.town()) return report;
    return {
      ...report,
      towns: report.towns.filter((town) => this.isTown(town.slug, town.name)),
    };
  });
  /** The locality slug of the filtered town, once the pipeline names it. */
  protected readonly townSlug = computed(() => {
    const filter = this.town();
    if (!filter) return null;
    if (filter.slug) return filter.slug;
    return (
      this.fullPipelineReport()?.towns.find((town) =>
        this.isTown(town.slug, town.name)
      )?.slug ?? null
    );
  });
  /** Towns the sources panels can be pointed at. */
  protected readonly sourceTowns = computed(() =>
    (this.fullPipelineReport()?.towns ?? []).map((town) => ({
      slug: town.slug,
      name: town.name,
    }))
  );
  protected readonly townName = computed(() => this.town()?.name ?? '');
  /** Whether the backfill can be pointed at the filtered town alone. */
  protected readonly canBackfill = computed(
    () => !this.town() || this.townSlug() !== null
  );
  protected readonly pipelineError = computed(() => {
    const state = this.pipeline();
    return state.status === 'failed' ? state.message : '';
  });

  // ── Backfill (D31) ─────────────────────────────────────────────────────
  protected readonly backfill = signal<BackfillStatus | null>(null);
  protected readonly backfillDays = signal(180);
  protected readonly backfillMessage = signal('');
  private backfillPoll: ReturnType<typeof setTimeout> | null = null;

  // ── Official candidates (D33) ──────────────────────────────────────────
  protected readonly candidates = signal<Loaded<OfficialCandidate[]>>({
    status: 'loading',
  });
  protected readonly candidateGroups = computed((): CandidateGroup[] => {
    const state = this.candidates();
    if (state.status !== 'ready') return [];
    const groups = new Map<string, CandidateGroup>();
    for (const candidate of state.value) {
      if (!this.isTown(candidate.slug, candidate.townName)) continue;
      const group = groups.get(candidate.slug) ?? {
        slug: candidate.slug,
        townName: candidate.townName,
        townHasOfficials: candidate.townHasOfficials,
        candidates: [],
      };
      group.candidates.push(candidate);
      groups.set(candidate.slug, group);
    }
    return [...groups.values()].sort((a, b) =>
      (a.townName ?? '').localeCompare(b.townName ?? '')
    );
  });
  protected readonly candidatesError = computed(() => {
    const state = this.candidates();
    return state.status === 'failed' ? state.message : '';
  });
  /** The candidate whose accept form or reject confirmation is open. */
  protected readonly accepting = signal<OfficialCandidate | null>(null);
  protected readonly rejecting = signal<OfficialCandidate | null>(null);
  protected readonly candidateBusy = signal(false);
  /** A refusal from the server, shown inside the open form. */
  protected readonly candidateError = signal('');
  protected readonly candidateMessage = signal('');
  protected readonly acceptSubmitted = signal(false);
  protected readonly acceptForm = this.fb.nonNullable.group({
    office: ['', Validators.required],
    source: ['', [Validators.required, Validators.pattern(HTTPS_URL)]],
    domains: [''],
    callbackNumberSource: ['', Validators.pattern(HTTPS_URL)],
  });

  // ── Density ────────────────────────────────────────────────────────────
  protected readonly density = signal<Loaded<TownDensity[]>>({
    status: 'loading',
  });
  protected readonly rows = computed(() => {
    const state = this.density();
    return state.status === 'ready'
      ? state.value
          .filter((row) => this.isTown(row.localitySlug, row.town))
          .sort(
            (a, b) =>
              a.active - b.active || (a.town ?? '').localeCompare(b.town ?? '')
          )
      : [];
  });
  protected readonly densityError = computed(() => {
    const state = this.density();
    return state.status === 'failed' ? state.message : '';
  });
  protected readonly recruit = computed(() =>
    this.rows().filter((row) => row.active < DENSITY_TARGET.low)
  );
  protected readonly confirmed = computed(() =>
    this.rows().reduce((sum, row) => sum + row.confirmed, 0)
  );
  protected readonly contradicted = computed(() =>
    this.rows().reduce((sum, row) => sum + row.contradicted, 0)
  );

  // ── Copyright notices ──────────────────────────────────────────────────
  protected readonly noticeState = signal('received');
  protected readonly notices = signal<Loaded<TakedownNoticeRecord[]>>({
    status: 'loading',
  });
  protected readonly noticeList = computed(() => {
    const state = this.notices();
    return state.status === 'ready' ? state.value : [];
  });
  protected readonly noticesError = computed(() => {
    const state = this.notices();
    return state.status === 'failed' ? state.message : '';
  });
  protected readonly noticeNotes = new Map<string, string>();
  protected readonly noticeMessage = signal('');

  // ── Official callbacks ─────────────────────────────────────────────────
  protected readonly callback = this.fb.nonNullable.group({
    userId: ['', Validators.required],
    localitySlug: ['', Validators.required],
    note: ['', Validators.required],
  });
  protected readonly callbackMessage = signal('');

  // ── Maintenance ────────────────────────────────────────────────────────
  protected readonly running = signal<string | null>(null);
  protected readonly maintenanceMessage = signal('');

  constructor() {
    // Each panel loads once the account's permissions are known.
    effect(() => {
      if (this.checked()) untracked(() => this.loadPanels());
    });
    inject(DestroyRef).onDestroy(() => this.stopBackfillPoll());
  }

  /** Whether a town belongs to the filter: by slug when both have one, else by name. */
  private isTown(slug: string, name: string): boolean {
    const filter = this.town();
    if (!filter) return true;
    if (filter.slug) return filter.slug === slug;
    const wanted = filter.name?.trim().toLowerCase();
    return !wanted || wanted === (name ?? '').trim().toLowerCase();
  }

  private loadPanels(): void {
    if (this.canPipeline()) {
      this.loadPipeline();
      this.loadCandidates();
      this.loadBackfill();
    }
    if (this.canDensity()) this.loadDensity();
    if (this.canTakedowns()) this.loadNotices();
  }

  protected loadPipeline(): void {
    this.track(
      this.civic.pipelineHealth().pipe(
        map((reply) => {
          const report = body(reply?.data);
          return { ...report, towns: list(report.towns) };
        })
      ),
      'Pipeline health could not be loaded.'
    ).subscribe((state) => this.pipeline.set(state));
  }

  protected loadCandidates(): void {
    this.track(
      this.civic
        .officialCandidates()
        .pipe(map((reply) => list(body(reply?.data)))),
      'Official candidates could not be loaded.'
    ).subscribe((state) => this.candidates.set(state));
  }

  /** The "From agenda" note: the id is Civic Core's, there is no page to link to. */
  protected agendaNote(candidate: OfficialCandidate): string {
    return candidate.sourceAgendaId
      ? `Named in agenda ${candidate.sourceAgendaId.slice(0, 8)}`
      : '';
  }

  protected openAccept(candidate: OfficialCandidate): void {
    this.rejecting.set(null);
    this.accepting.set(candidate);
    this.candidateError.set('');
    this.candidateMessage.set('');
    this.acceptSubmitted.set(false);
    this.acceptForm.reset({
      office: candidate.role,
      source: '',
      domains: '',
      callbackNumberSource: '',
    });
    const first = !candidate.townHasOfficials;
    for (const name of ['domains', 'callbackNumberSource'] as const) {
      const control = this.acceptForm.controls[name];
      control.setValidators(
        name === 'callbackNumberSource'
          ? first
            ? [Validators.required, Validators.pattern(HTTPS_URL)]
            : [Validators.pattern(HTTPS_URL)]
          : first
          ? [Validators.required]
          : []
      );
      control.updateValueAndValidity();
    }
  }

  protected openReject(candidate: OfficialCandidate): void {
    this.accepting.set(null);
    this.rejecting.set(candidate);
    this.candidateError.set('');
    this.candidateMessage.set('');
  }

  protected cancelCandidate(): void {
    this.accepting.set(null);
    this.rejecting.set(null);
    this.candidateError.set('');
  }

  /** Whether a field of the accept form shows its error: after a try, or once touched. */
  protected fieldInvalid(name: keyof typeof this.acceptForm.controls): boolean {
    const control = this.acceptForm.controls[name];
    return control.invalid && (this.acceptSubmitted() || control.touched);
  }

  protected acceptCandidate(): void {
    const candidate = this.accepting();
    if (!candidate || this.candidateBusy()) return;
    this.acceptSubmitted.set(true);
    this.candidateError.set('');
    if (this.acceptForm.invalid) return;
    const value = this.acceptForm.getRawValue();
    const domains = value.domains
      .split(/[\s,]+/u)
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);
    this.candidateBusy.set(true);
    this.civic
      .acceptOfficialCandidate(candidate.id, {
        office: value.office.trim(),
        source: value.source.trim(),
        ...(domains.length ? { domains } : {}),
        ...(value.callbackNumberSource.trim()
          ? { callbackNumberSource: value.callbackNumberSource.trim() }
          : {}),
      })
      .subscribe({
        next: () => {
          this.candidateBusy.set(false);
          this.accepting.set(null);
          this.candidateMessage.set(
            `${candidate.name} was added to ${candidate.townName}'s roster.`
          );
          this.loadCandidates();
        },
        error: (error: unknown) => {
          this.candidateBusy.set(false);
          this.candidateError.set(problem(error));
        },
      });
  }

  protected confirmReject(): void {
    const candidate = this.rejecting();
    if (!candidate || this.candidateBusy()) return;
    this.candidateBusy.set(true);
    this.candidateError.set('');
    this.civic.rejectOfficialCandidate(candidate.id).subscribe({
      next: () => {
        this.candidateBusy.set(false);
        this.rejecting.set(null);
        this.candidateMessage.set(
          `${candidate.name} was rejected and will not be suggested again.`
        );
        this.loadCandidates();
      },
      error: (error: unknown) => {
        this.candidateBusy.set(false);
        this.candidateError.set(problem(error));
      },
    });
  }

  protected setBackfillDays(event: Event): void {
    const days = Number((event.target as HTMLInputElement).value);
    if (Number.isInteger(days) && days >= 1 && days <= 366)
      this.backfillDays.set(days);
  }

  /** Starts a pull and backfill of every scheduled town (D31). */
  protected startBackfill(): void {
    this.backfillMessage.set('');
    const slug = this.town() ? this.townSlug() : null;
    this.civic
      .startBackfill({
        days: this.backfillDays(),
        ...(slug ? { towns: [slug] } : {}),
      })
      .subscribe({
        next: (reply) => this.showBackfill(reply?.data),
        error: (error: unknown) => this.backfillMessage.set(problem(error)),
      });
  }

  private loadBackfill(): void {
    this.civic.backfillStatus().subscribe({
      next: (reply) => this.showBackfill(reply?.data),
      error: () => this.backfill.set(null),
    });
  }

  /** Shows a backfill's status, checking again while it runs. */
  private showBackfill(raw: BackfillStatus | null | undefined): void {
    this.stopBackfillPoll();
    if (!raw || typeof raw !== 'object') {
      this.backfill.set(null);
      return;
    }
    const status: BackfillStatus = {
      ...raw,
      towns: list(raw.towns),
      steps: list(raw.steps),
    };
    this.backfill.set(status);
    if (status.running)
      this.backfillPoll = setTimeout(() => {
        this.loadBackfill();
        this.loadPipeline();
      }, 15_000);
  }

  private stopBackfillPoll(): void {
    if (this.backfillPoll) clearTimeout(this.backfillPoll);
    this.backfillPoll = null;
  }

  /** A run status in plain words. */
  protected runWords(status: string): string {
    const words: Record<string, string> = {
      succeeded: 'Published',
      partial_success: 'Published, with gaps',
      failed: 'Failed',
      blocked: 'Blocked',
      running: 'Running',
      'skipped-overlap': 'Skipped (another run was going)',
    };
    return words[status] ?? status;
  }

  protected loadDensity(): void {
    this.track(
      this.civic.density().pipe(map((reply) => list(body(reply?.data).rows))),
      'Contributor density could not be loaded.'
    ).subscribe((state) => this.density.set(state));
  }

  protected loadNotices(): void {
    const state = this.noticeState();
    this.track(
      this.civic
        .takedownNotices(state ? { state } : undefined)
        .pipe(map((reply) => list(body(reply?.data)))),
      'Copyright notices could not be loaded.'
    ).subscribe((loaded) => this.notices.set(loaded));
  }

  protected setNoticeState(event: Event): void {
    this.noticeState.set((event.target as HTMLSelectElement).value);
    this.loadNotices();
  }

  protected noteFor(id: string, event: Event): void {
    this.noticeNotes.set(id, (event.target as HTMLTextAreaElement).value);
  }

  protected act(notice: TakedownNoticeRecord, action: NoticeAction): void {
    const note = this.noticeNotes.get(notice.id)?.trim() ?? '';
    if (!note) {
      this.noticeMessage.set('Record the reason for the decision first.');
      return;
    }
    this.civic.actOnTakedownNotice(notice.id, { action, note }).subscribe({
      next: (reply) => {
        const { contributions, suspended } = reply.data;
        this.noticeMessage.set(
          `Notice ${action}: ${contributions.length} contribution${
            contributions.length === 1 ? '' : 's'
          } affected${
            suspended.length
              ? `, ${suspended.length} contributor${
                  suspended.length === 1 ? '' : 's'
                } suspended`
              : ''
          }.`
        );
        this.loadNotices();
      },
      error: (error: unknown) => this.noticeMessage.set(problem(error)),
    });
  }

  protected confirmCallback(): void {
    this.callbackMessage.set('');
    this.civic.confirmCallback(this.callback.getRawValue()).subscribe({
      next: (reply) => {
        this.callbackMessage.set(
          `Recorded. Their standing is now ${reply.data.standing}.`
        );
        this.callback.reset();
      },
      error: (error: unknown) => this.callbackMessage.set(problem(error)),
    });
  }

  protected run(task: 'rereview' | 'sweep' | 'export'): void {
    this.running.set(task);
    this.maintenanceMessage.set('');
    const done = (message: string) => {
      this.running.set(null);
      this.maintenanceMessage.set(message);
    };
    const failed = (error: unknown) => done(problem(error));
    if (task === 'rereview')
      this.civic.rereview().subscribe({
        next: (reply) =>
          done(
            `Re-review finished: ${reply.data.changed} contribution${
              reply.data.changed === 1 ? '' : 's'
            } changed.`
          ),
        error: failed,
      });
    else if (task === 'sweep')
      this.civic.sweepOutcomes().subscribe({
        next: (reply) =>
          done(
            `Compared ${reply.data.compared}: ${reply.data.confirmed} confirmed, ${reply.data.contradicted} contradicted.`
          ),
        error: failed,
      });
    else
      this.civic.exportPromotions().subscribe({
        next: (reply) =>
          done(
            `Wrote quotable material for ${reply.data.towns.length} town${
              reply.data.towns.length === 1 ? '' : 's'
            }.`
          ),
        error: failed,
      });
  }

  protected standing(row: TownDensity): string {
    if (row.active === 0) return 'none';
    if (row.active < DENSITY_TARGET.low) return 'short';
    if (row.active > DENSITY_TARGET.high) return 'above';
    return 'in band';
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
