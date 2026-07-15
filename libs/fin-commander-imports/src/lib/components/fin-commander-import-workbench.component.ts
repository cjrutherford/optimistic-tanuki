import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Account,
  FinanceService,
  FinanceWorkspace,
} from '@optimistic-tanuki/finance-ui';
import {
  FinCommanderImportPreview,
  FinCommanderImportRegistryService,
} from '../providers/fin-commander-import-registry.service';

@Component({
  selector: 'fc-fin-commander-import-workbench',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="import-shell">
      <header>
        <p class="eyebrow">Import Command</p>
        <h2>Runtime provider registry with real transaction commits.</h2>
      </header>

      <div class="control-grid">
        <label>
          <span>Provider</span>
          <select [(ngModel)]="providerId">
            @for (manifest of registry.manifests; track manifest.id) {
            <option [value]="manifest.id">{{ manifest.name }}</option>
            }
          </select>
        </label>

        <label>
          <span>Workspace</span>
          <select [(ngModel)]="workspace" (ngModelChange)="loadAccounts()">
            <option value="personal">Personal</option>
            <option value="business">Business</option>
            <option value="net-worth">Net Worth</option>
          </select>
        </label>

        <label>
          <span>Account</span>
          <select [(ngModel)]="accountId">
            @for (account of accounts(); track account.id) {
            <option [value]="account.id">{{ account.name }}</option>
            }
          </select>
        </label>
      </div>

      <label class="input-pane">
        <span>{{ activePlaceholder() }}</span>
        <textarea [(ngModel)]="rawInput" rows="7"></textarea>
      </label>

      <div class="actions">
        <button type="button" (click)="previewImport()" [disabled]="busy()">
          Preview import
        </button>
        @if (!pendingCommit()) {
        <button
          type="button"
          class="secondary"
          (click)="requestCommit()"
          [disabled]="!preview() || !accountId || busy()"
        >
          Commit preview
        </button>
        } @else {
        <button
          type="button"
          class="ghost"
          (click)="cancelCommit()"
          [disabled]="busy()"
        >
          Cancel
        </button>
        <button
          type="button"
          class="danger"
          (click)="commitPreview()"
          [disabled]="busy()"
        >
          Confirm commit ({{ preview()?.transactions?.length ?? 0 }})
        </button>
        }
      </div>

      @if (pendingCommit() && preview(); as activePreview) {
      <p class="commit-warning" role="alert">
        About to write {{ activePreview.transactions.length }} transactions to
        the selected account. This cannot be undone from here.
      </p>
      } @if (preview(); as activePreview) {
      <article class="preview-card">
        <h3>{{ activePreview.title }}</h3>
        @if (activePreview.warnings.length) {
        <ul>
          @for (warning of activePreview.warnings; track warning) {
          <li>{{ warning }}</li>
          }
        </ul>
        }

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            @for (transaction of activePreview.transactions; track
            transaction.description + transaction.postedOn) {
            <tr>
              <td>{{ transaction.postedOn }}</td>
              <td>{{ transaction.description }}</td>
              <td>{{ transaction.type }}</td>
              <td>{{ formatCents(transaction.amountCents) }}</td>
              <td>{{ transaction.category }}</td>
            </tr>
            }
          </tbody>
        </table>
      </article>
      } @if (status()) {
      <p class="status" role="status" aria-live="polite">{{ status() }}</p>
      }
    </section>
  `,
  styles: [
    `
      .import-shell {
        display: grid;
        gap: 1rem;
        color: var(--foreground, #1f2937);
      }
      .eyebrow {
        margin: 0 0 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.75rem;
        color: var(--muted, #6b7280);
      }
      h2 {
        margin: 0;
        font-family: var(--font-heading, 'Helvetica Neue', Arial, sans-serif);
        font-size: clamp(1.8rem, 4vw, 2.8rem);
      }
      .control-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }
      label,
      .preview-card {
        display: grid;
        gap: 0.5rem;
      }
      select,
      textarea,
      button {
        border-radius: var(--border-radius-md, 12px);
        border: 1px solid var(--border, rgba(148, 163, 184, 0.25));
        padding: 0.85rem 1rem;
        font: inherit;
      }
      textarea {
        min-height: 10rem;
        resize: vertical;
        background: var(--surface, #ffffff);
      }
      .actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      button {
        cursor: pointer;
        background: var(--primary, #2563eb);
        color: var(--background, #ffffff);
        font-weight: 700;
      }
      .secondary {
        background: var(--accent, #d97706);
      }
      .ghost {
        background: transparent;
        color: var(--foreground, #1f2937);
        border: 1px solid var(--border, rgba(148, 163, 184, 0.4));
      }
      .danger {
        background: var(--danger, #dc2626);
        color: #fff;
      }
      .commit-warning {
        margin: 0;
        padding: 0.75rem 1rem;
        border-radius: var(--border-radius-md, 12px);
        background: color-mix(in srgb, var(--danger, #dc2626) 12%, transparent);
        border: 1px solid
          color-mix(in srgb, var(--danger, #dc2626) 35%, transparent);
        color: var(--danger, #dc2626);
        font-size: 0.85rem;
      }
      .preview-card {
        padding: 1rem;
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, rgba(148, 163, 184, 0.25));
        border-radius: var(--border-radius-lg, 18px);
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: 0.65rem;
        border-bottom: 1px solid var(--border, rgba(148, 163, 184, 0.2));
        text-align: left;
      }
      .status {
        margin: 0;
        color: var(--muted, #6b7280);
      }
    `,
  ],
})
export class FinCommanderImportWorkbenchComponent implements OnInit {
  protected readonly registry = inject(FinCommanderImportRegistryService);
  private readonly financeService = inject(FinanceService);

  readonly accounts = signal<Account[]>([]);
  readonly preview = signal<FinCommanderImportPreview | null>(null);
  readonly status = signal<string>('');
  readonly pendingCommit = signal(false);
  readonly busy = signal(false);

  providerId = this.registry.manifests[0].id;
  workspace: FinanceWorkspace = 'personal';
  accountId = '';
  rawInput =
    'date,description,amount,type,category\n2026-04-11,Neighborhood Market,84.52,debit,Groceries';

  async ngOnInit() {
    await this.loadAccounts();
  }

  /** Formats an integer-cents amount as USD with two decimals for display. */
  formatCents(amountCents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format((Number(amountCents) || 0) / 100);
  }

  activePlaceholder(): string {
    return (
      this.registry.manifests.find(
        (manifest) => manifest.id === this.providerId
      )?.inputLabel ?? 'Input'
    );
  }

  async loadAccounts() {
    try {
      const accounts = await this.financeService.getAccounts(this.workspace);
      this.accounts.set(accounts);
      this.accountId = accounts[0]?.id ?? '';
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 0) {
        return;
      }

      throw error;
    }
  }

  async previewImport() {
    this.pendingCommit.set(false);
    this.busy.set(true);
    try {
      const provider = await this.registry.loadProvider(this.providerId);
      const preview = await provider.preview(this.rawInput);
      this.preview.set(preview);
      const count = preview.transactions.length;
      const warningCount = preview.warnings.length;
      this.status.set(
        `Preview ready: ${count} transaction${count === 1 ? '' : 's'}` +
          (warningCount
            ? `, ${warningCount} warning${warningCount === 1 ? '' : 's'}.`
            : '.')
      );
    } catch (error) {
      this.preview.set(null);
      this.status.set(
        `Preview failed: ${
          error instanceof Error ? error.message : 'Unknown error.'
        }`
      );
    } finally {
      this.busy.set(false);
    }
  }

  requestCommit() {
    if (!this.preview() || !this.accountId) {
      this.status.set('Choose an account and run a preview before committing.');
      return;
    }
    this.pendingCommit.set(true);
  }

  cancelCommit() {
    this.pendingCommit.set(false);
  }

  async commitPreview() {
    const preview = this.preview();
    if (!preview || !this.accountId) {
      this.status.set(
        'Choose an account before committing imported transactions.'
      );
      this.pendingCommit.set(false);
      return;
    }

    this.busy.set(true);
    let committed = 0;
    try {
      for (const transaction of preview.transactions) {
        await this.financeService.createTransaction({
          accountId: this.accountId,
          // Finance transactions are stored as decimal dollars; convert from the
          // importer's integer cents at the boundary.
          amount: transaction.amountCents / 100,
          type: transaction.type,
          category: transaction.category,
          description: transaction.description,
          payeeOrVendor: transaction.payeeOrVendor,
          transactionDate: new Date(transaction.postedOn),
          workspace: this.workspace,
        });
        committed += 1;
      }
      this.status.set(`Committed ${committed} imported transactions.`);
      this.preview.set(null);
    } catch (error) {
      this.status.set(
        `Commit halted after ${committed} of ${
          preview.transactions.length
        } transactions: ${
          error instanceof Error ? error.message : 'Unknown error.'
        }`
      );
    } finally {
      this.pendingCommit.set(false);
      this.busy.set(false);
    }
  }
}
