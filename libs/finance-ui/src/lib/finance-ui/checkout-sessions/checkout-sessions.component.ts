import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FinanceService } from '../services/finance.service';
import {
  FinancialCheckoutSession,
  FinancialInvoice,
  FinanceWorkspace,
} from '../models';

@Component({
  selector: 'ot-finance-checkout-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="checkout-grid">
      <header class="wide">
        <p class="eyebrow">Checkout and deposits</p>
        <h2>Payment sessions</h2>
      </header>

      <form (ngSubmit)="createSession()" class="panel">
        <h3>Create checkout</h3>
        <label>
          Invoice
          <select name="invoiceId" [(ngModel)]="invoiceId">
            <option value="">Standalone deposit</option>
            @for (invoice of invoices(); track invoice.id) {
            <option [value]="invoice.id">
              {{ invoice.invoiceNumber }} - {{ invoice.customerName }}
            </option>
            }
          </select>
        </label>
        <label>
          Customer
          <input name="customerName" [(ngModel)]="customerName" required />
        </label>
        <label>
          Amount
          <input name="amount" type="number" min="1" [(ngModel)]="amount" />
        </label>
        <label>
          Description
          <textarea name="description" [(ngModel)]="description"></textarea>
        </label>
        <button type="submit" [disabled]="saving()">
          {{ saving() ? 'Creating...' : 'Create session' }}
        </button>
      </form>

      <div class="panel">
        <h3>Recent sessions</h3>
        @for (session of sessions(); track session.id) {
        <article class="session">
          <div>
            <strong>{{ session.customerName }}</strong>
            <p>{{ session.description || 'Checkout session' }}</p>
          </div>
          <div>
            <span>{{ session.status }}</span>
            <strong>{{
              formatCurrency(session.amount, session.currency)
            }}</strong>
          </div>
        </article>
        } @empty {
        <p class="muted">Checkout and deposit sessions will appear here.</p>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .checkout-grid {
        display: grid;
        grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
        gap: 16px;
      }
      .wide {
        grid-column: 1 / -1;
      }
      .panel {
        display: grid;
        gap: 12px;
        border: 1px solid var(--border, rgba(148, 163, 184, 0.24));
        background: var(--surface, #ffffff);
        border-radius: 8px;
        padding: 16px;
      }
      label {
        display: grid;
        gap: 6px;
        color: var(--muted, #64748b);
        font-weight: 700;
      }
      input,
      select,
      textarea {
        border: 1px solid var(--border, rgba(148, 163, 184, 0.32));
        border-radius: 8px;
        padding: 10px 12px;
        background: var(--surface, #ffffff);
      }
      button {
        border: 0;
        border-radius: 999px;
        background: var(--primary, #2563eb);
        color: var(--background, #ffffff);
        padding: 10px 14px;
        font-weight: 800;
      }
      .eyebrow {
        margin: 0 0 6px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted, #64748b);
        font-size: 12px;
      }
      h2,
      h3,
      p {
        margin: 0;
      }
      .session {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--border, rgba(148, 163, 184, 0.24));
      }
      .muted,
      .session p,
      .session span {
        color: var(--muted, #64748b);
      }
      @media (max-width: 820px) {
        .checkout-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CheckoutSessionsComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);

  readonly invoices = signal<FinancialInvoice[]>([]);
  readonly sessions = signal<FinancialCheckoutSession[]>([]);
  readonly saving = signal(false);
  readonly workspace = signal<FinanceWorkspace>('business');
  invoiceId = '';
  customerName = '';
  amount = 250;
  description = '';

  async ngOnInit() {
    this.workspace.set(
      (this.route.snapshot.paramMap.get('workspace') as FinanceWorkspace) ??
        'business'
    );
    await this.load();
  }

  async load() {
    const [invoices, sessions] = await Promise.all([
      this.financeService.getInvoices(this.workspace()),
      this.financeService.getCheckoutSessions(this.workspace()),
    ]);
    this.invoices.set(invoices);
    this.sessions.set(sessions);
  }

  async createSession() {
    this.saving.set(true);
    try {
      await this.financeService.createCheckoutSession({
        invoiceId: this.invoiceId || undefined,
        amount: Number(this.amount),
        currency: 'USD',
        customerName: this.customerName,
        description: this.description || undefined,
        workspace: this.workspace(),
      });
      this.customerName = '';
      this.description = '';
      this.invoiceId = '';
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  formatCurrency(value = 0, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(Number(value));
  }
}
