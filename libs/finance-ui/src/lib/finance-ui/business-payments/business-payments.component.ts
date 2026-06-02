import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FinanceService } from '../services/finance.service';
import { FinanceWorkspace, Transaction } from '../models';

@Component({
  selector: 'ot-finance-business-payments',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="payments">
      <header>
        <p class="eyebrow">Localized transaction tracking</p>
        <h2>Business payments ledger</h2>
      </header>

      <div class="ledger">
        @for (transaction of transactions(); track transaction.id) {
        <article class="entry">
          <div>
            <strong>{{
              transaction.payeeOrVendor || transaction.description
            }}</strong>
            <p>
              {{ transaction.category }} ·
              {{ transaction.transactionDate | date : 'mediumDate' }}
            </p>
          </div>
          <strong [class.credit]="transaction.type === 'credit'">
            {{ formatCurrency(transaction.amount) }}
          </strong>
        </article>
        } @empty {
        <p class="muted">
          Invoice payments and localized business transactions will appear here.
        </p>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .payments,
      .ledger {
        display: grid;
        gap: 14px;
      }
      .entry {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        border: 1px solid var(--border, rgba(148, 163, 184, 0.24));
        background: var(--surface, #ffffff);
        border-radius: 8px;
        padding: 14px;
      }
      .eyebrow {
        margin: 0 0 6px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted, #64748b);
        font-size: 12px;
      }
      h2,
      p {
        margin: 0;
      }
      .muted,
      .entry p {
        color: var(--muted, #64748b);
      }
      .credit {
        color: #047857;
      }
    `,
  ],
})
export class BusinessPaymentsComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);

  readonly transactions = signal<Transaction[]>([]);

  async ngOnInit() {
    const workspace =
      (this.route.snapshot.paramMap.get('workspace') as FinanceWorkspace) ??
      'business';
    this.transactions.set(await this.financeService.getTransactions(workspace));
  }

  formatCurrency(value = 0): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(value));
  }
}
