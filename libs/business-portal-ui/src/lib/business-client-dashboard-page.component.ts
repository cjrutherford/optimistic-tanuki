import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import {
  BusinessApiService,
  BusinessAuthService,
  BusinessSiteConfigStore,
} from '@optimistic-tanuki/business-data-access';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'business-client-dashboard-page',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <section class="grid">
      <otui-card class="stat">
        <span>Upcoming sessions</span>
        <strong>{{ bookings().length }}</strong>
      </otui-card>
      @if (siteConfig.site().features.clientTasks.enabled) {
      <otui-card class="stat">
        <span>Assigned routines</span>
        <strong>{{ routines().length }}</strong>
      </otui-card>
      <otui-card class="stat">
        <span>Recent check-ins</span>
        <strong>{{ checkIns().length }}</strong>
      </otui-card>
      }
    </section>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }
      .stat {
        display: grid;
        gap: 0.45rem;
      }
      span {
        color: var(--muted);
      }
      strong {
        font-size: 2.3rem;
        font-family: 'Instrument Serif', serif;
        font-weight: 400;
      }
    `,
  ],
})
export class BusinessClientDashboardPageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly auth = inject(BusinessAuthService);
  protected readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly clientId = computed(
    () => this.auth.clientUser()?.userId ?? ''
  );
  readonly bookings = toSignal(
    toObservable(this.clientId).pipe(
      switchMap((id) => (id ? this.api.getClientBookings() : of([])))
    ),
    { initialValue: [] }
  );
  readonly routines = toSignal(
    toObservable(this.clientId).pipe(
      switchMap((id) => (id ? this.api.getClientRoutines(id) : of([])))
    ),
    { initialValue: [] }
  );
  readonly checkIns = toSignal(
    toObservable(this.clientId).pipe(
      switchMap((id) => (id ? this.api.getClientCheckIns(id) : of([])))
    ),
    { initialValue: [] }
  );

  constructor() {
    this.siteConfig.fetch().subscribe();
  }
}
