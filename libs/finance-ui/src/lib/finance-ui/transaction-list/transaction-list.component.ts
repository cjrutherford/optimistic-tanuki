import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FinanceService } from '../services/finance.service';
import {
  Account,
  BankSyncSourceType,
  CreateTransaction,
  FinanceWorkspace,
  Transaction,
} from '../models';
import { isAbortLikeHttpError } from '../services/http-error.utils';

@Component({
  selector: 'ot-transaction-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="transaction-list">
      <h2>Transactions</h2>

      <div class="filters">
        <select [(ngModel)]="selectedSourceType" name="selectedSourceType">
          <option value="">All sources</option>
          <option value="manual">Manual</option>
          <option value="import">Import</option>
          <option value="bank-sync">Bank sync</option>
        </select>
        <select [(ngModel)]="selectedAccountId" name="selectedAccountId">
          <option value="">All accounts</option>
          @for (account of accounts(); track account.id) {
            <option [value]="account.id">{{ account.name }}</option>
          }
        </select>
        <label class="review-filter">
          <input
            type="checkbox"
            [(ngModel)]="needsReviewOnly"
            name="needsReviewOnly"
          />
          Needs review only
        </label>
      </div>

      <form class="editor" (ngSubmit)="saveTransaction()">
        <select [(ngModel)]="draft.accountId" name="accountId" required>
          @for (account of accounts(); track account.id) {
            <option [value]="account.id">{{ account.name }}</option>
          }
        </select>
        <input
          [(ngModel)]="draft.amount"
          name="amount"
          type="number"
          placeholder="Amount"
          required
        />
        <select [(ngModel)]="draft.type" name="type">
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
        <input [(ngModel)]="draft.category" name="category" placeholder="Category" />
        <input
          [(ngModel)]="draft.payeeOrVendor"
          name="payeeOrVendor"
          placeholder="Payee or vendor"
        />
        <select [(ngModel)]="draft.transferType" name="transferType">
          <option value="">No transfer type</option>
          <option value="owner-draw">Owner draw</option>
          <option value="owner-contribution">Owner contribution</option>
          <option value="internal-transfer">Internal transfer</option>
        </select>
        <input
          [(ngModel)]="draft.transactionDate"
          name="transactionDate"
          type="date"
          required
        />
        <button type="submit">
          {{ editingId() ? 'Update transaction' : 'Create transaction' }}
        </button>
      </form>
      @if (loading()) {
        <p>Loading transactions...</p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Source</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Review</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (transaction of filteredTransactions(); track transaction.id) {
              <tr>
                <td>{{ transaction.transactionDate | date }}</td>
                <td>{{ transaction.type }}</td>
                <td>
                  <span
                    class="source-pill"
                    [attr.data-source]="transaction.sourceType || 'manual'"
                  >
                    {{ sourceLabel(transaction.sourceType) }}
                  </span>
                </td>
                <td>{{ transaction.category }}</td>
                <td>{{ transaction.amount }}</td>
                <td>{{ transaction.reviewStatus || 'needs-review' }}</td>
                <td>{{ transaction.description }}</td>
                <td>
                  <button (click)="editTransaction(transaction)">Edit</button>
                  <button (click)="deleteTransaction(transaction.id)">Delete</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .transaction-list {
      padding: 20px;
      color: var(--foreground, #1f2937);
      font-family: var(--font-body, 'Helvetica Neue', Arial, sans-serif);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface, #ffffff);
      border-radius: var(--border-radius-lg, 16px);
      overflow: hidden;
    }
    .filters {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .review-filter {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted, #6b7280);
    }
    .editor {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
      padding: 16px;
      background: var(--surface, #ffffff);
      border-radius: var(--border-radius-lg, 18px);
      border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
    }
    .editor input,
    .editor select,
    .editor button,
    .filters select {
      padding: 10px 12px;
      border-radius: var(--border-radius-md, 12px);
      border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
    }
    .editor button {
      background: var(--primary, #2563eb);
      color: var(--background, #ffffff);
      font-weight: 700;
    }
    .source-pill {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.12);
      color: var(--primary, #2563eb);
    }
    .source-pill[data-source='bank-sync'] {
      background: rgba(22, 101, 52, 0.12);
      color: #166534;
    }
    .source-pill[data-source='import'] {
      background: rgba(180, 83, 9, 0.12);
      color: #b45309;
    }
    th, td {
      border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: var(--background, #f8fafc);
    }
  `],
})
export class TransactionListComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);

  transactions = signal<Transaction[]>([]);
  accounts = signal<Account[]>([]);
  loading = signal(false);
  workspace = signal<FinanceWorkspace>('personal');
  editingId = signal<string | null>(null);
  draft: any = this.emptyDraft();
  selectedSourceType = '';
  selectedAccountId = '';
  needsReviewOnly = false;

  async ngOnInit() {
    const workspace = (this.route.snapshot.paramMap.get('workspace') ??
      'personal') as FinanceWorkspace;
    this.workspace.set(workspace);
    this.draft = this.emptyDraft();
    this.loading.set(true);
    try {
      const [transactions, accounts] = await Promise.all([
        this.financeService.getTransactions(workspace),
        this.financeService.getAccounts(workspace),
      ]);
      this.transactions.set(transactions);
      this.accounts.set(accounts);
      this.draft.accountId = accounts[0]?.id ?? '';
    } catch (error) {
      if (isAbortLikeHttpError(error)) {
        return;
      }
      console.error('Error loading transactions:', error);
    } finally {
      this.loading.set(false);
    }
  }

  emptyDraft() {
    return {
      accountId: '',
      amount: 0,
      type: 'debit',
      category: '',
      payeeOrVendor: '',
      transferType: '',
      transactionDate: new Date().toISOString().slice(0, 10),
      workspace: this.workspace(),
      isRecurring: false,
    };
  }

  filteredTransactions(): Transaction[] {
    return this.transactions().filter((transaction) => {
      if (
        this.selectedSourceType &&
        (transaction.sourceType || 'manual') !== this.selectedSourceType
      ) {
        return false;
      }

      if (this.selectedAccountId && transaction.accountId !== this.selectedAccountId) {
        return false;
      }

      if (this.needsReviewOnly && transaction.reviewStatus !== 'needs-review') {
        return false;
      }

      return true;
    });
  }

  sourceLabel(sourceType?: BankSyncSourceType): string {
    switch (sourceType) {
      case 'bank-sync':
        return 'Bank sync';
      case 'import':
        return 'Import';
      default:
        return 'Manual';
    }
  }

  editTransaction(transaction: Transaction) {
    this.editingId.set(transaction.id);
    this.draft = {
      ...transaction,
      transactionDate: new Date(transaction.transactionDate)
        .toISOString()
        .slice(0, 10),
      transferType: transaction.transferType ?? '',
    };
  }

  async saveTransaction() {
    const payload: CreateTransaction = {
      ...this.draft,
      transactionDate: new Date(this.draft.transactionDate),
      workspace: this.workspace(),
      transferType: this.draft.transferType || undefined,
    };
    if (this.editingId()) {
      await this.financeService.updateTransaction(this.editingId()!, payload);
    } else {
      await this.financeService.createTransaction(payload);
    }
    this.editingId.set(null);
    this.draft = this.emptyDraft();
    await this.ngOnInit();
  }

  async deleteTransaction(id: string) {
    await this.financeService.deleteTransaction(id);
    await this.ngOnInit();
  }
}
