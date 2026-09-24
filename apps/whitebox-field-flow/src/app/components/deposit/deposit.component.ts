import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  DepositPaymentRequest,
  DepositPaymentResponse,
} from '../../models/field-flow.models';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

@Component({
  selector: 'flow-deposit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './deposit.component.html',
  styleUrl: './deposit.component.scss',
})
export class DepositComponent implements OnInit {
  private readonly router = inject(Router);
  readonly apiService = inject(FieldFlowApiService);
  readonly brandConfig = inject(BrandConfigService);

  depositAmount = 50;
  cardholderName = '';
  cardNumber = '';
  expiryDate = '';
  cvc = '';
  postalCode = '';

  isProcessing = false;
  paymentSuccess = false;
  paymentResult: DepositPaymentResponse | null = null;
  formError = '';

  ngOnInit(): void {
    const est = this.apiService.activeEstimate();
    if (est) {
      this.depositAmount = est.depositAmount;
    } else {
      this.depositAmount = this.brandConfig.currentBrand().fixedDeposit || 50;
    }

    const booking = this.apiService.activeBooking();
    if (booking) {
      this.cardholderName = booking.fullName;
    }
  }

  processPayment(): void {
    this.formError = '';

    if (!this.cardholderName.trim()) {
      this.formError = 'Please enter the name printed on the card.';
      return;
    }
    if (
      !this.cardNumber.trim() ||
      this.cardNumber.replace(/\s+/g, '').length < 15
    ) {
      this.formError =
        'Please enter a valid 15 or 16-digit credit card number.';
      return;
    }
    if (!this.expiryDate.trim()) {
      this.formError = 'Please enter the card expiration date (MM/YY).';
      return;
    }
    if (!this.cvc.trim() || this.cvc.length < 3) {
      this.formError =
        'Please enter the 3 or 4-digit card security code (CVC).';
      return;
    }

    this.isProcessing = true;

    const bookingId = `FLW-${Math.floor(1000 + Math.random() * 9000)}`;
    const request: DepositPaymentRequest = {
      bookingId,
      amount: this.depositAmount,
      currency: 'USD',
      cardholderName: this.cardholderName,
      cardNumberMasked: `•••• •••• •••• ${this.cardNumber.slice(-4)}`,
      expiration: this.expiryDate,
      receiptEmail: 'customer@example.com',
    };

    this.apiService.submitDeposit(request).subscribe({
      next: (res) => {
        this.isProcessing = false;
        this.paymentSuccess = true;
        this.paymentResult = res;
      },
      error: () => {
        this.isProcessing = false;
        this.formError =
          'Payment processing failed. Please check card details and try again.';
      },
    });
  }

  trackJob(): void {
    if (this.paymentResult?.bookingId) {
      void this.router.navigate(['/status', this.paymentResult.bookingId]);
    } else {
      void this.router.navigate(['/status', 'FLW-7824']);
    }
  }
}
