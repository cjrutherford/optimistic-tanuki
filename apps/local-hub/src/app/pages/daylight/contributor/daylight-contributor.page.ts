import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  OptomisitcTanukiAPIService as CivicAPIService,
  type ContributorPage,
} from '@optimistic-tanuki/civic-briefing-data-access';
import {
  ContributionQuoteComponent,
  longDate,
} from '@optimistic-tanuki/civic-briefing-ui';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

type State =
  | { status: 'loading' }
  | { status: 'ready'; page: ContributorPage }
  | { status: 'missing' };

/**
 * A Daylight contributor, in public: handle, bio, what they reported and
 * corroborated, and how their reports have fared against the record.
 * Standing itself is never shown (it is weight at the gate, not a badge),
 * but whether a record bore a report out is the reader's business,
 * including when it did not. Ported from the Daylight POC (plan slice P4.4).
 */
@Component({
  selector: 'app-daylight-contributor-page',
  imports: [RouterLink, ContributionQuoteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-contributor.page.html',
  styleUrl: './daylight-contributor.page.scss',
})
export class DaylightContributorPage {
  private readonly civic = inject(CivicAPIService);
  protected readonly longDate = longDate;

  private readonly state = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => params.get('id') ?? ''),
      switchMap((id) =>
        this.civic.contributor(id).pipe(
          map((reply): State => ({ status: 'ready', page: reply.data })),
          catchError(() => of<State>({ status: 'missing' })),
          startWith<State>({ status: 'loading' })
        )
      )
    ),
    { initialValue: { status: 'loading' } as State }
  );

  protected readonly loading = computed(
    () => this.state().status === 'loading'
  );
  protected readonly page = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.page : null;
  });

  /** Their record, in a sentence rather than a scoreboard. */
  protected readonly history = computed(() => {
    const history = this.page()?.history;
    if (!history) return '';
    const total = history.confirmed + history.contradicted + history.pending;
    if (!total) return '';
    const parts: string[] = [];
    if (history.confirmed)
      parts.push(
        `${history.confirmed} ${
          history.confirmed === 1 ? 'has' : 'have'
        } since been borne out by a record`
      );
    if (history.contradicted)
      parts.push(
        `${history.contradicted} ${
          history.contradicted === 1 ? 'was' : 'were'
        } contradicted by one`
      );
    if (history.pending)
      parts.push(
        `${history.pending} ${
          history.pending === 1 ? 'is' : 'are'
        } waiting on one`
      );
    return `Of ${total} ${total === 1 ? 'report' : 'reports'}, ${parts.join(
      '; '
    )}.`;
  });
}
