import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  OptomisitcTanukiAPIService as CivicAPIService,
  DENSITY_TARGET,
  problem,
  type TakedownNoticeRecord,
  type TownDensity,
} from '@optimistic-tanuki/civic-briefing-data-access';
import { catchError, map, of, startWith, type Observable } from 'rxjs';

type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'failed'; message: string };

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
  selector: 'app-daylight-operations-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-operations.page.html',
  styleUrl: './daylight-operations.page.scss',
})
export class DaylightOperationsPage {
  private readonly civic = inject(CivicAPIService);
  private readonly fb = inject(FormBuilder);
  protected readonly target = DENSITY_TARGET;

  private readonly permissions = toSignal(
    this.civic.me().pipe(
      map((reply): string[] | null => reply.data.permissions),
      catchError(() => of([] as string[]))
    ),
    { initialValue: null }
  );
  protected readonly checked = computed(() => this.permissions() !== null);
  private can(permission: string) {
    return computed(() => this.permissions()?.includes(permission) ?? false);
  }
  protected readonly canDensity = this.can('density.read');
  protected readonly canTakedowns = this.can('takedown.manage');
  protected readonly canVerify = this.can('official.verify');
  protected readonly canMaintain = this.can('community.maintain');
  protected readonly anything = computed(
    () =>
      this.canDensity() ||
      this.canTakedowns() ||
      this.canVerify() ||
      this.canMaintain()
  );

  // ── Density ────────────────────────────────────────────────────────────
  protected readonly density = signal<Loaded<TownDensity[]>>({
    status: 'loading',
  });
  protected readonly rows = computed(() => {
    const state = this.density();
    return state.status === 'ready'
      ? [...state.value].sort(
          (a, b) => a.active - b.active || a.town.localeCompare(b.town)
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
  }

  private loadPanels(): void {
    if (this.canDensity()) this.loadDensity();
    if (this.canTakedowns()) this.loadNotices();
  }

  protected loadDensity(): void {
    this.track(
      this.civic.density().pipe(map((reply) => reply.data.rows)),
      'Contributor density could not be loaded.'
    ).subscribe((state) => this.density.set(state));
  }

  protected loadNotices(): void {
    const state = this.noticeState();
    this.track(
      this.civic
        .takedownNotices(state ? { state } : undefined)
        .pipe(map((reply) => reply.data)),
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
