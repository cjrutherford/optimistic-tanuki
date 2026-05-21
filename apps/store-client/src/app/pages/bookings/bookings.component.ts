import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  StoreService,
  Resource,
  CreateAppointmentRequest,
  Appointment,
} from '../../services/store.service';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bookings.component.html',
  styleUrls: ['./bookings.component.scss'],
})
export class BookingsComponent implements OnInit {
  resources: Resource[] = [];
  userAppointments: Appointment[] = [];
  selectedResource: Resource | null = null;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Filter
  selectedType = 'all';
  resourceTypes = ['all', 'room', 'equipment', 'vehicle', 'other'];

  // Booking form
  bookingForm: CreateAppointmentRequest = {
    userId: 'current-user-id', // TODO: Get from auth service
    resourceId: '',
    title: '',
    description: '',
    startTime: new Date(),
    endTime: new Date(),
    isFreeConsultation: false,
    notes: '',
  };

  showBookingModal = false;
  showMyBookings = false;

  constructor(private storeService: StoreService) {}

  ngOnInit(): void {
    this.loadResources();
    this.loadUserAppointments();
  }

  loadResources(): void {
    this.loading = true;
    this.error = null;

    this.storeService.getResources().subscribe({
      next: (resources) => {
        this.resources = resources;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load resources';
        this.loading = false;
        console.error(err);
      },
    });
  }

  loadUserAppointments(): void {
    // TODO: Get actual user ID from auth service
    this.storeService.getUserAppointments('current-user-id').subscribe({
      next: (appointments) => {
        this.userAppointments = appointments;
      },
      error: (err) => {
        console.error('Failed to load appointments:', err);
      },
    });
  }

  get filteredResources(): Resource[] {
    if (this.selectedType === 'all') {
      return this.resources;
    }
    return this.resources.filter((r) => r.type === this.selectedType);
  }

  openBookingModal(resource: Resource): void {
    this.selectedResource = resource;
    this.bookingForm = {
      userId: 'current-user-id', // TODO: Get from auth service
      resourceId: resource.id,
      title: '',
      description: '',
      startTime: new Date(),
      endTime: new Date(),
      isFreeConsultation: false,
      notes: '',
    };
    this.showBookingModal = true;
    this.error = null;
    this.successMessage = null;
  }

  closeBookingModal(): void {
    this.showBookingModal = false;
    this.selectedResource = null;
  }

  submitBooking(): void {
    if (!this.selectedResource) return;

    this.loading = true;
    this.error = null;
    this.successMessage = null;

    // Check availability first
    this.storeService
      .checkResourceAvailability(
        this.selectedResource.id,
        this.bookingForm.startTime,
        this.bookingForm.endTime
      )
      .subscribe({
        next: (isAvailable) => {
          if (!isAvailable) {
            this.error =
              'This resource is not available for the selected time slot. Please choose a different time.';
            this.loading = false;
            return;
          }

          // Create the appointment
          this.storeService.createAppointment(this.bookingForm).subscribe({
            next: (appointment) => {
              this.successMessage = 'Booking created successfully! Pending approval.';
              this.loading = false;
              this.loadUserAppointments();
              setTimeout(() => {
                this.closeBookingModal();
              }, 2000);
            },
            error: (err) => {
              this.error = 'Failed to create booking. Please try again.';
              this.loading = false;
              console.error(err);
            },
          });
        },
        error: (err) => {
          this.error = 'Failed to check availability. Please try again.';
          this.loading = false;
          console.error(err);
        },
      });
  }

  toggleMyBookings(): void {
    this.showMyBookings = !this.showMyBookings;
  }

  cancelAppointment(appointment: Appointment): void {
    if (!appointment.id) return;
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    this.loading = true;
    this.error = null;

    this.storeService.cancelAppointment(appointment.id).subscribe({
      next: () => {
        this.successMessage = 'Booking cancelled successfully.';
        this.loading = false;
        this.loadUserAppointments();
        setTimeout(() => {
          this.successMessage = null;
        }, 3000);
      },
      error: (err) => {
        this.error = 'Failed to cancel booking.';
        this.loading = false;
        console.error(err);
      },
    });
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  calculateDuration(appointment: Appointment): string {
    const start = new Date(appointment.startTime);
    const end = new Date(appointment.endTime);
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  getStatusClass(status?: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'status-pending',
      approved: 'status-approved',
      denied: 'status-denied',
      cancelled: 'status-cancelled',
      completed: 'status-completed',
    };
    return status ? statusMap[status] || '' : '';
  }
}
