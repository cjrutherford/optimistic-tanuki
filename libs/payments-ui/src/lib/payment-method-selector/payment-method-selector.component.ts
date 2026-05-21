import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CardComponent } from '@optimistic-tanuki/common-ui';

export type PaymentMethodOption =
  | 'card'
  | 'cash-app'
  | 'venmo'
  | 'zelle'
  | 'cash';

@Component({
  selector: 'otui-payment-method-selector',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <section class="payment-selector">
      <header>
        <p class="eyebrow">Payment orchestration</p>
        <h3>{{ title }}</h3>
        <p>{{ description }}</p>
      </header>

      <div class="method-grid">
        <button
          *ngFor="let method of methods"
          type="button"
          class="method-card"
          [class.active]="selectedMethod() === method.value"
          (click)="selectMethod(method.value)"
        >
          <span class="method-icon">{{ method.icon }}</span>
          <strong>{{ method.label }}</strong>
          <small>{{ method.description }}</small>
        </button>
      </div>

      <otui-card *ngIf="selectedMethod() as selected" class="detail-card">
        <p class="eyebrow">Selected method</p>
        <h4>{{ labelFor(selected) }}</h4>
        <p>{{ detailsFor(selected) }}</p>
      </otui-card>
    </section>
  `,
  styles: [
    `
      .payment-selector {
        display: grid;
        gap: 1rem;
      }

      .eyebrow {
        margin: 0 0 0.4rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.72rem;
        opacity: 0.72;
      }

      .method-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.9rem;
      }

      .method-card {
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: inherit;
        border-radius: 1.25rem;
        padding: 1rem;
        display: grid;
        gap: 0.35rem;
        text-align: left;
        cursor: pointer;
      }

      .method-card.active {
        border-color: #2dd4bf;
        box-shadow: inset 0 0 0 1px #2dd4bf;
        background: rgba(45, 212, 191, 0.08);
      }

      .method-icon {
        font-size: 1.5rem;
      }
    `,
  ],
})
export class PaymentMethodSelectorComponent implements OnChanges {
  @Input() title = 'Choose a payment method';
  @Input() description =
    'Card checkout is primary, with off-platform methods available for assisted fulfillment.';
  @Input() selected: PaymentMethodOption = 'card';
  @Output() methodChange = new EventEmitter<PaymentMethodOption>();

  readonly methods = [
    {
      value: 'card' as const,
      label: 'Card',
      icon: '◧',
      description: 'Hosted checkout session',
      details: 'Use the primary HAI checkout path with redirect-based payment confirmation.',
    },
    {
      value: 'cash-app' as const,
      label: 'Cash App',
      icon: '¤',
      description: 'Out-of-platform transfer',
      details: 'Collect payment intent and confirmation against the order record.',
    },
    {
      value: 'venmo' as const,
      label: 'Venmo',
      icon: '◌',
      description: 'Out-of-platform transfer',
      details: 'Capture the manual payment method and continue through order verification.',
    },
    {
      value: 'zelle' as const,
      label: 'Zelle',
      icon: '▣',
      description: 'Bank transfer',
      details: 'Record Zelle as the chosen method and keep shipping/order submission in-app.',
    },
    {
      value: 'cash' as const,
      label: 'Cash',
      icon: '△',
      description: 'In-person settlement',
      details: 'Reserve for assisted or local deployments where HAI staff handles final exchange.',
    },
  ];

  readonly selectedMethod = signal<PaymentMethodOption>('card');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selected']?.currentValue) {
      this.selectedMethod.set(changes['selected'].currentValue as PaymentMethodOption);
    }
  }

  selectMethod(method: PaymentMethodOption): void {
    this.selectedMethod.set(method);
    this.methodChange.emit(method);
  }

  labelFor(method: PaymentMethodOption): string {
    return this.methods.find((item) => item.value === method)?.label || method;
  }

  detailsFor(method: PaymentMethodOption): string {
    return (
      this.methods.find((item) => item.value === method)?.details || ''
    );
  }
}
