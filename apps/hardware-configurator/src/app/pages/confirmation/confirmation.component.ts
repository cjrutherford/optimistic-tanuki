import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HardwareService, Order } from '../../services/hardware.service';

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirmation-container">
      <div class="confirmation-card" *ngIf="order">
        <div class="success-icon">✓</div>
        <h1>Order Confirmed!</h1>
        <p class="order-id">Order #{{ order.id }}</p>

        <div class="order-details">
          <div class="detail-section">
            <h3>Shipping To</h3>
            <p>{{ order.shippingAddress.name }}</p>
            <p>{{ order.shippingAddress.street }}</p>
            <p>
              {{ order.shippingAddress.city }},
              {{ order.shippingAddress.state }} {{ order.shippingAddress.zip }}
            </p>
          </div>

          <div class="detail-section">
            <h3>Order Status</h3>
            <p class="status">{{ order.status | uppercase }}</p>
            <p *ngIf="order.estimatedDelivery">
              Estimated Delivery:
              {{ order.estimatedDelivery | date : 'mediumDate' }}
            </p>
          </div>

          <div class="detail-section">
            <h3>Total</h3>
            <p class="total">\${{ order.priceBreakdown.totalPrice }}</p>
          </div>
        </div>

        <button class="home-btn" (click)="goHome()">
          Build Another System
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .confirmation-container {
        max-width: 600px;
        margin: 0 auto;
        padding: 2rem;
      }

      .confirmation-card {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 3rem;
        text-align: center;
      }

      .success-icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: #22c55e;
        color: #fff;
        font-size: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.5rem;
      }

      .confirmation-card h1 {
        color: #fff;
        margin: 0 0 0.5rem 0;
      }

      .order-id {
        color: #4a9eff;
        font-size: 1.1rem;
        margin: 0 0 2rem 0;
      }

      .order-details {
        text-align: left;
        margin: 2rem 0;
        padding: 1.5rem;
        background: #0a0a0a;
        border-radius: 8px;
      }

      .detail-section {
        margin-bottom: 1.5rem;
      }

      .detail-section:last-child {
        margin-bottom: 0;
      }

      .detail-section h3 {
        color: #888;
        font-size: 0.8rem;
        text-transform: uppercase;
        margin: 0 0 0.5rem 0;
      }

      .detail-section p {
        color: #fff;
        margin: 0;
        line-height: 1.5;
      }

      .detail-section .status {
        color: #4ade80;
        font-weight: 600;
      }

      .detail-section .total {
        font-size: 1.5rem;
        font-weight: 600;
        color: #4ade80;
      }

      .home-btn {
        padding: 1rem 2rem;
        background: #4a9eff;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
      }

      .home-btn:hover {
        background: #3a8eef;
      }
    `,
  ],
})
export class ConfirmationComponent implements OnInit {
  order: Order | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private hardwareService: HardwareService
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) {
      this.router.navigate(['/']);
      return;
    }

    this.hardwareService.getOrder(orderId).subscribe({
      next: (order) => (this.order = order),
      error: () => {
        this.router.navigate(['/']);
      },
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
