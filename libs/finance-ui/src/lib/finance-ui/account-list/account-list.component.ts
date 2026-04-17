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
import { RouterModule } from '@angular/router';
import { isAbortLikeHttpError } from '../services/http-error.utils';

@Component({
  selector: 'ot-account-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="account-list">
      <header class="page-header">
        <div>
          <p class="eyebrow">Accounts</p>
          <h2>Linked institutions and manual ledgers</h2>
        </div>
        <button type="button" class="connect-bank" (click)="connectBankAccount()">
          Connect bank account
        </button>
      </header>

      <section class="linked-section">
        <div class="section-heading">
          <h3>Linked accounts</h3>
          <p>Bank feeds stay connected here. Use sync, reconnect, or disconnect without leaving finance.</p>
        </div>

        @if (loading()) {
          <p>Loading accounts...</p>
        } @else if (connections().length === 0) {
          <p class="empty-copy">No linked bank accounts yet. Connect Plaid to start importing live transactions.</p>
        } @else {
          <div class="connection-grid">
            @for (connection of connections(); track connection.id) {
              <article class="connection-card">
                <div class="card-topline">
                  <div>
                    <p class="institution">{{ connection.institutionName || 'Connected institution' }}</p>
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
                      <span>{{ linked.mask ? '•••• ' + linked.mask : linked.subtype || 'Linked account' }}</span>
                    </li>
                  }
                </ul>

                <p class="sync-copy">
                  Last sync:
                  {{ connection.lastSuccessfulSyncAt ? (connection.lastSuccessfulSyncAt | date:'medium') : 'Not yet synced' }}
                </p>
                @if (connection.lastError) {
                  <p class="error-copy">{{ connection.lastError }}</p>
                }

                <div class="card-actions">
                  <button type="button" (click)="syncConnection(connection.id)">Sync now</button>
                  <button type="button" class="secondary" (click)="connectBankAccount()">Reconnect</button>
                  <button type="button" class="danger" (click)="disconnectConnection(connection.id)">Disconnect</button>
                </div>
              </article>
            }
          </div>
        }
      </section>

      <section class="manual-section">
        <div class="section-heading">
          <h3>Manual accounts</h3>
          <p>Cash, credit, or non-linked balances still live in the ledger as editable manual accounts.</p>
        </div>

        <form class="editor" (ngSubmit)="saveAccount()">
          <input [(ngModel)]="draft.name" name="name" placeholder="Account name" required />
          <select [(ngModel)]="draft.type" name="type">
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
            <option value="investment">Investment</option>
          </select>
          <input [(ngModel)]="draft.balance" name="balance" type="number" placeholder="Balance" required />
          <input [(ngModel)]="draft.currency" name="currency" placeholder="Currency" required />
          <button type="submit">{{ editingId() ? 'Update account' : 'Create account' }}</button>
        </form>

        @if (!loading()) {
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Balance</th>
                <th>Currency</th>
                <th>Institution</th>
                <th>Last Reviewed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (account of manualAccounts(); track account.id) {
                <tr>
                  <td>{{ account.name }}</td>
                  <td>{{ account.type }}</td>
                  <td>{{ account.balance }}</td>
                  <td>{{ account.currency }}</td>
                  <td>{{ account.institutionName || 'Manual' }}</td>
                  <td>{{ account.lastReviewedAt ? (account.lastReviewedAt | date:'mediumDate') : 'Needs review' }}</td>
                  <td>
                    <button (click)="editAccount(account)">Edit</button>
                    <button (click)="markReviewed(account)">Mark Reviewed</button>
                    <button (click)="deleteAccount(account.id)">Delete</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>

      @if (status()) {
        <p class="status-copy">{{ status() }}</p>
      }
    </div>
  `,
  styles: [`
    .account-list {
      padding: 20px;
      color: var(--foreground, #1f2937);
      font-family: var(--font-body, 'Helvetica Neue', Arial, sans-serif);
      display: grid;
      gap: 20px;
    }
    .page-header,
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
    .eyebrow {
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 12px;
      color: var(--muted, #6b7280);
    }
    .page-header h2,
    .section-heading h3 {
      margin: 0;
    }
    .linked-section,
    .manual-section {
      display: grid;
      gap: 16px;
    }
    .connection-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .connection-card {
      background: var(--surface, #ffffff);
      border-radius: var(--border-radius-lg, 18px);
      border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
      padding: 18px;
      display: grid;
      gap: 12px;
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
      background: color-mix(in srgb, var(--surface, #ffffff) 70%, var(--primary, #2563eb));
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
    .connect-bank,
    .card-actions button,
    .editor button {
      background: var(--primary, #2563eb);
      color: var(--background, #ffffff);
      font-weight: 700;
      border: none;
      padding: 10px 14px;
      border-radius: var(--border-radius-md, 12px);
    }
    .card-actions .secondary {
      background: var(--accent, #d97706);
    }
    .card-actions .danger {
      background: #991b1b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface, #ffffff);
      border-radius: var(--border-radius-lg, 16px);
      overflow: hidden;
    }
    .editor {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
      gap:12px;
      margin-bottom:16px;
      padding:16px;
      background: var(--surface, #ffffff);
      border-radius: var(--border-radius-lg, 18px);
      border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
    }
    .editor input,.editor select,.editor button {
      padding:10px 12px;
      border-radius: var(--border-radius-md, 12px);
      border:1px solid var(--border, rgba(148, 163, 184, 0.2));
    }
    .editor button {
      background: var(--primary, #2563eb);
      color: var(--background, #ffffff);
      font-weight:700;
    }
    th, td {
      border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: var(--background, #f8fafc);
    }
  `]
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

  private async getPlaidHandler(linkToken: string): Promise<{ open: () => void }> {
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
          this.status.set('Connected Plaid institution. Initial sync requested.');
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
        existing.addEventListener('error', () => reject(new Error('Plaid failed to load')), { once: true });
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
