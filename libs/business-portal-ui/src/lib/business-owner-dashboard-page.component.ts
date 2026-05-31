import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BusinessApiService,
  BusinessSiteConfigStore,
} from '@optimistic-tanuki/business-data-access';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'business-owner-dashboard-page',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <section class="grid">
      <otui-card class="stat">
        <span>Prospects</span>
        <strong>{{ prospects().length }}</strong>
      </otui-card>
      <otui-card class="stat">
        <span>Pending bookings</span>
        <strong>{{ pendingBookings() }}</strong>
      </otui-card>
      <otui-card class="stat">
        <span>Completed bookings</span>
        <strong>{{ completedBookings() }}</strong>
      </otui-card>
      @if (siteConfig.site().features.clientTasks.enabled) {
      <otui-card class="stat">
        <span>Assigned routines</span>
        <strong>{{ routines().length }}</strong>
      </otui-card>
      <otui-card class="stat">
        <span>Client check-ins</span>
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
export class BusinessOwnerDashboardPageComponent {
  private readonly api = inject(BusinessApiService);
  protected readonly siteConfig = inject(BusinessSiteConfigStore);
  readonly prospects = toSignal(this.api.getOwnerProspects(), {
    initialValue: [],
  });
  readonly bookings = toSignal(this.api.getOwnerBookings(), {
    initialValue: [],
  });
  readonly routines = toSignal(this.api.getAllRoutines(), { initialValue: [] });
  readonly checkIns = toSignal(this.api.getAllCheckIns(), {
    initialValue: [],
  });
  readonly pendingBookings = computed(
    () =>
      this.bookings().filter((booking) => booking.status === 'pending').length
  );
  readonly completedBookings = computed(
    () =>
      this.bookings().filter((booking) => booking.status === 'completed').length
  );

  constructor() {
    this.siteConfig.fetch().subscribe();
  }
}
