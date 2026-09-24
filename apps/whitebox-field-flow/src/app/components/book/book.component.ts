import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CustomerBookingDetails,
  ServiceArrivalWindow,
} from '../../models/field-flow.models';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

@Component({
  selector: 'flow-book',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './book.component.html',
  styleUrl: './book.component.scss',
})
export class BookComponent implements OnInit {
  private readonly router = inject(Router);
  readonly apiService = inject(FieldFlowApiService);
  readonly brandConfig = inject(BrandConfigService);

  readonly arrivalWindows: ServiceArrivalWindow[] = [
    { id: 'w1', timeSlot: '8:00 AM - 10:00 AM', available: true },
    { id: 'w2', timeSlot: '10:00 AM - 12:00 PM', available: true },
    { id: 'w3', timeSlot: '1:00 PM - 3:00 PM', available: true },
    { id: 'w4', timeSlot: '3:00 PM - 5:00 PM', available: true },
  ];

  // Form fields
  selectedDate = '';
  selectedWindow = '8:00 AM - 10:00 AM';
  fullName = '';
  mobilePhone = '';
  streetAddress = '';
  gateCode = '';
  serviceNotes = '';
  uploadedPhotoUrls: string[] = [];

  formError = '';

  ngOnInit(): void {
    // If no active estimate exists, initialize default
    if (!this.apiService.activeEstimate()) {
      this.apiService.calculateEstimate({
        servicePackage: 'premium',
        size: 'midsize',
        condition: 'moderate',
        tradeType: this.brandConfig.currentBrand().tradeCategory,
      });
    }

    // Default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.selectedDate = tomorrow.toISOString().split('T')[0];
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
    this.formError = '';

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

    const bookingDetails: CustomerBookingDetails = {
      fullName: this.fullName.trim(),
      mobilePhone: this.mobilePhone.trim(),
      streetAddress: this.streetAddress.trim(),
      gateCode: this.gateCode.trim(),
      serviceNotes: this.serviceNotes.trim(),
      selectedDate: this.selectedDate,
      selectedWindow: this.selectedWindow,
      uploadedPhotoUrls: this.uploadedPhotoUrls,
    };

    this.apiService.createBooking(bookingDetails).subscribe({
      next: () => {
        void this.router.navigate(['/deposit']);
      },
      error: () => {
        void this.router.navigate(['/deposit']);
      },
    });
  }
}
