import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FinanceService } from '../services/finance.service';
import { FinancialInvoiceLine, FinanceWorkspace } from '../models';
import { FINANCE_HOST_CONFIG } from '../finance.routes';

@Component({
  selector: 'ot-finance-invoice-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="editor">
      <header>
        <p class="eyebrow">Retail invoicing</p>
        <h2>Create invoice</h2>
      </header>

      <form (ngSubmit)="save()" class="form-grid">
        <label>
          Customer
          <input name="customerName" [(ngModel)]="customerName" required />
        </label>
        <label>
          Customer email
          <input
            name="customerEmail"
            type="email"
            [(ngModel)]="customerEmail"
          />
        </label>
        <label>
          Due date
          <input name="dueDate" type="date" [(ngModel)]="dueDate" />
        </label>
        <label class="wide">
          Notes
          <textarea name="notes" [(ngModel)]="notes"></textarea>
        </label>

        <div class="wide lines">
          <div class="line-header">
            <h3>Line items</h3>
            <button type="button" (click)="addLine()">Add line</button>
          </div>
          @for (line of lines(); track $index) {
          <div class="line">
            <input
              name="description-{{ $index }}"
              [(ngModel)]="line.description"
              placeholder="Description"
            />
            <input
              name="quantity-{{ $index }}"
              type="number"
              min="1"
              [(ngModel)]="line.quantity"
              placeholder="Qty"
            />
            <input
              name="unit-{{ $index }}"
              type="number"
              min="0"
              [(ngModel)]="line.unitAmount"
              placeholder="Rate"
            />
          </div>
          }
        </div>

        <div class="wide total-bar">
          <strong>Total {{ formatCurrency(total()) }}</strong>
          <button type="submit" [disabled]="saving()">
            {{ saving() ? 'Saving...' : 'Create invoice' }}
          </button>
        </div>
      </form>
      @if (error()) {
      <p class="error">{{ error() }}</p>
      }
    </section>
  `,
  styles: [
    `
      .editor,
      .form-grid,
      .lines {
        display: grid;
        gap: 16px;
      }
      .form-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .wide {
        grid-column: 1 / -1;
      }
      label {
        display: grid;
        gap: 6px;
        color: var(--muted, #64748b);
        font-weight: 700;
      }
      input,
      textarea {
        border: 1px solid var(--border, rgba(148, 163, 184, 0.32));
        border-radius: 8px;
        padding: 10px 12px;
        color: var(--foreground, #0f172a);
        background: var(--surface, #ffffff);
      }
      textarea {
        min-height: 90px;
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
      .line-header,
      .total-bar {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .line {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 100px 140px;
        gap: 10px;
      }
      button {
        border: 0;
        border-radius: 999px;
        background: var(--primary, #2563eb);
        color: var(--background, #ffffff);
        padding: 10px 14px;
        font-weight: 800;
      }
      .error {
        color: #b91c1c;
      }
      @media (max-width: 760px) {
        .form-grid,
        .line {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class InvoiceEditorComponent {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hostConfig = inject(FINANCE_HOST_CONFIG);

  customerName = '';
  customerEmail = '';
  dueDate = '';
  notes = '';
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly lines = signal<FinancialInvoiceLine[]>([
    { description: 'Service deposit', quantity: 1, unitAmount: 250 },
  ]);

  addLine() {
    this.lines.update((lines) => [
      ...lines,
      { description: '', quantity: 1, unitAmount: 0 },
    ]);
  }

  total(): number {
    return this.lines().reduce(
      (sum, line) => sum + Number(line.quantity) * Number(line.unitAmount),
      0
    );
  }

  async save() {
    this.saving.set(true);
    this.error.set(null);
    const workspace =
      (this.route.snapshot.paramMap.get('workspace') as FinanceWorkspace) ??
      'business';

    try {
      await this.financeService.createInvoice({
        customerName: this.customerName,
        customerEmail: this.customerEmail || undefined,
        dueDate: this.dueDate ? new Date(this.dueDate) : undefined,
        notes: this.notes || undefined,
        workspace,
        currency: 'USD',
        lines: this.lines(),
      });
      await this.router.navigate(
        this.workspaceSectionLink(workspace, 'invoices')
      );
    } catch {
      this.error.set('Unable to create invoice.');
    } finally {
      this.saving.set(false);
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  workspaceSectionLink(workspace: FinanceWorkspace, section: string): string[] {
    return ['/', ...this.routeBaseSegments(), workspace, section];
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
