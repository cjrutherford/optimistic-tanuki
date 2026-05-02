import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { TrainerApiService, TrainerAuthService } from '@optimistic-tanuki/trainer-data-access';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'trainer-client-dashboard-page',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <section class="grid">
      <otui-card class="stat">
        <span>Upcoming sessions</span>
        <strong>{{ bookings().length }}</strong>
      </otui-card>
      <otui-card class="stat">
        <span>Assigned routines</span>
        <strong>{{ routines().length }}</strong>
      </otui-card>
      <otui-card class="stat">
        <span>Recent check-ins</span>
        <strong>{{ checkIns().length }}</strong>
      </otui-card>
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
export class TrainerClientDashboardPageComponent {
  private readonly api = inject(TrainerApiService);
  private readonly auth = inject(TrainerAuthService);
  private readonly clientId = computed(() => this.auth.clientUser()?.profileId ?? '');
  readonly bookings = toSignal(
    toObservable(this.clientId).pipe(
      switchMap(id => id ? this.api.getClientBookings(id) : of([]))
    ),
    { initialValue: [] }
  );
  readonly routines = toSignal(
    toObservable(this.clientId).pipe(
      switchMap(id => id ? this.api.getClientRoutines(id) : of([]))
    ),
    { initialValue: [] }
  );
  readonly checkIns = toSignal(
    toObservable(this.clientId).pipe(
      switchMap(id => id ? this.api.getClientCheckIns(id) : of([]))
    ),
    { initialValue: [] }
  );
}
