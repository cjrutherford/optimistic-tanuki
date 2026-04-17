import {
  Component,
  inject,
  signal,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, Payment } from '../../services/payment.service';

export type PaymentMethodOption =
  | 'card'
  | 'cash-app'
  | 'venmo'
  | 'zelle'
  | 'cash';

export interface PaymentRequest {
  classifiedId: string;
  sellerId: string;
  amount: number;
  title: string;
}

@Component({
  selector: 'app-payment-method-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="payment-modal">
      <div class="modal-header">
        <h3>Complete Your Purchase</h3>
        <button class="close-btn" (click)="cancel.emit()">×</button>
      </div>

      @if (step() === 'method') {
      <div class="modal-body">
        <div class="item-summary">
          <h4>{{ request?.title }}</h4>
          <p class="price">\${{ request?.amount | number : '1.2-2' }}</p>
        </div>

        <div class="payment-methods">
          <h5>Choose Payment Method</h5>

          <div class="method-cards">
            <button
              class="method-card"
              [class.selected]="selectedMethod() === 'card'"
              (click)="selectMethod('card')"
            >
              <span class="icon">💳</span>
              <span class="label">Credit/Debit Card</span>
              <span class="desc">Pay securely online</span>
            </button>

            <button
              class="method-card"
              [class.selected]="selectedMethod() === 'cash-app'"
              (click)="selectMethod('cash-app')"
            >
              <span class="icon">💸</span>
              <span class="label">Cash App</span>
              <span class="desc">Pay with Cash App</span>
            </button>

            <button
              class="method-card"
              [class.selected]="selectedMethod() === 'venmo'"
              (click)="selectMethod('venmo')"
            >
              <span class="icon">💵</span>
              <span class="label">Venmo</span>
              <span class="desc">Pay with Venmo</span>
            </button>

            <button
              class="method-card"
              [class.selected]="selectedMethod() === 'zelle'"
              (click)="selectMethod('zelle')"
            >
              <span class="icon">🏦</span>
              <span class="label">Zelle</span>
              <span class="desc">Bank transfer</span>
            </button>

            <button
              class="method-card"
              [class.selected]="selectedMethod() === 'cash'"
              (click)="selectMethod('cash')"
            >
              <span class="icon">💴</span>
              <span class="label">Cash</span>
              <span class="desc">Pay in person</span>
            </button>
          </div>
        </div>

        @if (selectedMethod() !== 'card') {
        <div class="out-of-platform-info">
          <div class="info-box">
            <h5>How {{ getMethodName(selectedMethod()!) }} Works</h5>
            <ol>
              <li>Click "Continue" below</li>
              <li>
                You'll see the seller's
                {{ getMethodName(selectedMethod()!) }} handle/contact info
              </li>
              <li>Send payment to the seller</li>
              <li>Mark payment as "Sent" and optionally upload proof</li>
              <li>Once seller confirms, funds are released</li>
            </ol>
          </div>
        </div>
        }
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" (click)="cancel.emit()">Cancel</button>
        <button
          class="btn-primary"
          [disabled]="!selectedMethod()"
          (click)="proceed()"
        >
          Continue
        </button>
      </div>
      } @if (step() === 'out-of-platform') {
      <div class="modal-body">
        <div class="out-of-platform-details">
          <h4>Send Payment via {{ getMethodName(selectedMethod()!) }}</h4>

          <div class="seller-info">
            <p class="instruction">
              Please send
              <strong>\${{ request?.amount | number : '1.2-2' }}</strong> to
              the seller using {{ getMethodName(selectedMethod()!) }}.
            </p>

            <div class="proof-upload">
              <label>Upload payment proof (optional but recommended)</label>
              <input
                type="file"
                accept="image/*"
                (change)="onProofSelected($event)"
              />
              @if (proofImage()) {
              <img
                [src]="proofImage()"
                class="proof-preview"
                alt="Payment proof"
              />
              }
            </div>
          </div>

          <div class="confirm-checkbox">
            <label>
              <input type="checkbox" [(ngModel)]="paymentSent" />
              <span>I have sent the payment</span>
            </label>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" (click)="step.set('method')">Back</button>
        <button
          class="btn-primary"
          [disabled]="!paymentSent || processing()"
          (click)="confirmPayment()"
        >
          @if (processing()) { Processing... } @else { Confirm Payment Sent }
        </button>
      </div>
      } @if (step() === 'success') {
      <div class="modal-body success-state">
        <div class="success-icon">✓</div>
        <h4>Payment Initiated!</h4>
        <p>
          Your payment is pending. Once the seller confirms receipt, you'll be
          notified.
        </p>
      </div>

      <div class="modal-footer">
        <button class="btn-primary" (click)="complete.emit(payment()!)">
          Done
        </button>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .payment-modal {
        background: white;
        border-radius: 16px;
        max-width: 500px;
        width: 100%;
        overflow: hidden;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid #eee;
      }

      .modal-header h3 {
        margin: 0;
        font-size: 1.25rem;
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
      }

      .modal-body {
        padding: 24px;
      }

      .item-summary {
        background: #f9f9f9;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 24px;
      }

      .item-summary h4 {
        margin: 0 0 8px;
      }

      .item-summary .price {
        font-size: 1.5rem;
        font-weight: 700;
        color: #2d3436;
        margin: 0;
      }

      .payment-methods h5 {
        margin: 0 0 16px;
        font-size: 0.875rem;
        color: #666;
      }

      .method-cards {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .method-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border: 2px solid #eee;
        border-radius: 12px;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
      }

      .method-card:hover {
        border-color: #6b8e6b;
      }

      .method-card.selected {
        border-color: #6b8e6b;
        background: #f8faf8;
      }

      .method-card .icon {
        font-size: 1.5rem;
      }

      .method-card .label {
        flex: 1;
        font-weight: 600;
      }

      .method-card .desc {
        font-size: 0.75rem;
        color: #999;
      }

      .out-of-platform-info {
        margin-top: 24px;
      }

      .info-box {
        background: #fff8e6;
        padding: 16px;
        border-radius: 8px;
      }

      .info-box h5 {
        margin: 0 0 12px;
      }

      .info-box ol {
        margin: 0;
        padding-left: 20px;
      }

      .info-box li {
        margin-bottom: 8px;
        font-size: 0.875rem;
      }

      .seller-info {
        margin-bottom: 24px;
      }

      .instruction {
        font-size: 1rem;
        margin-bottom: 16px;
      }

      .proof-upload {
        margin-top: 16px;
      }

      .proof-upload label {
        display: block;
        margin-bottom: 8px;
        font-size: 0.875rem;
        color: #666;
      }

      .proof-preview {
        max-width: 200px;
        margin-top: 12px;
        border-radius: 8px;
      }

      .confirm-checkbox {
        margin-top: 24px;
      }

      .confirm-checkbox label {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
      }

      .confirm-checkbox input {
        width: 20px;
        height: 20px;
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px;
        border-top: 1px solid #eee;
      }

      .btn-secondary {
        padding: 12px 24px;
        border: 2px solid #ddd;
        border-radius: 8px;
        background: white;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-primary {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        background: #6b8e6b;
        color: white;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .success-state {
        text-align: center;
        padding: 48px 24px;
      }

      .success-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: #27ae60;
        color: white;
        font-size: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 24px;
      }
    `,
  ],
})
export class PaymentMethodSelectorComponent {
  private paymentService = inject(PaymentService);

  @Input() request: PaymentRequest | null = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() complete = new EventEmitter<Payment>();

  readonly step = signal<'method' | 'out-of-platform' | 'success'>('method');
  readonly selectedMethod = signal<PaymentMethodOption | null>(null);
  readonly processing = signal(false);
  readonly proofImage = signal<string | null>(null);
  readonly payment = signal<Payment | null>(null);

  paymentSent = false;

  selectMethod(method: PaymentMethodOption): void {
    this.selectedMethod.set(method);
  }

  getMethodName(method: PaymentMethodOption): string {
    const names: Record<PaymentMethodOption, string> = {
      card: 'Card',
      'cash-app': 'Cash App',
      venmo: 'Venmo',
      zelle: 'Zelle',
      cash: 'Cash',
    };
    return names[method];
  }

  onProofSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.proofImage.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async proceed(): Promise<void> {
    const method = this.selectedMethod();
    if (!method || !this.request) return;

    if (method === 'card') {
      this.processing.set(true);
      try {
        const payment = await this.paymentService.createClassifiedPayment(
          this.request.classifiedId,
          method
        );
        const checkoutUrl = payment.checkoutUrl;
        if (payment.paymentMethod === 'card' && checkoutUrl) {
          window.location.href = checkoutUrl;
          return;
        }
        throw new Error(
          'Card checkout is not configured yet. Please choose another payment method.'
        );
      } catch (error) {
        console.error('Payment failed:', error);
      } finally {
        this.processing.set(false);
      }
    } else {
      this.step.set('out-of-platform');
    }
  }

  async confirmPayment(): Promise<void> {
    if (!this.request || !this.selectedMethod()) return;

    this.processing.set(true);
    try {
      const payment = await this.paymentService.createClassifiedPayment(
        this.request.classifiedId,
        this.selectedMethod()!
      );

      if (this.proofImage()) {
        await this.paymentService.confirmOutOfPlatformPayment(
          payment.id,
          this.proofImage() || undefined
        );
      }

      this.payment.set(payment);
      this.step.set('success');
    } catch (error) {
      console.error('Payment confirmation failed:', error);
    } finally {
      this.processing.set(false);
    }
  }
}
