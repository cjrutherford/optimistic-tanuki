import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DonationComponent,
  DonationRequest,
} from '@optimistic-tanuki/store-ui';
import { StoreService } from '../../services/store.service';

@Component({
  selector: 'store-donations',
  standalone: true,
  imports: [CommonModule, DonationComponent],
  templateUrl: './donations.component.html',
  styleUrls: ['./donations.component.scss'],
})
export class DonationsComponent {
  loading = false;
  error: string | null = null;
  success: string | null = null;
  disabled = false;

  constructor(private storeService: StoreService) {}

  onDonate(donation: DonationRequest): void {
    this.loading = true;
    this.error = null;
    this.success = null;

    // The donation form collects a dollar amount; convert to integer cents
    // before it hits the backend, which stores donation.amountCents.
    this.storeService
      .createDonation({
        amountCents: Math.round(donation.amount * 100),
        message: donation.message,
        anonymous: donation.anonymous,
      })
      .subscribe({
        next: () => {
          this.success = `Thank you for your donation of $${donation.amount.toFixed(
            2
          )}!`;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error creating donation:', err);
          this.error = 'Failed to process donation. Please try again.';
          this.loading = false;
        },
      });
  }
}
