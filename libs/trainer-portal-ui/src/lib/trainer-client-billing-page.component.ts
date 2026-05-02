import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { TrainerApiService, TrainerAuthService } from '@optimistic-tanuki/trainer-data-access';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'trainer-client-billing-page',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <otui-card>
      <h2>Billing and session history</h2>
      <div class="rows">
        @for (booking of bookings(); track booking.id) {
          <div class="row">
            <div>
              <strong>{{ booking.title }}</strong>
              <p>{{ booking.status }}</p>
            </div>
            <span>{{ booking.totalCost ? ('$' + booking.totalCost) : 'Pending' }}</span>
          </div>
        } @empty {
          <p class="empty">Approved and invoiced sessions will surface here.</p>
        }
      </div>
    </otui-card>
  `,
  styles: [
    `
      .rows {
        display: grid;
        gap: 0.75rem;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding-top: 0.9rem;
        border-top: 1px solid var(--border);
      }
      .row:first-child {
        border-top: 0;
        padding-top: 0;
      }
      p,
      .empty {
        margin: 0.15rem 0 0;
        color: var(--muted);
      }
    `,
  ],
})
export class TrainerClientBillingPageComponent {
  private readonly api = inject(TrainerApiService);
  private readonly auth = inject(TrainerAuthService);
  private readonly clientId = computed(() => this.auth.clientUser()?.profileId ?? '');
  readonly bookings = toSignal(
    toObservable(this.clientId).pipe(
      switchMap(id => id ? this.api.getClientBookings(id) : of([]))
    ),
    { initialValue: [] }
  );
}
