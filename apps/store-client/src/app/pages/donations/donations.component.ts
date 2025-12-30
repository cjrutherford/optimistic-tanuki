import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DonationComponent, DonationRequest } from '@optimistic-tanuki/store-ui';

@Component({
  selector: 'store-donations',
  standalone: true,
  imports: [CommonModule, DonationComponent],
  templateUrl: './donations.component.html',
  styleUrls: ['./donations.component.scss'],
})
export class DonationsComponent {
  onDonate(donation: DonationRequest): void {
    console.log('Donation submitted:', donation);
    // In a real app, this would call a donation service
    alert(`Thank you for your donation of $${donation.amount.toFixed(2)}!`);
  }
}
