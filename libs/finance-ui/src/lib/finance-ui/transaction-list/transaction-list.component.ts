import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AgGridUiComponent,
  ColDef,
  GridOptions,
} from '@optimistic-tanuki/ag-grid-ui';
import { FinanceService } from '../services/finance.service';
import {
  Account,
  BankSyncSourceType,
  CreateTransaction,
  FinanceWorkspace,
  Transaction,
} from '../models';
import { isAbortLikeHttpError } from '../services/http-error.utils';
import { FinanceWorkspaceScreenComponent } from '../finance-workspace-screen/finance-workspace-screen.component';

@Component({
  selector: 'ot-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridUiComponent,
    FinanceWorkspaceScreenComponent,
  ],
  template: `
    <ot-finance-workspace-screen
      eyebrow="Transactions"
      title="Ledger review"
      lede="Update rows directly in the ledger. The grid keeps filters, source review, and inline edits in one operating surface shared with the rest of finance."
    >
      <section class="workspace-panel" screen-toolbar>
        <h3 class="workspace-panel-title">Filters</h3>
        <p class="workspace-panel-copy">
          Narrow the ledger before editing individual cells or creating a new
          transaction from the quick form.
        </p>

        <div class="workspace-filter-row">
          <select
            [ngModel]="selectedSourceType()"
            (ngModelChange)="selectedSourceType.set($event)"
            name="selectedSourceType"
          >
            <option value="">All sources</option>
            <option value="manual">Manual</option>
            <option value="import">Import</option>
            <option value="bank-sync">Bank sync</option>
          </select>
          <select
            [ngModel]="selectedAccountId()"
            (ngModelChange)="selectedAccountId.set($event)"
            name="selectedAccountId"
          >
            <option value="">All accounts</option>
            @for (account of accounts(); track account.id) {
            <option [value]="account.id">{{ account.name }}</option>
            }
          </select>
          <select
            [ngModel]="reviewFilter()"
            (ngModelChange)="reviewFilter.set($event)"
            name="reviewFilter"
          >
            <option value="all">All review states</option>
            <option value="needs-review">Needs review</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </section>

      <section class="workspace-panel">
        <h3 class="workspace-panel-title">Quick create</h3>
        <p class="workspace-panel-copy">
          Add a transaction from the same workspace. Existing rows below can be
          edited inline without opening a separate form.
        </p>

        <form class="workspace-form" (ngSubmit)="saveTransaction()">
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
          <input
            [(ngModel)]="draft.category"
            name="category"
            placeholder="Category"
            list="transaction-category-options"
          />
          <datalist id="transaction-category-options">
            @for (category of categoryOptions(); track category) {
            <option [value]="category"></option>
            }
          </datalist>
          <input
            [(ngModel)]="draft.payeeOrVendor"
            name="payeeOrVendor"
            placeholder="Payee or vendor"
          />
          <input
            [(ngModel)]="draft.transactionDate"
            name="transactionDate"
            type="date"
            required
          />
          <button type="submit" class="workspace-button-primary">
            {{ editingId() ? 'Update transaction' : 'Create transaction' }}
          </button>
        </form>
      </section>

      <section class="workspace-grid-panel">
        <otui-ag-grid
          [rowData]="filteredTransactions()"
          [columnDefs]="columnDefs"
          [gridOptions]="gridOptions"
          [loading]="loading()"
          height="500px"
        ></otui-ag-grid>
      </section>
    </ot-finance-workspace-screen>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      :host ::ng-deep .grid-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      :host ::ng-deep .source-chip,
      :host ::ng-deep .review-chip {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.3rem 0.6rem;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.04em;
      }

      :host ::ng-deep .source-chip {
        background: rgba(37, 99, 235, 0.12);
        color: var(--primary, #2563eb);
      }

      :host ::ng-deep .review-chip[data-review='needs-review'] {
        background: rgba(180, 83, 9, 0.12);
        color: #b45309;
      }

      :host ::ng-deep .review-chip[data-review='reviewed'] {
        background: rgba(22, 101, 52, 0.12);
        color: #166534;
      }
    `,
  ],
})
export class TransactionListComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);

  readonly transactions = signal<Transaction[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly categoryOptions = signal<string[]>([]);
  readonly loading = signal(false);
  readonly workspace = signal<FinanceWorkspace>('personal');
  readonly editingId = signal<string | null>(null);
  readonly selectedSourceType = signal('');
  readonly selectedAccountId = signal('');
  readonly reviewFilter = signal<'all' | 'needs-review' | 'reviewed'>('all');

  draft: {
    accountId: string;
    amount: number;
    type: string;
    category: string;
    payeeOrVendor: string;
    transferType: string;
    transactionDate: string;
    workspace: FinanceWorkspace;
    isRecurring: boolean;
  } = this.emptyDraft();

  filteredTransactions(): Transaction[] {
    return this.transactions().filter((transaction) => {
      if (
        this.selectedSourceType() &&
        (transaction.sourceType || 'manual') !== this.selectedSourceType()
      ) {
        return false;
      }

      if (
        this.selectedAccountId() &&
        transaction.accountId !== this.selectedAccountId()
      ) {
        return false;
      }

      if (
        this.reviewFilter() !== 'all' &&
        (transaction.reviewStatus || 'needs-review') !== this.reviewFilter()
      ) {
        return false;
      }

      return true;
    });
  }

  readonly columnDefs: ColDef<Transaction>[] = [
    {
      field: 'transactionDate',
      headerName: 'Date',
      editable: true,
      valueFormatter: (params) => this.formatDate(params.value),
      valueGetter: (params) =>
        this.toDateInputValue(params.data?.transactionDate),
      valueSetter: (params) =>
        this.updateCellValue(
          params.data,
          'transactionDate',
          new Date(params.newValue)
        ),
    },
    {
      field: 'type',
      headerName: 'Type',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['debit', 'credit'],
      },
    },
    {
      field: 'sourceType',
      headerName: 'Source',
      editable: false,
      cellRenderer: (params: { value?: BankSyncSourceType }) => {
        const chip = document.createElement('span');
        chip.className = 'source-chip';
        chip.textContent = this.sourceLabel(params.value);
        return chip;
      },
    },
    {
      field: 'category',
      headerName: 'Category',
      editable: true,
    },
    {
      field: 'amount',
      headerName: 'Amount',
      editable: true,
      valueParser: (params) => Number(params.newValue),
      valueFormatter: (params) => this.formatCurrency(params.value),
    },
    {
      field: 'reviewStatus',
      headerName: 'Review',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['needs-review', 'reviewed'],
      },
      cellRenderer: (params: { value?: string }) => {
        const chip = document.createElement('span');
        chip.className = 'review-chip';
        chip.dataset['review'] = params.value || 'needs-review';
        chip.textContent = params.value || 'needs-review';
        return chip;
      },
    },
    {
      field: 'payeeOrVendor',
      headerName: 'Payee',
      editable: true,
      valueFormatter: (params) => params.value || 'Unknown',
    },
    {
      field: 'description',
      headerName: 'Description',
      editable: true,
      valueFormatter: (params) => params.value || '',
    },
    {
      headerName: 'Actions',
      editable: false,
      sortable: false,
      filter: false,
      maxWidth: 220,
      cellRenderer: (params: { data?: Transaction }) => {
        const data = params.data;
        if (!data) {
          return '';
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'grid-actions';
        wrapper.append(
          this.buildActionButton('Edit form', () => this.editTransaction(data)),
          this.buildActionButton(
            'Delete',
            () => void this.deleteTransaction(data.id),
            'workspace-button-danger'
          )
        );
        return wrapper;
      },
    },
  ];

  readonly gridOptions: GridOptions<Transaction> = {
    domLayout: 'normal',
    pagination: true,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 120,
    },
    onCellValueChanged: (event) => {
      if (!event.data) {
        return;
      }

      void this.persistInlineUpdate(event.data);
    },
  };

  async ngOnInit() {
    const workspace = (this.route.snapshot.paramMap.get('workspace') ??
      'personal') as FinanceWorkspace;
    this.workspace.set(workspace);
    this.draft = this.emptyDraft();
    await this.loadData();
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
      accountId: transaction.accountId,
      amount: Number(transaction.amount),
      type: transaction.type,
      category: transaction.category,
      payeeOrVendor: transaction.payeeOrVendor ?? '',
      transferType: transaction.transferType ?? '',
      transactionDate: this.toDateInputValue(transaction.transactionDate),
      workspace: this.workspace(),
      isRecurring: transaction.isRecurring,
    };
  }

  async saveTransaction() {
    const payload: CreateTransaction = {
      ...this.draft,
      category: this.draft.category?.trim(),
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
    await this.loadData();
  }

  async deleteTransaction(id: string) {
    await this.financeService.deleteTransaction(id);
    await this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [transactions, accounts, categoryOptions] = await Promise.all([
        this.financeService.getTransactions(this.workspace()),
        this.financeService.getAccounts(this.workspace()),
        this.financeService.getCategorySuggestions(this.workspace()),
      ]);
      this.transactions.set(transactions);
      this.accounts.set(accounts);
      this.categoryOptions.set(categoryOptions);
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

  private async persistInlineUpdate(transaction: Transaction): Promise<void> {
    const payload: CreateTransaction = {
      amount: Number(transaction.amount),
      type: transaction.type,
      accountId: transaction.accountId,
      description: transaction.description,
      category: transaction.category?.trim(),
      transactionDate: new Date(transaction.transactionDate),
      reference: transaction.reference,
      isRecurring: transaction.isRecurring,
      workspace: this.workspace(),
      payeeOrVendor: transaction.payeeOrVendor,
      transferType: transaction.transferType,
      sourceType: transaction.sourceType,
      sourceProvider: transaction.sourceProvider,
      externalTransactionId: transaction.externalTransactionId,
      pending: transaction.pending,
      reviewStatus: transaction.reviewStatus,
    };

    try {
      await this.financeService.updateTransaction(transaction.id, payload);
      await this.loadData();
    } catch (error) {
      if (isAbortLikeHttpError(error)) {
        return;
      }

      console.error('Error updating transaction inline:', error);
      await this.loadData();
    }
  }

  private updateCellValue<T extends keyof Transaction>(
    transaction: Transaction | undefined,
    key: T,
    value: Transaction[T]
  ): boolean {
    if (!transaction) {
      return false;
    }

    (transaction as Transaction)[key] = value;
    return true;
  }

  private formatCurrency(value: unknown): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(value ?? 0));
  }

  private formatDate(value: unknown): string {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
    }).format(new Date(value as string | Date));
  }

  private toDateInputValue(value: Date | string | undefined): string {
    if (!value) {
      return '';
    }

    return new Date(value).toISOString().slice(0, 10);
  }

  private buildActionButton(
    label: string,
    onClick: () => void,
    className = ''
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.className = className;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });

    return button;
  }
}
