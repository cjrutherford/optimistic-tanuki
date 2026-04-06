import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  TextInputComponent,
  SelectComponent,
} from '@optimistic-tanuki/form-ui';
import {
  PaymentMethodOption,
  PaymentMethodSelectorComponent,
} from '@optimistic-tanuki/payments-ui';
import {
  HardwareService,
  PriceBreakdown,
  ShippingAddress,
} from '../../services/hardware.service';
import { ConfiguratorStateService } from '../../state/configurator-state.service';
import { ProfileService } from '../../state/profile.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TextInputComponent,
    SelectComponent,
    PaymentMethodSelectorComponent,
  ],
  template: `
    <section class="checkout-shell" *ngIf="draft()">
      <header class="checkout-header">
        <button type="button" class="back-link" (click)="goBack()">
          Back to review
        </button>
        <div class="header-grid">
          <div>
            <p class="eyebrow">HAI Order Intake</p>
            <h1>Shipping and payment coordination</h1>
          </div>
          <div class="profile-note">
            <span>Active profile</span>
            <strong>{{ activeProfileName() }}</strong>
            <small>Checkout is linked to the selected HAI identity.</small>
          </div>
        </div>
      </header>

      <section class="payment-note" *ngIf="errorMessage()">
        <p class="eyebrow">Submission status</p>
        <strong>Order submission needs attention.</strong>
        <p>{{ errorMessage() }}</p>
      </section>

      <div class="checkout-layout">
        <form class="checkout-form" (ngSubmit)="submitOrder()">
          <section class="form-section">
            <p class="eyebrow">Shipping contact</p>
            <div class="field-grid">
              <lib-text-input
                [(ngModel)]="shipping.name"
                name="name"
                label="Full name"
                placeholder="Alex Integrator"
              ></lib-text-input>
              <lib-text-input
                [(ngModel)]="customerEmail"
                name="customerEmail"
                label="Email"
                placeholder="alex@hai.example"
                type="text"
              ></lib-text-input>
              <lib-text-input
                class="span-2"
                [(ngModel)]="shipping.street"
                name="street"
                label="Street address"
                placeholder="204 Deployment Lane"
              ></lib-text-input>
              <lib-text-input
                [(ngModel)]="shipping.city"
                name="city"
                label="City"
                placeholder="Savannah"
              ></lib-text-input>
              <lib-text-input
                [(ngModel)]="shipping.state"
                name="state"
                label="State"
                placeholder="Georgia"
              ></lib-text-input>
              <lib-text-input
                [(ngModel)]="shipping.zip"
                name="zip"
                label="ZIP code"
                placeholder="31401"
              ></lib-text-input>
              <div class="country-field">
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label>Country</label>
                <lib-select
                  [(ngModel)]="shipping.country"
                  name="country"
                  [options]="countryOptions"
                ></lib-select>
              </div>
            </div>
          </section>

          <section class="form-section">
            <otui-payment-method-selector
              [title]="'Select payment handling'"
              [description]="
                'Card is the primary HAI path. Manual methods are available when deployment support requires assisted settlement.'
              "
              [selected]="paymentMethod"
              (methodChange)="onPaymentMethodChange($event)"
            ></otui-payment-method-selector>
          </section>

          <section class="payment-note">
            <p class="eyebrow">Payment adapter</p>
            <strong>{{ paymentHeadline() }}</strong>
            <p>{{ paymentCopy() }}</p>
          </section>

          <button
            type="submit"
            class="submit-action"
            [disabled]="submitting() || !isValid()"
          >
            {{ submitting() ? 'Submitting order...' : 'Create order' }}
          </button>
        </form>

        <aside class="summary-card" *ngIf="price() as totals">
          <p class="eyebrow">Order snapshot</p>
          <h2>\${{ totals.totalPrice }}</h2>
          <div class="summary-rows">
            <div>
              <span>Chassis</span><strong>\${{ totals.chassisPrice }}</strong>
            </div>
            <div>
              <span>CPU</span><strong>\${{ totals.cpuPrice }}</strong>
            </div>
            <div>
              <span>RAM</span><strong>\${{ totals.ramPrice }}</strong>
            </div>
            <div>
              <span>Storage</span><strong>\${{ totals.storagePrice }}</strong>
            </div>
            <div *ngIf="totals.gpuPrice > 0">
              <span>GPU</span><strong>\${{ totals.gpuPrice }}</strong>
            </div>
            <div>
              <span>Assembly</span><strong>\${{ totals.assemblyFee }}</strong>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .checkout-shell {
        max-width: 1280px;
        margin: 0 auto;
        padding: 1.5rem 2rem 2rem;
      }

      .checkout-header,
      .checkout-form,
      .summary-card,
      .payment-note {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 1.8rem;
        background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.04),
            rgba(255, 255, 255, 0.015)
          ),
          rgba(4, 12, 15, 0.78);
      }

      .checkout-header,
      .checkout-form,
      .summary-card,
      .payment-note {
        padding: 1.25rem;
      }

      .back-link {
        border: 0;
        background: transparent;
        color: #97f5e7;
        padding: 0;
        cursor: pointer;
      }

      .header-grid,
      .checkout-layout {
        display: grid;
        gap: 1.5rem;
      }

      .header-grid {
        grid-template-columns: minmax(0, 1fr) 300px;
        align-items: end;
        margin-top: 1rem;
      }

      .eyebrow {
        margin: 0 0 0.45rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.74rem;
        color: #92efe2;
      }

      h1,
      h2 {
        margin: 0;
        font-family: Georgia, 'Times New Roman', serif;
      }

      h1 {
        font-size: clamp(2.2rem, 6vw, 4rem);
      }

      .profile-note {
        border-radius: 1.25rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.03);
      }

      .profile-note span,
      .summary-rows span {
        display: block;
        margin-bottom: 0.3rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.68rem;
        color: rgba(146, 239, 226, 0.72);
      }

      .profile-note small,
      .payment-note p {
        color: rgba(235, 255, 251, 0.72);
      }

      .checkout-layout {
        grid-template-columns: minmax(0, 1fr) 320px;
        align-items: start;
        margin-top: 1.5rem;
      }

      .checkout-form {
        display: grid;
        gap: 1rem;
      }

      .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .span-2,
      .country-field {
        grid-column: span 2;
      }

      .country-field label {
        display: block;
        margin-bottom: 0.5rem;
        color: rgba(235, 255, 251, 0.74);
      }

      .payment-note strong {
        display: block;
        margin-bottom: 0.4rem;
        font-size: 1.1rem;
      }

      .submit-action {
        border: 0;
        border-radius: 999px;
        padding: 1rem 1.2rem;
        background: linear-gradient(135deg, #79f0e0, #2dd4bf);
        color: #031011;
        font-weight: 700;
        cursor: pointer;
      }

      .submit-action:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .summary-card {
        position: sticky;
        top: 6.5rem;
      }

      .summary-card h2 {
        font-size: 2.2rem;
        margin-bottom: 1rem;
      }

      .summary-rows {
        display: grid;
        gap: 0.8rem;
      }

      .summary-rows div {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 0.7rem;
      }

      @media (max-width: 980px) {
        .header-grid,
        .checkout-layout {
          grid-template-columns: 1fr;
        }

        .summary-card {
          position: static;
        }
      }

      @media (max-width: 640px) {
        .checkout-shell {
          padding: 1rem;
        }

        .field-grid {
          grid-template-columns: 1fr;
        }

        .span-2,
        .country-field {
          grid-column: span 1;
        }
      }
    `,
  ],
})
export class CheckoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly hardwareService = inject(HardwareService);
  private readonly configuratorState = inject(ConfiguratorStateService);
  private readonly profileService = inject(ProfileService);

  readonly draft = computed(() => this.configuratorState.draft());
  readonly price = signal<PriceBreakdown | null>(
    this.configuratorState.priceBreakdown()
  );
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  shipping: ShippingAddress = {
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'USA',
  };
  customerEmail = '';
  paymentMethod: PaymentMethodOption = 'card';

  readonly countryOptions = [
    { value: 'USA', label: 'United States' },
    { value: 'Canada', label: 'Canada' },
    { value: 'Mexico', label: 'Mexico' },
  ];

  ngOnInit(): void {
    const draft = this.draft();
    if (!draft) {
      this.router.navigate(['/']);
      return;
    }

    const checkoutDraft = this.configuratorState.checkoutDraft();
    this.shipping = { ...checkoutDraft.shipping };
    this.customerEmail = checkoutDraft.customerEmail;
    this.paymentMethod = checkoutDraft.paymentMethod as PaymentMethodOption;

    if (!this.price()) {
      this.hardwareService.calculatePrice(draft).subscribe({
        next: (price) => {
          this.price.set(price);
          this.configuratorState.setPriceBreakdown(price);
          this.errorMessage.set('');
        },
        error: () =>
          this.errorMessage.set(
            'Live pricing is unavailable. Return to review and refresh the build.'
          ),
      });
    }
  }

  goBack(): void {
    this.persistCheckoutDraft();
    this.router.navigate(['/review']);
  }

  onPaymentMethodChange(method: PaymentMethodOption): void {
    this.paymentMethod = method;
    this.persistCheckoutDraft();
  }

  activeProfileName(): string {
    return (
      this.profileService.getEffectiveProfile()?.profileName || 'HAI profile'
    );
  }

  paymentHeadline(): string {
    return this.paymentMethod === 'card'
      ? 'Hosted card checkout is ready.'
      : 'Manual payment coordination is selected.';
  }

  paymentCopy(): string {
    return this.paymentMethod === 'card'
      ? 'The order will be created in-app and can proceed to the primary HAI card path.'
      : 'This order will be created with a recorded payment preference so fulfillment staff can follow up with the selected method.';
  }

  isValid(): boolean {
    return Boolean(
      this.shipping.name &&
        this.shipping.street &&
        this.shipping.city &&
        this.shipping.state &&
        this.shipping.zip &&
        this.shipping.country &&
        this.customerEmail &&
        this.draft()
    );
  }

  submitOrder(): void {
    const draft = this.draft();
    if (!draft || !this.isValid() || this.submitting()) {
      return;
    }

    this.persistCheckoutDraft();
    this.submitting.set(true);
    this.errorMessage.set('');

    this.hardwareService
      .createOrder(draft, this.shipping, this.customerEmail, this.paymentMethod)
      .subscribe({
        next: (order) => {
          this.submitting.set(false);
          this.configuratorState.clear();
          this.router.navigate(['/confirmation', order.id]);
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set(
            'The HAI order service rejected this submission. Verify the shipping details and try again.'
          );
        },
      });
  }

  private persistCheckoutDraft(): void {
    this.configuratorState.setCheckoutDraft({
      shipping: { ...this.shipping },
      customerEmail: this.customerEmail,
      paymentMethod: this.paymentMethod,
    });
  }
}
