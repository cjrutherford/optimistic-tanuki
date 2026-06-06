import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FinanceService } from '../services/finance.service';
import { FinancialInvoice, FinanceWorkspace } from '../models';
import { FINANCE_HOST_CONFIG } from '../finance.routes';

@Component({
  selector: 'ot-finance-invoice-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="invoice-board">
      <header class="board-header">
        <div>
          <p class="eyebrow">Native billing</p>
          <h2>Invoices</h2>
        </div>
        <a
          class="primary-action"
          [routerLink]="workspaceSectionLink(workspace(), 'invoices', 'new')"
          >New invoice</a
        >
      </header>

      @if (loading()) {
      <p class="status">Loading invoices...</p>
      } @else if (error()) {
      <p class="status error">{{ error() }}</p>
      } @else {
      <div class="metric-strip">
        <article>
          <span>Open</span>
          <strong>{{ formatCurrency(openTotal()) }}</strong>
        </article>
        <article>
          <span>Collected</span>
          <strong>{{ formatCurrency(collectedTotal()) }}</strong>
        </article>
        <article>
          <span>Drafts</span>
          <strong>{{ draftCount() }}</strong>
        </article>
      </div>

      <div class="invoice-table">
        @for (invoice of invoices(); track invoice.id) {
        <article class="invoice-row">
          <div>
            <p class="eyebrow">{{ invoice.invoiceNumber }}</p>
            <h3>{{ invoice.customerName }}</h3>
            <p>{{ invoice.customerEmail || 'No customer email' }}</p>
          </div>
          <div>
            <span class="status-pill">{{ invoice.status }}</span>
            <strong>{{
              formatCurrency(invoice.total, invoice.currency)
            }}</strong>
            <small
              >Paid
              {{ formatCurrency(invoice.amountPaid, invoice.currency) }}</small
            >
          </div>
        </article>
        } @empty {
        <p class="status">
          Invoices created for this business workspace will appear here.
        </p>
        }
      </div>
      }
    </section>
  `,
  styles: [
    `
      .invoice-board {
        display: grid;
        gap: 18px;
      }
      .board-header,
      .invoice-row,
      .metric-strip {
        display: grid;
        gap: 12px;
      }
      .board-header {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
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
      .primary-action,
      .invoice-row,
      .metric-strip article {
        border: 1px solid var(--border, rgba(148, 163, 184, 0.24));
        background: var(--surface, #ffffff);
      }
      .primary-action {
        border-radius: 999px;
        color: var(--background, #ffffff);
        background: var(--primary, #2563eb);
        padding: 10px 14px;
        text-decoration: none;
        font-weight: 700;
      }
      .metric-strip {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .metric-strip article,
      .invoice-row {
        border-radius: 8px;
        padding: 14px;
      }
      .metric-strip span,
      small,
      .status {
        color: var(--muted, #64748b);
      }
      .invoice-table {
        display: grid;
        gap: 10px;
      }
      .invoice-row {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
      }
      .invoice-row > div:last-child {
        display: grid;
        gap: 4px;
        justify-items: end;
      }
      .status-pill {
        border-radius: 999px;
        padding: 4px 9px;
        background: color-mix(in srgb, var(--primary, #2563eb) 12%, white);
        color: var(--primary, #2563eb);
        font-size: 12px;
        font-weight: 700;
        text-transform: capitalize;
      }
      .error {
        color: #b91c1c;
      }
      @media (max-width: 720px) {
        .board-header,
        .invoice-row,
        .metric-strip {
          grid-template-columns: 1fr;
        }
        .invoice-row > div:last-child {
          justify-items: start;
        }
      }
    `,
  ],
})
export class InvoiceListComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly hostConfig = inject(FINANCE_HOST_CONFIG);

  readonly invoices = signal<FinancialInvoice[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly workspace = signal<FinanceWorkspace>('business');

  async ngOnInit() {
    this.workspace.set(
      (this.route.snapshot.paramMap.get('workspace') as FinanceWorkspace) ??
        'business'
    );
    await this.loadInvoices();
  }

  async loadInvoices() {
    this.loading.set(true);
    try {
      this.invoices.set(
        await this.financeService.getInvoices(this.workspace())
      );
    } catch {
      this.error.set('Unable to load invoices.');
    } finally {
      this.loading.set(false);
    }
  }

  openTotal(): number {
    return this.invoices()
      .filter(
        (invoice) => invoice.status !== 'paid' && invoice.status !== 'void'
      )
      .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  }

  collectedTotal(): number {
    return this.invoices().reduce(
      (sum, invoice) => sum + Number(invoice.amountPaid ?? 0),
      0
    );
  }

  draftCount(): number {
    return this.invoices().filter((invoice) => invoice.status === 'draft')
      .length;
  }

  formatCurrency(value = 0, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(Number(value));
  }

  workspaceSectionLink(
    workspace: FinanceWorkspace,
    ...sections: string[]
  ): string[] {
    return ['/', ...this.routeBaseSegments(), workspace, ...sections];
  }

  private routeBaseSegments(): string[] {
    const configuredSegments = this.hostConfig.routeBase
      .split('/')
      .filter(Boolean);
    const currentSegments = (
      this.route.snapshot.pathFromRoot ?? [this.route.snapshot]
    )
      .flatMap((route) => (route.url ?? []).map((segment) => segment.path))
      .filter(Boolean);

    return configuredSegments.map((segment, index) =>
      segment.startsWith(':')
        ? this.route.snapshot.paramMap.get(segment.slice(1)) ??
          currentSegments[index] ??
          segment.slice(1)
        : segment
    );
  }
}
