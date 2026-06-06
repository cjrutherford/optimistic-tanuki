import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FinanceService } from '../services/finance.service';
import {
  Account,
  BankConnection,
  CreateAccount,
  FinanceWorkspace,
} from '../models';
import { isAbortLikeHttpError } from '../services/http-error.utils';
import {
  AgGridUiComponent,
  ColDef,
  GridOptions,
} from '@optimistic-tanuki/ag-grid-ui';
import { FinanceWorkspaceScreenComponent } from '../finance-workspace-screen/finance-workspace-screen.component';

@Component({
  selector: 'ot-account-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridUiComponent,
    FinanceWorkspaceScreenComponent,
  ],
  template: `
    <ot-finance-workspace-screen
      eyebrow="Accounts"
      title="Linked institutions and manual ledgers"
      lede="Manage your ledger without leaving the workspace. Connected institutions stay visible above the same grid pattern used across budgets and transactions."
      [status]="status()"
    >
      <button
        screen-actions
        type="button"
        class="workspace-button-primary"
        (click)="connectBankAccount()"
      >
        Connect bank account
      </button>

      <section class="workspace-panel linked-section" screen-toolbar>
        <div class="section-heading">
          <div>
            <h3 class="workspace-panel-title">Linked accounts</h3>
            <p class="workspace-panel-copy">
              Bank feeds stay connected here. Use sync, reconnect, or disconnect
              without leaving finance.
            </p>
          </div>
        </div>

        @if (loading()) {
        <p class="workspace-panel-copy">Loading accounts...</p>
        } @else if (connections().length === 0) {
        <p class="workspace-panel-copy">
          No linked bank accounts yet. Connect Plaid to start importing live
          transactions.
        </p>
        } @else {
        <div class="connection-grid">
          @for (connection of connections(); track connection.id) {
          <article class="connection-card">
            <div class="card-topline">
              <div>
                <p class="institution">
                  {{ connection.institutionName || 'Connected institution' }}
                </p>
                <p class="provider">{{ connection.provider | titlecase }}</p>
              </div>
              <span class="status-pill" [attr.data-status]="connection.status">
                {{ connection.status }}
              </span>
            </div>

            <ul class="linked-account-list">
              @for (linked of connection.linkedAccounts; track linked.id) {
              <li>
                <strong>{{ linked.name }}</strong>
                <span>{{
                  linked.mask
                    ? '•••• ' + linked.mask
                    : linked.subtype || 'Linked account'
                }}</span>
              </li>
              }
            </ul>

            <p class="sync-copy">
              Last sync:
              {{
                connection.lastSuccessfulSyncAt
                  ? (connection.lastSuccessfulSyncAt | date : 'medium')
                  : 'Not yet synced'
              }}
            </p>
            @if (connection.lastError) {
            <p class="error-copy">{{ connection.lastError }}</p>
            }

            <div class="card-actions">
              <button
                type="button"
                class="workspace-button-primary"
                (click)="syncConnection(connection.id)"
              >
                Sync now
              </button>
              <button type="button" (click)="connectBankAccount()">
                Reconnect
              </button>
              <button
                type="button"
                class="workspace-button-danger"
                (click)="disconnectConnection(connection.id)"
              >
                Disconnect
              </button>
            </div>
          </article>
          }
        </div>
        }
      </section>

      <section class="workspace-panel manual-section">
        <div class="section-heading">
          <div>
            <h3 class="workspace-panel-title">Manual accounts</h3>
            <p class="workspace-panel-copy">
              Use the quick-create form for new ledgers, then review and update
              balances in the shared operating grid below.
            </p>
          </div>
        </div>

        <form class="workspace-form" (ngSubmit)="saveAccount()">
          <input
            [(ngModel)]="draft.name"
            name="name"
            placeholder="Account name"
            required
          />
          <select [(ngModel)]="draft.type" name="type">
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
            <option value="investment">Investment</option>
          </select>
          <input
            [(ngModel)]="draft.balance"
            name="balance"
            type="number"
            placeholder="Balance"
            required
          />
          <input
            [(ngModel)]="draft.currency"
            name="currency"
            placeholder="Currency"
            required
          />
          <button type="submit" class="workspace-button-primary">
            {{ editingId() ? 'Update account' : 'Create account' }}
          </button>
        </form>

        <div class="workspace-grid-panel">
          <otui-ag-grid
            [rowData]="manualAccounts()"
            [columnDefs]="columnDefs"
            [gridOptions]="gridOptions"
            [loading]="loading()"
            height="420px"
          ></otui-ag-grid>
        </div>
      </section>
    </ot-finance-workspace-screen>
  `,
  styles: [
    `
      .account-list {
        display: grid;
        gap: 1rem;
      }

      .section-heading,
      .card-topline,
      .card-actions {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .section-heading {
        align-items: start;
      }
      .linked-section,
      .manual-section {
        display: grid;
        gap: 1rem;
      }
      .connection-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 1rem;
      }
      .connection-card {
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 97%,
          transparent
        );
        border-radius: var(--border-radius-lg, 18px);
        border: 1px solid
          color-mix(in srgb, var(--border, #94a3b8) 24%, transparent);
        padding: 1rem;
        display: grid;
        gap: 0.75rem;
      }
      .institution {
        margin: 0;
        font-weight: 700;
      }
      .provider,
      .sync-copy,
      .empty-copy,
      .status-copy,
      .section-heading p,
      .linked-account-list span {
        margin: 0;
        color: var(--muted, #6b7280);
      }
      .linked-account-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      .linked-account-list li {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }
      .status-pill {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 11px;
        padding: 6px 10px;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 70%,
          var(--primary, #2563eb)
        );
      }
      .status-pill[data-status='healthy'] {
        color: #166534;
        background: rgba(22, 101, 52, 0.12);
      }
      .status-pill[data-status='needs-reauth'],
      .status-pill[data-status='sync-error'] {
        color: #b45309;
        background: rgba(180, 83, 9, 0.12);
      }
      .status-pill[data-status='disconnected'] {
        color: #991b1b;
        background: rgba(153, 27, 27, 0.12);
      }

      .error-copy {
        margin: 0;
        color: #991b1b;
      }

      :host ::ng-deep .grid-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class AccountListComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);

  accounts = signal<Account[]>([]);
  connections = signal<BankConnection[]>([]);
  loading = signal(false);
  status = signal('');
  workspace = signal<FinanceWorkspace>('personal');
  editingId = signal<string | null>(null);
  draft: Partial<CreateAccount> = this.emptyDraft();

  readonly columnDefs: ColDef<Account>[] = [
    {
      field: 'name',
      headerName: 'Name',
    },
    {
      field: 'type',
      headerName: 'Type',
    },
    {
      field: 'balance',
      headerName: 'Balance',
      valueFormatter: (params) => this.formatCurrency(params.value),
    },
    {
      field: 'currency',
      headerName: 'Currency',
      maxWidth: 120,
    },
    {
      field: 'institutionName',
      headerName: 'Institution',
      valueFormatter: (params) => params.value || 'Manual',
    },
    {
      field: 'lastReviewedAt',
      headerName: 'Last reviewed',
      valueFormatter: (params) => this.formatReviewDate(params.value),
    },
    {
      headerName: 'Actions',
      sortable: false,
      filter: false,
      editable: false,
      maxWidth: 260,
      cellRenderer: (params: { data?: Account }) => {
        const data = params.data;
        if (!data) {
          return '';
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'grid-actions';

        wrapper.append(
          this.buildActionButton('Edit', () => this.editAccount(data)),
          this.buildActionButton(
            'Reviewed',
            () => void this.markReviewed(data)
          ),
          this.buildActionButton(
            'Delete',
            () => void this.deleteAccount(data.id),
            'workspace-button-danger'
          )
        );

        return wrapper;
      },
    },
  ];

  readonly gridOptions: GridOptions<Account> = {
    domLayout: 'normal',
    pagination: true,
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 120,
    },
  };

  async ngOnInit() {
    this.draft = this.emptyDraft();
    await this.loadAccounts();
  }

  async loadAccounts() {
    const workspace = (this.route.snapshot.paramMap.get('workspace') ??
      'personal') as FinanceWorkspace;
    this.workspace.set(workspace);
    if (!this.editingId()) {
      this.draft = this.emptyDraft();
    }
    this.loading.set(true);
    try {
      const [accounts, connections] = await Promise.all([
        this.financeService.getAccounts(workspace),
        this.financeService.getBankConnections(),
      ]);
      this.accounts.set(accounts);
      this.connections.set(connections);
    } catch (error) {
      if (isAbortLikeHttpError(error)) {
        return;
      }
      console.error('Error loading accounts:', error);
    } finally {
      this.loading.set(false);
    }
  }

  emptyDraft(): Partial<CreateAccount> {
    return {
      name: '',
      type: 'bank',
      balance: 0,
      currency: 'USD',
      workspace: this.workspace(),
      lastReviewedAt: new Date(),
    };
  }

  editAccount(account: Account) {
    this.editingId.set(account.id);
    this.draft = { ...account };
  }

  manualAccounts(): Account[] {
    return this.accounts().filter((account) => !account.providerConnectionId);
  }

  private formatCurrency(value: unknown): string {
    const amount = Number(value ?? 0);

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  private formatReviewDate(value: unknown): string {
    if (!value) {
      return 'Needs review';
    }

    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
    }).format(new Date(value as string | Date));
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

  async saveAccount() {
    const payload = {
      ...this.draft,
      workspace: this.workspace(),
    } as CreateAccount;
    if (this.editingId()) {
      await this.financeService.updateAccount(this.editingId()!, payload);
    } else {
      await this.financeService.createAccount(payload);
    }
    this.editingId.set(null);
    this.draft = this.emptyDraft();
    await this.loadAccounts();
  }

  async syncConnection(id: string) {
    try {
      const result = await this.financeService.syncBankConnection(id);
      this.status.set(
        `Synced linked account feed. Added ${result.added}, modified ${result.modified}, removed ${result.removed}.`
      );
      await this.loadAccounts();
    } catch (error) {
      this.status.set(this.errorMessage(error, 'Sync failed.'));
    }
  }

  async disconnectConnection(id: string) {
    try {
      await this.financeService.disconnectBankConnection(id);
      this.status.set('Disconnected linked bank account.');
      await this.loadAccounts();
    } catch (error) {
      this.status.set(this.errorMessage(error, 'Disconnect failed.'));
    }
  }

  async connectBankAccount() {
    try {
      this.status.set('Requesting secure bank link…');
      const linkToken = await this.financeService.createBankLinkToken({
        provider: 'plaid',
      });
      const handler = await this.getPlaidHandler(linkToken.linkToken);
      this.status.set('Opening Plaid Link…');
      handler.open();
    } catch (error) {
      this.status.set(
        this.errorMessage(
          error,
          'Unable to start bank linking. Check finance migrations and Plaid server configuration.'
        )
      );
    }
  }

  private async getPlaidHandler(
    linkToken: string
  ): Promise<{ open: () => void }> {
    await this.ensurePlaidScript();
    return window.Plaid.create({
      token: linkToken,
      onSuccess: async (
        publicToken: string,
        metadata: { institution?: { institution_id?: string; name?: string } }
      ) => {
        try {
          this.status.set('Linking bank account and requesting first sync…');
          await this.financeService.connectBankProvider({
            provider: 'plaid',
            publicToken,
            institutionId: metadata.institution?.institution_id,
            institutionName: metadata.institution?.name,
            workspace: this.workspace(),
          });
          this.status.set(
            'Connected Plaid institution. Initial sync requested.'
          );
          await this.loadAccounts();
        } catch (error) {
          this.status.set(
            this.errorMessage(
              error,
              'Bank link opened, but the connection could not be completed.'
            )
          );
        }
      },
      onExit: () => {
        if (this.status() === 'Opening Plaid Link…') {
          this.status.set('Bank linking cancelled.');
        }
      },
    });
  }

  private async ensurePlaidScript(): Promise<void> {
    if (typeof document === 'undefined') {
      return;
    }
    if (window.Plaid) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-plaid-link]'
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Plaid failed to load')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
      script.async = true;
      script.dataset['plaidLink'] = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Plaid failed to load'));
      document.head.appendChild(script);
    });
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }

    return fallback;
  }

  async markReviewed(account: Account) {
    await this.financeService.updateAccount(account.id, {
      lastReviewedAt: new Date(),
    });
    await this.loadAccounts();
  }

  async deleteAccount(id: string) {
    if (confirm('Are you sure you want to delete this account?')) {
      try {
        await this.financeService.deleteAccount(id);
        await this.loadAccounts();
      } catch (error) {
        if (isAbortLikeHttpError(error)) {
          return;
        }
        console.error('Error deleting account:', error);
      }
    }
  }
}

declare global {
  interface Window {
    Plaid: {
      create: (config: {
        token: string;
        onSuccess: (
          publicToken: string,
          metadata: { institution?: { institution_id?: string; name?: string } }
        ) => void | Promise<void>;
        onExit: () => void;
      }) => { open: () => void };
    };
  }
}
