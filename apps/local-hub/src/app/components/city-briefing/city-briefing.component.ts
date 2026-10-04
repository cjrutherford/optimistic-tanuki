import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  OptomisitcTanukiAPIService as CivicAPIService,
  problem,
  type PublishedBriefing,
} from '@optimistic-tanuki/civic-briefing-data-access';
import {
  BriefingBodyComponent,
  EditionStripComponent,
  longDate,
} from '@optimistic-tanuki/civic-briefing-ui';
import { catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';

type BriefingState =
  | { status: 'loading' }
  | {
      status: 'ready';
      briefing: PublishedBriefing;
      published: string[];
      latest: string;
    }
  | { status: 'missing'; message: string }
  | { status: 'failed'; message: string };

/**
 * One town's briefing: the latest, or the edition for `date`, with the strip
 * of the last four weeks' editions beneath it. Used on the city page and on
 * `city/:slug/briefing[/:date]` (plan slice P4.3).
 */
@Component({
  selector: 'app-city-briefing',
  imports: [BriefingBodyComponent, EditionStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './city-briefing.component.html',
  styleUrl: './city-briefing.component.scss',
})
export class CityBriefingComponent {
  private readonly civic = inject(CivicAPIService);

  /** The town page's slug, for the strip's links. */
  readonly citySlug = input.required<string>();
  /** The civic-briefing locality the town page shows. */
  readonly localitySlug = input.required<string>();
  /** The town's name, for messages. */
  readonly cityName = input.required<string>();
  /** A period end (YYYY-MM-DD), or null for the latest edition. */
  readonly date = input<string | null>(null);

  private readonly state = signal<BriefingState>({ status: 'loading' });
  protected readonly loading = computed(
    () => this.state().status === 'loading'
  );
  protected readonly ready = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state : null;
  });
  protected readonly notice = computed(() => {
    const state = this.state();
    return state.status === 'missing' || state.status === 'failed'
      ? state
      : null;
  });
  protected readonly route = computed(() => [
    '/city',
    this.citySlug(),
    'briefing',
  ]);
  protected readonly longDate = longDate;

  constructor() {
    const request = computed(() => ({
      locality: this.localitySlug(),
      date: this.date(),
      name: this.cityName(),
    }));
    toObservable(request)
      .pipe(
        switchMap(({ locality, date, name }) =>
          forkJoin({
            history: this.civic.edition(locality),
            briefing: date
              ? this.civic.briefing(locality, date)
              : this.civic.latest(locality),
          }).pipe(
            map(
              ({ history, briefing }): BriefingState => ({
                status: 'ready',
                briefing: briefing.data,
                published: history.data.briefings.map((b) => b.periodEnd),
                latest: history.data.latest ?? briefing.data.periodEnd,
              })
            ),
            catchError((error: unknown) => of(this.failure(error, name, date))),
            startWith<BriefingState>({ status: 'loading' })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((state) => this.state.set(state));
  }

  private failure(
    error: unknown,
    name: string,
    date: string | null
  ): BriefingState {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return {
        status: 'missing',
        message: date
          ? `There is no ${name} briefing for ${longDate(date)}.`
          : `No briefing has been published for ${name} yet.`,
      };
    }
    return {
      status: 'failed',
      message: problem(
        error,
        'Briefings are unavailable right now. Try again in a moment.'
      ),
    };
  }
}
