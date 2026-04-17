import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FinanceService } from '../services/finance.service';
import {
  Budget,
  FinanceCoachCard,
  FinanceWorkQueue,
  FinanceWorkspace,
  FinanceWorkspaceSummary,
  InventoryItem,
  RecurringItem,
  Transaction,
} from '../models';
import { isAbortLikeHttpError } from '../services/http-error.utils';

@Component({
  selector: 'ot-finance-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="finance-dashboard">
      <header class="dashboard-header">
        <div>
          <p class="eyebrow">{{ workspaceLabel() }}</p>
          <h1>{{ summary()?.headline || 'Workspace summary' }}</h1>
        </div>

        <div class="quick-actions">
          <a [routerLink]="['/finance', workspace(), 'accounts']">Accounts</a>
          <a [routerLink]="['/finance', workspace(), 'transactions']">Transactions</a>
        </div>
      </header>

      @if (loading()) {
        <p class="status">Loading workspace summary...</p>
      } @else if (error()) {
        <p class="status error">{{ error() }}</p>
      } @else {
        <section class="section">
          <div class="section-header">
            <p class="eyebrow">Today</p>
            <h2>Top priorities and current position</h2>
          </div>
        <div class="summary-cards">
          <div class="card">
            <h3>Total Balance</h3>
            <p class="amount">\${{ summary()?.metrics?.totalBalance ?? 0 }}</p>
          </div>
          <div class="card">
            <h3>Net Worth</h3>
            <p class="amount">\${{ summary()?.metrics?.netWorth ?? 0 }}</p>
          </div>
          <div class="card">
            <h3>Monthly Spend</h3>
            <p class="count">\${{ summary()?.metrics?.monthlySpend ?? 0 }}</p>
          </div>
          <div class="card">
            <h3>Budgets At Risk</h3>
            <p class="count">{{ summary()?.metrics?.budgetsAtRiskCount ?? 0 }}</p>
          </div>
        </div>
        </section>

        <section class="section">
          <div class="section-header">
            <p class="eyebrow">Work Queue</p>
            <h2>Resolve the items that improve accuracy first</h2>
          </div>
        <div class="coach-grid">
          @for (card of workQueue()?.items ?? []; track card.id) {
            <article class="coach-card" [attr.data-severity]="card.severity">
              <p class="coach-kicker">{{ card.category }} · {{ card.severity }}</p>
              <h2>{{ card.title }}</h2>
              <p>{{ card.message }}</p>
              <p class="explain">{{ card.explanation }}</p>
              <p class="why">{{ card.whyItMatters }}</p>
              @if (card.actionRoute && card.actionLabel) {
                <a [routerLink]="card.actionRoute">{{ card.actionLabel }}</a>
              }
            </article>
          }
        </div>
        </section>

        <section class="section">
          <div class="section-header">
            <p class="eyebrow">Plan</p>
            <h2>{{ planHeading() }}</h2>
          </div>
          <div class="plan-grid">
            @if (workspace() !== 'net-worth') {
              <article class="plan-card">
                <h3>Budgets</h3>
                @if (budgets().length) {
                  @for (budget of budgets().slice(0, 3); track budget.id) {
                    <p>{{ budget.name }}: \${{ budget.spent }} / \${{ budget.limit }}</p>
                  }
                } @else {
                  <p>No budgets yet for this workspace.</p>
                }
                <a [routerLink]="['/finance', workspace(), 'budgets']">Open budgets</a>
              </article>
              <article class="plan-card">
                <h3>Recurring</h3>
                @if (recurringItems().length) {
                  @for (item of recurringItems().slice(0, 3); track item.id) {
                    <p>{{ item.name }}: {{ item.nextDueDate | date:'mediumDate' }}</p>
                  }
                } @else {
                  <p>No recurring items yet for this workspace.</p>
                }
                <a [routerLink]="['/finance', workspace(), 'recurring']">Open recurring</a>
              </article>
            } @else {
              <article class="plan-card">
                <h3>Tracked Assets</h3>
                @if (assets().length) {
                  @for (asset of assets().slice(0, 4); track asset.id) {
                    <p>{{ asset.name }}: \${{ asset.totalValue }}</p>
                  }
                } @else {
                  <p>No off-ledger assets tracked yet.</p>
                }
                <a [routerLink]="['/finance', 'net-worth', 'assets']">Open assets</a>
              </article>
            }
          </div>
        </section>

        <div class="recent-activity">
          <h2>Recent Transactions</h2>
          @if (recentTransactions().length) {
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                @for (transaction of recentTransactions(); track transaction.id) {
                  <tr>
                    <td>{{ transaction.transactionDate | date:'shortDate' }}</td>
                    <td>{{ transaction.type }}</td>
                    <td>\${{ transaction.amount }}</td>
                    <td>{{ transaction.category }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="status">No transactions yet for this workspace.</p>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .finance-dashboard {
      display: grid;
      gap: 20px;
      color: var(--foreground, #1f2937);
      font-family: var(--font-body, 'Helvetica Neue', Arial, sans-serif);
    }
    .section {
      display:grid;
      gap:14px;
    }
    .section-header h2 {
      margin:0;
      font-size:22px;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: end;
    }
    .eyebrow {
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      color: var(--muted, #6b7280);
    }
    h1 {
      margin: 0;
      font-size: clamp(28px, 4vw, 42px);
      max-width: 18ch;
      line-height: 1.05;
      font-family: var(--font-heading, 'Helvetica Neue', Arial, sans-serif);
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .card {
      background: var(--surface, #ffffff);
      padding: 20px;
      border-radius: var(--border-radius-lg, 18px);
      border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
      box-shadow: var(--shadow-md, 0 16px 40px rgba(15, 23, 42, 0.08));
    }
    .card h3 {
      margin: 0 0 10px 0;
      color: var(--muted, #6b7280);
    }
    .amount {
      font-size: 30px;
      font-weight: bold;
      margin: 0;
      color: var(--primary, #2563eb);
    }
    .count {
      font-size: 30px;
      font-weight: bold;
      margin: 0;
      color: var(--accent, #d97706);
    }
    .quick-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .quick-actions a {
      padding: 10px 16px;
      background: var(--primary, #2563eb);
      color: var(--background, #ffffff);
      border-radius: var(--border-radius-full, 999px);
      text-decoration: none;
      font-weight: 600;
    }
    .coach-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }
    .coach-card {
      padding: 18px;
      border-radius: var(--border-radius-lg, 18px);
      background: var(--surface, #ffffff);
      border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
    }
    .coach-card[data-severity="warning"] {
      border-color: var(--warning, #d97706);
    }
    .coach-card h2 {
      margin: 0 0 8px;
      font-size: 20px;
    }
    .coach-card p {
      margin: 0 0 10px;
    }
    .coach-card a {
      color: var(--primary, #2563eb);
      font-weight: 700;
      text-decoration: none;
    }
    .coach-card .explain,
    .coach-card .why {
      color: var(--muted, #6b7280);
      font-size:14px;
    }
    .coach-kicker {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 12px;
      color: var(--muted, #6b7280);
    }
    .plan-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
      gap:16px;
    }
    .plan-card {
      padding:18px;
      border-radius: var(--border-radius-lg, 18px);
      background: var(--surface, #ffffff);
      border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
      display:grid;
      gap:8px;
    }
    .plan-card h3 {
      margin:0;
    }
    .plan-card a {
      color: var(--primary, #2563eb);
      font-weight:700;
      text-decoration:none;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface, #ffffff);
      border-radius: var(--border-radius-lg, 16px);
      overflow: hidden;
    }
    th, td {
      border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: var(--background, #f8fafc);
      font-weight: 600;
    }
    .status {
      color: var(--muted, #6b7280);
    }
    .status.error {
      color: var(--danger, #dc2626);
    }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);

  summary = signal<FinanceWorkspaceSummary | null>(null);
  workQueue = signal<FinanceWorkQueue | null>(null);
  budgets = signal<Budget[]>([]);
  recurringItems = signal<RecurringItem[]>([]);
  assets = signal<InventoryItem[]>([]);
  recentTransactions = signal<Transaction[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  workspace = signal<FinanceWorkspace>('personal');

  async ngOnInit() {
    await this.loadDashboardData();
  }

  async loadDashboardData() {
    const workspace = (this.route.snapshot.paramMap.get('workspace') ??
      'personal') as FinanceWorkspace;
    this.workspace.set(workspace);
    this.loading.set(true);
    this.error.set(null);
    try {
      const [summary, workQueue, transactions, budgets, recurringItems, assets] = await Promise.all([
        this.financeService.getWorkspaceSummary(workspace),
        this.financeService.getWorkQueue(workspace),
        this.financeService.getTransactions(workspace),
        this.financeService.getBudgets(workspace),
        workspace === 'net-worth'
          ? Promise.resolve([])
          : this.financeService.getRecurringItems(workspace),
        workspace === 'net-worth'
          ? this.financeService.getInventoryItems('net-worth')
          : Promise.resolve([]),
      ]);

      this.summary.set(summary);
      this.workQueue.set(workQueue);
      this.recentTransactions.set(transactions.slice(0, 5));
      this.budgets.set(budgets);
      this.recurringItems.set(recurringItems as RecurringItem[]);
      this.assets.set(assets as InventoryItem[]);
    } catch (error) {
      if (isAbortLikeHttpError(error)) {
        return;
      }
      console.error('Error loading dashboard data:', error);
      this.error.set('Unable to load finance workspace data right now.');
    } finally {
      this.loading.set(false);
    }
  }

  workspaceLabel(): string {
    const workspace = this.workspace();
    return workspace === 'net-worth'
      ? 'Net Worth'
      : workspace === 'business'
        ? 'Business'
        : 'Personal';
  }

  planHeading(): string {
    return this.workspace() === 'net-worth'
      ? 'Assets and liability coverage'
      : 'Budgets and recurring obligations';
  }
}
