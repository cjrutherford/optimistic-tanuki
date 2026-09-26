import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CardComponent,
  ButtonComponent,
  BadgeComponent,
} from '@optimistic-tanuki/common-ui';
import {
  TextInputComponent,
  TextAreaComponent,
} from '@optimistic-tanuki/form-ui';
import {
  CustomerBookingDetails,
  EstimateCalculation,
  ServiceArrivalWindow,
} from '../../models/field-flow.models';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { CustomerAuthService } from '../../services/customer-auth.service';

@Component({
  selector: 'flow-book',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    TextInputComponent,
    TextAreaComponent,
  ],
  templateUrl: './book.component.html',
  styleUrl: './book.component.scss',
})
export class BookComponent implements OnInit {
  private readonly router = inject(Router);
  readonly apiService = inject(FieldFlowApiService);
  readonly auth = inject(CustomerAuthService);

  arrivalWindows: ServiceArrivalWindow[] = [];
  selectedDate = '';
  selectedWindow = '';
  fullName = '';
  emailAddress = '';
  mobilePhone = '';
  streetAddress = '';
  gateCode = '';
  serviceNotes = '';
  uploadedPhotoUrls: string[] = [];
  formError = '';
  availabilityError = '';
  availabilityEmpty = false;
  isAvailabilityLoading = false;
  private availabilityRequestId = 0;
  isSubmitting = false;

  get hasUsableEstimate(): boolean {
    return this.isUsableEstimate(this.apiService.activeEstimate());
  }

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.fullName = user.name;
      this.emailAddress = user.email;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.selectedDate = tomorrow.toISOString().split('T')[0];

    if (this.hasUsableEstimate) {
      this.loadAvailability();
    } else {
      this.availabilityError =
        'Loading availability requires a server-authoritative estimate.';
    }
  }

  loadAvailability(): void {
    const requestId = ++this.availabilityRequestId;
    this.arrivalWindows = [];
    this.selectedWindow = '';
    this.availabilityError = '';
    this.availabilityEmpty = false;
    this.formError = '';
    this.isAvailabilityLoading = false;

    const estimate = this.apiService.activeEstimate();
    if (!this.isUsableEstimate(estimate)) {
      this.availabilityError =
        'Loading availability requires a server-authoritative estimate.';
      return;
    }
    if (!this.selectedDate) {
      this.availabilityError = 'Select a service date to load availability.';
      return;
    }

    this.isAvailabilityLoading = true;
    this.apiService
      .getAvailability({
        serviceId: estimate.serviceId,
        date: this.selectedDate,
      })
      .subscribe({
        next: (response) => {
          if (requestId !== this.availabilityRequestId) {
            return;
          }
          this.arrivalWindows = response.windows;
          this.availabilityEmpty = !response.windows.some(
            (window) => window.available
          );
          this.isAvailabilityLoading = false;
          const firstAvailable = response.windows.find(
            (window) => window.available
          );
          this.selectedWindow = firstAvailable?.timeSlot ?? '';
        },
        error: (error: unknown) => {
          if (requestId !== this.availabilityRequestId) {
            return;
          }
          this.isAvailabilityLoading = false;
          this.availabilityError =
            error instanceof Error && error.message
              ? error.message
              : 'Unable to load availability. Please try again.';
        },
      });
  }

  onDateChange(): void {
    this.loadAvailability();
  }

  selectWindow(window: ServiceArrivalWindow): void {
    if (window.available) {
      this.selectedWindow = window.timeSlot;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            this.uploadedPhotoUrls.push(e.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }

  removePhoto(index: number): void {
    this.uploadedPhotoUrls.splice(index, 1);
  }

  submitBooking(): void {
    if (this.isSubmitting) {
      return;
    }
    this.formError = '';

    const estimate = this.apiService.activeEstimate();
    if (!this.isUsableEstimate(estimate)) {
      this.formError = estimate
        ? 'The server-authoritative estimate has expired. Request a new estimate.'
        : 'A server-authoritative estimate is required before booking.';
      return;
    }
    if (!this.fullName.trim()) {
      this.formError = 'Please enter your full name.';
      return;
    }
    if (!this.mobilePhone.trim()) {
      this.formError =
        'Please enter your mobile phone number for automated SMS dispatch alerts.';
      return;
    }
    if (!this.streetAddress.trim()) {
      this.formError = 'Please enter the service street address.';
      return;
    }
    if (!this.selectedDate) {
      this.formError = 'Please select a preferred service arrival date.';
      return;
    }
    if (!this.selectedWindow) {
      this.formError = 'Please select an available arrival window.';
      return;
    }
    if (
      this.arrivalWindows.length > 0 &&
      !this.arrivalWindows.some(
        (window) => window.available && window.timeSlot === this.selectedWindow
      )
    ) {
      this.formError = 'Please select an available arrival window.';
      return;
    }

    const bookingDetails: CustomerBookingDetails = {
      fullName: this.fullName.trim(),
      emailAddress:
        this.emailAddress.trim() || this.auth.currentUser()?.email || '',
      mobilePhone: this.mobilePhone.trim(),
      streetAddress: this.streetAddress.trim(),
      gateCode: this.gateCode.trim(),
      serviceNotes: this.serviceNotes.trim(),
      selectedDate: this.selectedDate,
      selectedWindow: this.selectedWindow,
      uploadedPhotoUrls: this.uploadedPhotoUrls,
    };

    this.isSubmitting = true;
    this.apiService.createBooking(bookingDetails).subscribe({
      next: () => {
        this.isSubmitting = false;
        void this.router.navigate(['/deposit']);
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        this.formError =
          error instanceof Error && error.message
            ? `Unable to create booking: ${error.message}`
            : 'Unable to create booking. Please try again.';
      },
    });
  }

  private isUsableEstimate(
    estimate: EstimateCalculation | null
  ): estimate is EstimateCalculation & {
    estimateId: string;
    serviceId: string;
    expiresAt: string;
  } {
    return (
      estimate?.isAuthoritative === true &&
      typeof estimate.estimateId === 'string' &&
      estimate.estimateId.trim().length > 0 &&
      typeof estimate.serviceId === 'string' &&
      estimate.serviceId.trim().length > 0 &&
      typeof estimate.expiresAt === 'string' &&
      Number.isFinite(Date.parse(estimate.expiresAt)) &&
      Date.parse(estimate.expiresAt) > Date.now()
    );
  }
}
