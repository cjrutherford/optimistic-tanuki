import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FinanceService } from '../services/finance.service';
import { Account, Transaction, Budget } from '../models';

@Component({
  selector: 'ot-finance-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="finance-dashboard">
      <h1>Financial Dashboard</h1>
      
      <div class="summary-cards">
        <div class="card">
          <h3>Total Balance</h3>
          <p class="amount">\${{ totalBalance() }}</p>
        </div>
        <div class="card">
          <h3>Accounts</h3>
          <p class="count">{{ accounts().length }}</p>
        </div>
        <div class="card">
          <h3>Recent Transactions</h3>
          <p class="count">{{ recentTransactions().length }}</p>
        </div>
        <div class="card">
          <h3>Active Budgets</h3>
          <p class="count">{{ budgets().length }}</p>
        </div>
      </div>

      <div class="quick-actions">
        <h2>Quick Actions</h2>
        <button routerLink="/finance/accounts">View Accounts</button>
        <button routerLink="/finance/transactions">View Transactions</button>
        <button routerLink="/finance/inventory">View Inventory</button>
        <button routerLink="/finance/budgets">View Budgets</button>
      </div>

      @if (loading()) {
        <p>Loading dashboard data...</p>
      } @else {
        <div class="recent-activity">
          <h2>Recent Transactions</h2>
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
                  <td>{{ transaction.transactionDate | date:'short' }}</td>
                  <td>{{ transaction.type }}</td>
                  <td>\${{ transaction.amount }}</td>
                  <td>{{ transaction.category }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .finance-dashboard {
      padding: 20px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card h3 {
      margin: 0 0 10px 0;
      color: #666;
    }
    .amount {
      font-size: 32px;
      font-weight: bold;
      margin: 0;
      color: #2e7d32;
    }
    .count {
      font-size: 32px;
      font-weight: bold;
      margin: 0;
      color: #1976d2;
    }
    .quick-actions {
      margin-bottom: 30px;
    }
    .quick-actions button {
      margin-right: 10px;
      margin-bottom: 10px;
      padding: 10px 20px;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .quick-actions button:hover {
      background: #1565c0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: 600;
    }
  `]
})
export class DashboardComponent implements OnInit {
  accounts = signal<Account[]>([]);
  recentTransactions = signal<Transaction[]>([]);
  budgets = signal<Budget[]>([]);
  loading = signal(false);
  totalBalance = signal(0);

  constructor(private financeService: FinanceService) {}

  async ngOnInit() {
    await this.loadDashboardData();
  }

  async loadDashboardData() {
    this.loading.set(true);
    try {
      const [accounts, transactions, budgets] = await Promise.all([
        this.financeService.getAccounts(),
        this.financeService.getTransactions(),
        this.financeService.getBudgets(),
      ]);
      
      this.accounts.set(accounts);
      this.recentTransactions.set(transactions.slice(0, 5));
      this.budgets.set(budgets);
      
      const total = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
      this.totalBalance.set(total);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      this.loading.set(false);
    }
  }
}
