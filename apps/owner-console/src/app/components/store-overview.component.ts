import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  StoreService,
  Donation,
  Subscription,
} from '../services/store.service';

@Component({
  selector: 'app-store-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './store-overview.component.html',
  styleUrls: ['./store-overview.component.scss'],
})
export class StoreOverviewComponent implements OnInit {
  private storeService = inject(StoreService);

  donations: Donation[] = [];
  subscriptions: Subscription[] = [];
  loading = false;
  error: string | null = null;



  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    this.storeService.getDonations().subscribe({
      next: (donations) => {
        this.donations = donations;
      },
      error: (err) => {
        this.error = 'Failed to load donations';
        console.error(err);
      },
    });

    this.storeService.getSubscriptions().subscribe({
      next: (subscriptions) => {
        this.subscriptions = subscriptions;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load subscriptions';
        this.loading = false;
        console.error(err);
      },
    });
  }

  get totalDonations(): number {
    return this.donations.reduce((sum, d) => sum + Number(d.amount), 0);
  }

  get activeSubscriptions(): number {
    return this.subscriptions.filter((s) => s.status === 'active').length;
  }

  cancelSubscription(subscription: Subscription): void {
    if (!confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.storeService.cancelSubscription(subscription.id).subscribe({
      next: () => {
        this.loadData();
      },
      error: (err) => {
        this.error = 'Failed to cancel subscription';
        this.loading = false;
        console.error(err);
      },
    });
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      active: 'status-active',
      cancelled: 'status-cancelled',
      expired: 'status-expired',
      pending: 'status-pending',
      completed: 'status-completed',
      failed: 'status-failed',
    };
    return statusMap[status] || '';
  }
}
