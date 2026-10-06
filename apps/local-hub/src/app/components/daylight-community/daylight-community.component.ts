import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  OptomisitcTanukiAPIService as CivicAPIService,
  type CommunitySurface,
} from '@optimistic-tanuki/civic-briefing-data-access';
import {
  ContributionQuoteComponent,
  longDate,
} from '@optimistic-tanuki/civic-briefing-ui';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AuthStateService } from '../../services/auth-state.service';

type State =
  | { status: 'loading' }
  | { status: 'ready'; surface: CommunitySurface }
  | { status: 'failed' };

/**
 * What residents and officials have sent Daylight about a town, apart from
 * the briefing and labeled as what it is. A report shows its state
 * (corroborated, or a single report) and the independent accounts behind
 * it, never a count. Ported from the Daylight POC (plan slice P4.4).
 */
@Component({
  selector: 'app-daylight-community',
  imports: [AsyncPipe, RouterLink, ContributionQuoteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-community.component.html',
  styleUrl: './daylight-community.component.scss',
})
export class DaylightCommunityComponent {
  private readonly civic = inject(CivicAPIService);
  protected readonly auth = inject(AuthStateService);
  protected readonly longDate = longDate;

  /** The town page's slug, for links. */
  readonly citySlug = input.required<string>();
  /** The civic-briefing locality. */
  readonly localitySlug = input.required<string>();
  readonly town = input.required<string>();

  private readonly state = toSignal(
    toObservable(this.localitySlug).pipe(
      switchMap((slug) =>
        this.civic.surface(slug).pipe(
          map((reply): State => ({ status: 'ready', surface: reply.data })),
          catchError(() => of<State>({ status: 'failed' })),
          startWith<State>({ status: 'loading' })
        )
      )
    ),
    { initialValue: { status: 'loading' } as State }
  );

  protected readonly surface = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.surface : null;
  });
  protected readonly failed = computed(() => this.state().status === 'failed');
  protected readonly reportLink = computed(() => [
    '/city',
    this.citySlug(),
    'report',
  ]);
}
