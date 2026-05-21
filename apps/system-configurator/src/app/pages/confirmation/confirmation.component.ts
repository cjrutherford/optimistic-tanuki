import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HardwareService, Order } from '../../services/hardware.service';

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="confirmation-shell" *ngIf="order() as currentOrder; else confirmationState">
      <div class="confirmation-card">
        <p class="eyebrow">HAI Confirmation</p>
        <h1>Order accepted into the integration queue.</h1>
        <p class="lede">
          Your HAI Computer system has been recorded and linked to the selected
          profile for fulfillment follow-up and delivery coordination.
        </p>

        <div class="confirmation-grid">
          <article>
            <span>Order ID</span>
            <strong>#{{ currentOrder.id }}</strong>
          </article>
          <article>
            <span>Status</span>
            <strong>{{ currentOrder.status | uppercase }}</strong>
          </article>
          <article>
            <span>Total</span>
            <strong>\${{ currentOrder.priceBreakdown.totalPrice }}</strong>
          </article>
          <article *ngIf="currentOrder.estimatedDelivery">
            <span>Estimated delivery</span>
            <strong>{{ currentOrder.estimatedDelivery | date: 'mediumDate' }}</strong>
          </article>
        </div>

        <section class="shipping-panel">
          <p class="eyebrow">Delivery destination</p>
          <strong>{{ currentOrder.shippingAddress.name }}</strong>
          <p>{{ currentOrder.shippingAddress.street }}</p>
          <p>
            {{ currentOrder.shippingAddress.city }},
            {{ currentOrder.shippingAddress.state }}
            {{ currentOrder.shippingAddress.zip }}
          </p>
          <p>{{ currentOrder.shippingAddress.country }}</p>
        </section>

        <div class="actions">
          <button type="button" class="primary-action" (click)="goHome()">
            Start another build
          </button>
        </div>
      </div>
    </section>

    <ng-template #confirmationState>
      <section class="confirmation-shell">
        <div class="confirmation-card">
          <p class="eyebrow">HAI Confirmation</p>
          <h1>{{ loading() ? 'Loading order confirmation...' : 'Order confirmation unavailable' }}</h1>
          <p class="lede">
            {{
              errorMessage() ||
                'Retrieving the latest order state from the HAI fulfillment service.'
            }}
          </p>
        </div>
      </section>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .confirmation-shell {
        min-height: calc(100vh - 8rem);
        display: grid;
        place-items: center;
        padding: 2rem;
      }

      .confirmation-card {
        width: min(820px, 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 2rem;
        padding: clamp(1.5rem, 4vw, 3rem);
        background:
          radial-gradient(circle at top right, rgba(45, 212, 191, 0.16), transparent 30%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
          rgba(4, 12, 15, 0.84);
      }

      .eyebrow,
      .confirmation-grid span {
        margin: 0 0 0.45rem;
        display: block;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.74rem;
        color: #92efe2;
      }

      h1 {
        margin: 0;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: clamp(2.5rem, 7vw, 4.6rem);
        line-height: 0.98;
      }

      .lede,
      .shipping-panel p {
        color: rgba(235, 255, 251, 0.74);
        line-height: 1.6;
      }

      .confirmation-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
        margin: 1.5rem 0;
      }

      .confirmation-grid article,
      .shipping-panel {
        border-radius: 1.5rem;
        padding: 1rem 1.1rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
      }

      .confirmation-grid strong,
      .shipping-panel strong {
        font-size: 1.2rem;
      }

      .actions {
        margin-top: 1.5rem;
      }

      .primary-action {
        border: 0;
        border-radius: 999px;
        padding: 1rem 1.25rem;
        background: linear-gradient(135deg, #79f0e0, #2dd4bf);
        color: #031011;
        font-weight: 700;
        cursor: pointer;
      }

      @media (max-width: 640px) {
        .confirmation-shell {
          padding: 1rem;
        }

        .confirmation-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ConfirmationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hardwareService = inject(HardwareService);

  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) {
      this.router.navigate(['/']);
      return;
    }

    this.hardwareService.getOrder(orderId).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
        this.errorMessage.set('');
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set(
          'The HAI order record could not be loaded. Please return to the catalog or retry later.'
        );
      },
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
