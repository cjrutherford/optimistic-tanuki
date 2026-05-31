import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import {
  BusinessApiService,
  BusinessAuthService,
  BusinessSiteConfigStore,
} from '@optimistic-tanuki/business-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'business-client-billing-page',
  standalone: true,
  imports: [CommonModule, ButtonComponent, CardComponent],
  template: `
    <section class="stack">
      <otui-card>
        <h2>Invoices</h2>
        <div class="rows">
          @for (invoice of invoices(); track invoice.id) {
          <div class="row">
            <div>
              <strong>{{ invoice.invoiceNumber }}</strong>
              <p>{{ invoice.status | titlecase }}</p>
            </div>
            <div class="row-actions">
              <span>{{ '$' + invoice.amount }}</span>
              @if (allowOnlinePayment() && invoice.status === 'unpaid') {
              <otui-button variant="primary" (action)="payInvoice(invoice.id)"
                >Pay now</otui-button
              >
              }
            </div>
          </div>
          } @empty {
          <p class="empty">
            Invoices will appear here after completed sessions are billed.
          </p>
          }
        </div>
      </otui-card>

      <otui-card>
        <h2>Billing and session history</h2>
        <div class="rows">
          @for (booking of bookings(); track booking.id) {
          <div class="row">
            <div>
              <strong>{{ booking.title }}</strong>
              <p>{{ booking.status }}</p>
            </div>
            <span>{{
              booking.totalCost ? '$' + booking.totalCost : 'Pending'
            }}</span>
          </div>
          } @empty {
          <p class="empty">Approved and invoiced sessions will surface here.</p>
          }
        </div>
      </otui-card>
    </section>
  `,
  styles: [
    `
      .stack,
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
      .row-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
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
export class BusinessClientBillingPageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly auth = inject(BusinessAuthService);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly clientId = computed(
    () => this.auth.clientUser()?.userId ?? ''
  );
  readonly allowOnlinePayment = computed(
    () => this.siteConfig.site().features.booking.allowOnlinePayment === true
  );
  readonly bookings = toSignal(
    toObservable(this.clientId).pipe(
      switchMap((id) => (id ? this.api.getClientBookings() : of([])))
    ),
    { initialValue: [] }
  );
  readonly invoices = toSignal(
    toObservable(this.clientId).pipe(
      switchMap((id) => (id ? this.api.getClientInvoices() : of([])))
    ),
    { initialValue: [] }
  );

  payInvoice(id: string): void {
    if (!this.allowOnlinePayment()) {
      return;
    }

    this.api.payClientInvoice(id).subscribe();
  }
}
