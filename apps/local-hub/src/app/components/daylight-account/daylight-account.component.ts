import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { OptomisitcTanukiAPIService as CivicAPIService } from '@optimistic-tanuki/civic-briefing-data-access';
import { catchError, map, of } from 'rxjs';
import { DaylightMyReportsComponent } from './daylight-my-reports.component';
import { DaylightOfficialApplicationComponent } from './daylight-official-application.component';

/** The account page's Daylight section: your reports, and applying as a town official (plan slice P4.4). */
@Component({
  selector: 'app-daylight-account',
  imports: [DaylightMyReportsComponent, DaylightOfficialApplicationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canReadReports()) {
    <h3>Your reports</h3>
    <app-daylight-my-reports />
    }
    <h3>Town officials</h3>
    <app-daylight-official-application />
  `,
  styles: `
    :host { display: block; }
    h3 { margin: 1.5rem 0 0.5rem; font-size: 1.1rem; }
    h3:first-child { margin-top: 0; }
  `,
})
export class DaylightAccountComponent {
  private readonly permissions = toSignal(
    inject(CivicAPIService)
      .me()
      .pipe(
        map((reply) => reply.data.permissions),
        catchError(() => of([] as string[]))
      ),
    { initialValue: [] as string[] }
  );
  protected readonly canReadReports = computed(() =>
    this.permissions().includes('contribution.read')
  );
}
