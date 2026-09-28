import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  CardComponent,
  ButtonComponent,
  BadgeComponent,
} from '@optimistic-tanuki/common-ui';
import { DepositPaymentResponse } from '../../models/field-flow.models';
import { FieldFlowApiService } from '../../services/field-flow-api.service';

@Component({
  selector: 'flow-deposit',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent, BadgeComponent],
  templateUrl: './deposit.component.html',
  styleUrl: './deposit.component.scss',
})
export class DepositComponent implements OnInit {
  private readonly router = inject(Router);
  readonly apiService = inject(FieldFlowApiService);

  depositAmount = 0;
  isProcessing = false;
  paymentSuccess = false;
  paymentResult: DepositPaymentResponse | null = null;
  formError = '';

  ngOnInit(): void {
    const estimate = this.apiService.activeEstimate();
    this.depositAmount =
      estimate?.isAuthoritative === true ? estimate.depositAmount : 0;
  }

  processPayment(): void {
    if (this.isProcessing) {
      return;
    }
    this.formError = '';
    const booking = this.apiService.activeBooking();
    if (!booking?.bookingId && !booking?.trackingCode) {
      this.formError = 'A confirmed booking is required before payment.';
      return;
    }

    this.isProcessing = true;
    const request = booking.bookingId
      ? { bookingId: booking.bookingId }
      : { trackingCode: booking.trackingCode as string };
    this.apiService.submitDeposit(request).subscribe({
      next: (result) => {
        this.isProcessing = false;
        this.paymentResult = result;
        this.paymentSuccess = false;
        this.formError =
          'Secure payment is not available yet. The payment request was created without collecting card details.';
      },
      error: (error: unknown) => {
        this.isProcessing = false;
        this.formError =
          error instanceof Error && error.message
            ? `Unable to start payment: ${error.message}`
            : 'Unable to start payment. Please try again.';
      },
    });
  }

  trackJob(): void {
    const bookingId =
      this.paymentResult?.bookingId ??
      this.apiService.activeBooking()?.bookingId;
    const trackingCode =
      this.paymentResult?.trackingCode ??
      this.apiService.activeBooking()?.trackingCode;
    if (bookingId) {
      void this.router.navigate(['/status', bookingId]);
    } else if (trackingCode) {
      void this.router.navigate(['/status', trackingCode]);
    }
  }
}
