import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinanceService } from '../services/finance.service';
import { Transaction } from '../models';

@Component({
  selector: 'ot-transaction-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="transaction-list">
      <h2>Transactions</h2>
      @if (loading()) {
        <p>Loading transactions...</p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            @for (transaction of transactions(); track transaction.id) {
              <tr>
                <td>{{ transaction.transactionDate | date }}</td>
                <td>{{ transaction.type }}</td>
                <td>{{ transaction.category }}</td>
                <td>{{ transaction.amount }}</td>
                <td>{{ transaction.description }}</td>
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
export class TransactionListComponent implements OnInit {
  transactions = signal<Transaction[]>([]);
  loading = signal(false);

  constructor(private financeService: FinanceService) {}

  async ngOnInit() {
    this.loading.set(true);
    try {
      const transactions = await this.financeService.getTransactions();
      this.transactions.set(transactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      this.loading.set(false);
    }
  }
}
