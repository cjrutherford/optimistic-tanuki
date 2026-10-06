import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  OptomisitcTanukiAPIService as CivicAPIService,
  type EditionSummary,
  type OfficialApplicationResult,
  problem,
} from '@optimistic-tanuki/civic-briefing-data-access';
import { catchError, map, of } from 'rxjs';

/**
 * Apply to submit to Daylight as a town official. The check uses the
 * address and name on the account, never anything typed here, and says
 * exactly what it checked.
 */
@Component({
  selector: 'app-daylight-official-application',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-official-application.component.html',
  styleUrl: './daylight-account.scss',
})
export class DaylightOfficialApplicationComponent {
  private readonly civic = inject(CivicAPIService);
  protected readonly editions = toSignal(
    this.civic.editions().pipe(
      map((reply) => reply.data),
      catchError(() => of([] as EditionSummary[]))
    ),
    { initialValue: [] as EditionSummary[] }
  );
  protected town = '';
  protected readonly pending = signal(false);
  protected readonly result = signal<OfficialApplicationResult | null>(null);
  protected readonly failure = signal('');

  protected apply(): void {
    this.pending.set(true);
    this.failure.set('');
    this.civic.applyOfficial({ localitySlug: this.town }).subscribe({
      next: (reply) => {
        this.pending.set(false);
        this.result.set(reply.data);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.failure.set(problem(error));
      },
    });
  }
}
