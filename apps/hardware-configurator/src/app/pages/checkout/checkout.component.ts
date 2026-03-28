import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  HardwareService,
  ConfigurationDto,
  ShippingAddress,
  PriceBreakdown,
  Order,
} from '../../services/hardware.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="checkout-container">
      <header class="checkout-header">
        <button class="back-btn" (click)="goBack()">← Back to Review</button>
        <h1>Checkout</h1>
      </header>

      <div class="checkout-grid">
        <form class="shipping-form" (ngSubmit)="submitOrder()">
          <h3>Shipping Information</h3>

          <div class="form-group">
            <label>Full Name</label>
            <input
              type="text"
              [(ngModel)]="shipping.name"
              name="name"
              required
            />
          </div>

          <div class="form-group">
            <label>Email Address</label>
            <input
              type="email"
              [(ngModel)]="customerEmail"
              name="email"
              required
            />
          </div>

          <div class="form-group">
            <label>Street Address</label>
            <input
              type="text"
              [(ngModel)]="shipping.street"
              name="street"
              required
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>City</label>
              <input
                type="text"
                [(ngModel)]="shipping.city"
                name="city"
                required
              />
            </div>
            <div class="form-group">
              <label>State</label>
              <input
                type="text"
                [(ngModel)]="shipping.state"
                name="state"
                required
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>ZIP Code</label>
              <input
                type="text"
                [(ngModel)]="shipping.zip"
                name="zip"
                required
              />
            </div>
            <div class="form-group">
              <label>Country</label>
              <input
                type="text"
                [(ngModel)]="shipping.country"
                name="country"
                required
              />
            </div>
          </div>

          <div class="order-summary">
            <h4>Order Total: \${{ priceBreakdown?.totalPrice || 0 }}</h4>
          </div>

          <button type="submit" class="submit-btn" [disabled]="!isValid()">
            Place Order
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .checkout-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
      }

      .checkout-header {
        margin-bottom: 2rem;
      }

      .back-btn {
        background: none;
        border: 1px solid #444;
        color: #888;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        margin-bottom: 1rem;
      }

      .back-btn:hover {
        border-color: #4a9eff;
        color: #4a9eff;
      }

      .checkout-header h1 {
        color: #fff;
        margin: 0;
      }

      .checkout-grid {
        display: grid;
        gap: 2rem;
      }

      .shipping-form {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 2rem;
      }

      .shipping-form h3 {
        color: #fff;
        margin: 0 0 1.5rem 0;
      }

      .form-group {
        margin-bottom: 1rem;
      }

      .form-group label {
        display: block;
        color: #888;
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
      }

      .form-group input {
        width: 100%;
        padding: 0.75rem;
        background: #0a0a0a;
        border: 1px solid #333;
        border-radius: 6px;
        color: #fff;
        font-size: 1rem;
      }

      .form-group input:focus {
        outline: none;
        border-color: #4a9eff;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .order-summary {
        background: #0a0a0a;
        padding: 1rem;
        border-radius: 8px;
        margin: 1.5rem 0;
      }

      .order-summary h4 {
        color: #4ade80;
        margin: 0;
        font-size: 1.25rem;
      }

      .submit-btn {
        width: 100%;
        padding: 1rem;
        background: #4a9eff;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
      }

      .submit-btn:hover:not(:disabled) {
        background: #3a8eef;
      }

      .submit-btn:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
      }
    `,
  ],
})
export class CheckoutComponent implements OnInit {
  shipping: ShippingAddress = {
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'USA',
  };
  customerEmail = '';
  priceBreakdown: PriceBreakdown | null = null;
  config: ConfigurationDto | null = null;

  constructor(
    private router: Router,
    private hardwareService: HardwareService
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('hw_config');
    if (!saved) {
      this.router.navigate(['/']);
      return;
    }

    this.config = JSON.parse(saved);
    this.hardwareService.calculatePrice(this.config!).subscribe({
      next: (price) => (this.priceBreakdown = price),
    });
  }

  isValid(): boolean {
    return !!(
      this.shipping.name &&
      this.customerEmail &&
      this.shipping.street &&
      this.shipping.city &&
      this.shipping.state &&
      this.shipping.zip &&
      this.shipping.country
    );
  }

  goBack(): void {
    this.router.navigate(['/review']);
  }

  submitOrder(): void {
    if (!this.config || !this.isValid()) return;

    this.hardwareService
      .createOrder(this.config, this.shipping, this.customerEmail)
      .subscribe({
        next: (order) => {
          localStorage.removeItem('hw_config');
          this.router.navigate(['/confirmation', order.id]);
        },
        error: (err) => {
          console.error('Failed to create order:', err);
          alert('Failed to create order. Please try again.');
        },
      });
  }
}
