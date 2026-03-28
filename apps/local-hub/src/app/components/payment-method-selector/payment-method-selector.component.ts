import {
  Component,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  Input,
  Output,
  EventEmitter,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ClassifiedPaymentCheckoutInitialization,
  PaymentService,
  Payment,
} from '../../services/payment.service';
import {
  loadStripe,
  Stripe,
  StripeElements,
  StripePaymentElement,
} from '@stripe/stripe-js';

declare global {
  interface Window {
    appendHelcimPayIframe?: (checkoutToken: string, allowExit?: boolean) => void;
    removeHelcimPayIframe?: () => void;
  }
}

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
        <button class="close-btn" (click)="close()">×</button>
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

        @if (checkoutError()) {
        <div class="checkout-error">{{ checkoutError() }}</div>
        }
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" (click)="close()">Cancel</button>
        <button
          class="btn-primary"
          [disabled]="!selectedMethod()"
          (click)="proceed()"
        >
          Continue
        </button>
      </div>
      } @if (step() === 'stripe-checkout') {
      <div class="modal-body">
        <div class="item-summary">
          <h4>{{ request?.title }}</h4>
          <p class="price">\${{ request?.amount | number : '1.2-2' }}</p>
        </div>

        <div class="stripe-panel">
          <h5>Secure Card Checkout</h5>
          <p class="stripe-copy">
            Enter your card details below to complete this purchase through
            Stripe.
          </p>

          <div
            #stripePaymentElement
            class="stripe-payment-element"
            [class.loading]="!stripeReady()"
          ></div>

          @if (!stripeReady()) {
          <p class="stripe-status">Preparing secure checkout...</p>
          }

          @if (checkoutError()) {
          <div class="checkout-error">{{ checkoutError() }}</div>
          }
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" (click)="backToMethodSelection()">
          Back
        </button>
        <button
          class="btn-primary"
          [disabled]="processing() || !stripeReady()"
          (click)="submitStripePayment()"
        >
          @if (processing()) { Processing... } @else { Pay Now }
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

      .checkout-error {
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: 8px;
        background: #fff1f0;
        color: #c0392b;
        font-size: 0.875rem;
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

      .stripe-panel {
        padding: 18px;
        border: 1px solid #dfe8df;
        border-radius: 12px;
        background: linear-gradient(180deg, #fbfdfb 0%, #f4f8f4 100%);
      }

      .stripe-panel h5 {
        margin: 0 0 8px;
        font-size: 0.95rem;
      }

      .stripe-copy {
        margin: 0 0 16px;
        color: #4d5b4d;
        font-size: 0.9rem;
      }

      .stripe-payment-element {
        min-height: 180px;
        padding: 12px;
        border-radius: 12px;
        background: white;
        border: 1px solid #d9e2d9;
      }

      .stripe-payment-element.loading {
        opacity: 0.7;
      }

      .stripe-status {
        margin: 12px 0 0;
        font-size: 0.85rem;
        color: #5f6c5f;
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
export class PaymentMethodSelectorComponent implements OnDestroy {
  private paymentService = inject(PaymentService);

  @ViewChild('stripePaymentElement')
  private stripePaymentElementHost?: ElementRef<HTMLDivElement>;

  @Input() request: PaymentRequest | null = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() complete = new EventEmitter<Payment>();

  readonly step = signal<
    'method' | 'stripe-checkout' | 'out-of-platform' | 'success'
  >('method');
  readonly selectedMethod = signal<PaymentMethodOption | null>(null);
  readonly processing = signal(false);
  readonly proofImage = signal<string | null>(null);
  readonly payment = signal<Payment | null>(null);
  readonly checkoutError = signal<string | null>(null);
  readonly stripeReady = signal(false);

  paymentSent = false;
  private stripe: Stripe | null = null;
  private stripeElements: StripeElements | null = null;
  private stripePaymentElement: StripePaymentElement | null = null;
  private stripePaymentId: string | null = null;

  ngOnDestroy(): void {
    this.destroyStripeCheckout();
  }

  selectMethod(method: PaymentMethodOption): void {
    this.checkoutError.set(null);
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

    this.checkoutError.set(null);

    if (method === 'card') {
      this.processing.set(true);
      try {
        const session = await this.paymentService.initializeClassifiedPayment(
          this.request.classifiedId,
          this.request.amount,
          this.request.sellerId
        );

        if (session.provider === 'stripe-connect') {
          await this.launchStripeCheckout(session);
          return;
        }

        if (session.provider !== 'helcim' || !session.checkoutToken) {
          this.checkoutError.set(
            'Card checkout is not available for this listing yet. Please choose another payment method.'
          );
          return;
        }

        await this.launchHelcimCheckout(session.paymentId, session.checkoutToken);
      } catch (error) {
        console.error('Payment failed:', error);
        this.checkoutError.set(
          'Unable to start card checkout right now. Please try again or choose another method.'
        );
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
    this.checkoutError.set(null);
    try {
      let payment = await this.paymentService.createClassifiedPayment(
        this.request.classifiedId,
        this.selectedMethod()!,
        this.request.amount,
        this.request.sellerId
      );

      if (this.proofImage()) {
        payment = await this.paymentService.confirmOutOfPlatformPayment(
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

  async submitStripePayment(): Promise<void> {
    if (!this.stripe || !this.stripeElements || !this.stripePaymentId) {
      this.checkoutError.set(
        'Stripe checkout is not ready yet. Please try again.'
      );
      return;
    }

    this.processing.set(true);
    this.checkoutError.set(null);

    try {
      const result = await this.stripe.confirmPayment({
        elements: this.stripeElements,
        redirect: 'if_required',
      });

      if (result.error) {
        this.checkoutError.set(
          result.error.message ||
            'Unable to confirm your card right now. Please check your details and try again.'
        );
        return;
      }

      const confirmation = await this.paymentService.confirmStripeClassifiedPayment(
        this.stripePaymentId,
        result.paymentIntent?.id
      );

      this.payment.set(confirmation.payment);
      this.destroyStripeCheckout();
      this.step.set('success');
    } catch (error) {
      console.error('Stripe payment confirmation failed:', error);
      this.checkoutError.set(
        'Unable to complete card checkout right now. Please try again or choose another method.'
      );
    } finally {
      this.processing.set(false);
    }
  }

  backToMethodSelection(): void {
    this.destroyStripeCheckout();
    this.checkoutError.set(null);
    this.step.set('method');
  }

  close(): void {
    this.destroyStripeCheckout();
    this.cancel.emit();
  }

  private async ensureHelcimScript(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Helcim checkout is only available in the browser');
    }

    if (window.appendHelcimPayIframe) {
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-helcim-pay="true"]'
    );

    if (existingScript) {
      await new Promise<void>((resolve, reject) => {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Helcim checkout')), {
          once: true,
        });
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://secure.helcim.app/helcim-pay/services/start.js';
      script.async = true;
      script.dataset['helcimPay'] = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Helcim checkout'));
      document.body.appendChild(script);
    });
  }

  private async launchHelcimCheckout(
    paymentId: string,
    checkoutToken: string
  ): Promise<void> {
    await this.ensureHelcimScript();

    const eventName = `helcim-pay-js-${checkoutToken}`;

    await new Promise<void>((resolve, reject) => {
      const onMessage = async (event: MessageEvent) => {
        if (!event.data || event.data.eventName !== eventName) {
          return;
        }

        window.removeEventListener('message', onMessage);

        if (event.data.eventStatus === 'ABORTED' || event.data.eventStatus === 'HIDE') {
          this.checkoutError.set('Card checkout was closed before the payment was completed.');
          resolve();
          return;
        }

        if (event.data.eventStatus !== 'SUCCESS' || !event.data.eventMessage) {
          reject(new Error('Unexpected Helcim checkout response'));
          return;
        }

        try {
          const result = await this.paymentService.validateClassifiedPayment(
            paymentId,
            checkoutToken,
            event.data.eventMessage
          );

          this.payment.set(result.payment);
          this.step.set('success');
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      window.addEventListener('message', onMessage);

      try {
        window.appendHelcimPayIframe?.(checkoutToken, true);
      } catch (error) {
        window.removeEventListener('message', onMessage);
        reject(error);
      }
    });
  }

  private async launchStripeCheckout(
    session: ClassifiedPaymentCheckoutInitialization
  ): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Stripe checkout is only available in the browser');
    }

    if (!session.clientSecret || !session.publishableKey) {
      throw new Error('Stripe checkout session is missing required configuration');
    }

    this.destroyStripeCheckout();
    this.stripeReady.set(false);
    this.step.set('stripe-checkout');
    this.stripePaymentId = session.paymentId;

    const stripe = await loadStripe(session.publishableKey);

    if (!stripe) {
      throw new Error('Unable to initialize Stripe checkout');
    }

    this.stripe = stripe;
    const container = await this.waitForStripeContainer();

    this.stripeElements = stripe.elements({
      clientSecret: session.clientSecret,
      appearance: {
        variables: {
          colorPrimary: '#6b8e6b',
          borderRadius: '12px',
        },
      },
    });
    this.stripePaymentElement = this.stripeElements.create('payment', {
      layout: 'tabs',
    });
    this.stripePaymentElement.mount(container);
    this.stripeReady.set(true);
  }

  private async waitForStripeContainer(): Promise<HTMLDivElement> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const container = this.stripePaymentElementHost?.nativeElement;
      if (container) {
        return container;
      }
    }

    throw new Error('Stripe checkout container was not rendered');
  }

  private destroyStripeCheckout(): void {
    this.stripePaymentElement?.unmount();
    this.stripePaymentElement = null;
    this.stripeElements = null;
    this.stripe = null;
    this.stripePaymentId = null;
    this.stripeReady.set(false);
  }
}
