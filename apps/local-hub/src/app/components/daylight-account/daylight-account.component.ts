import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { OptomisitcTanukiAPIService as CivicAPIService } from '@optimistic-tanuki/civic-briefing-data-access';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { DaylightMyReportsComponent } from './daylight-my-reports.component';
import { DaylightOfficialApplicationComponent } from './daylight-official-application.component';

/** The permissions that open a panel on the operations page. */
const OPERATOR_PERMISSIONS = [
  'density.read',
  'takedown.manage',
  'official.verify',
  'community.maintain',
];

/** The account page's Daylight section: your reports, and applying as a town official (plan slice P4.4). */
@Component({
  selector: 'app-daylight-account',
  imports: [
    RouterLink,
    DaylightMyReportsComponent,
    DaylightOfficialApplicationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canReadReports()) {
    <h3>Your reports</h3>
    <app-daylight-my-reports />
    } @else {
    <p class="join">
      Contributors tell Daylight what happened at public meetings in their town.
      <a routerLink="/contribute">Become a contributor</a>.
    </p>
    }
    <h3>Town officials</h3>
    <app-daylight-official-application />
    @if (isOperator()) {
    <p class="operator"><a routerLink="/operations">Daylight operations</a></p>
    }
  `,
  styles: `
    :host { display: block; }
    h3 { margin: 1.5rem 0 0.5rem; font-size: 1.1rem; }
    h3:first-child { margin-top: 0; }
    .operator { margin: 1.5rem 0 0; }
    .join { margin: 0 0 1rem; line-height: 1.55; }
    .join a { color: var(--primary); font-weight: 600; }
    .operator a { color: var(--primary); font-weight: 600; }
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
  protected readonly isOperator = computed(() =>
    OPERATOR_PERMISSIONS.some((permission) =>
      this.permissions().includes(permission)
    )
  );
}
