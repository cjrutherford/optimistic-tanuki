import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinanceService } from '../services/finance.service';
import { Account } from '../models';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'ot-account-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="account-list">
      <h2>Accounts</h2>
      @if (loading()) {
        <p>Loading accounts...</p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Balance</th>
              <th>Currency</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (account of accounts(); track account.id) {
              <tr>
                <td>{{ account.name }}</td>
                <td>{{ account.type }}</td>
                <td>{{ account.balance }}</td>
                <td>{{ account.currency }}</td>
                <td>
                  <button (click)="viewAccount(account.id)">View</button>
                  <button (click)="deleteAccount(account.id)">Delete</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .account-list {
      padding: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
  `]
})
export class AccountListComponent implements OnInit {
  accounts = signal<Account[]>([]);
  loading = signal(false);

  constructor(private financeService: FinanceService) {}

  async ngOnInit() {
    await this.loadAccounts();
  }

  async loadAccounts() {
    this.loading.set(true);
    try {
      const accounts = await this.financeService.getAccounts();
      this.accounts.set(accounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      this.loading.set(false);
    }
  }

  viewAccount(id: string) {
    // Navigation handled by router
  }

  async deleteAccount(id: string) {
    if (confirm('Are you sure you want to delete this account?')) {
      try {
        await this.financeService.deleteAccount(id);
        await this.loadAccounts();
      } catch (error) {
        console.error('Error deleting account:', error);
      }
    }
  }
}
