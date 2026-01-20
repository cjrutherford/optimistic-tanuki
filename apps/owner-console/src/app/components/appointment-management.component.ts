import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../services/store.service';
import {
  Appointment,
  ApproveAppointmentDto,
  DenyAppointmentDto,
} from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-appointment-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointment-management.component.html',
  styleUrls: ['./appointment-management.component.scss'],
})
export class AppointmentManagementComponent implements OnInit {
  appointments: Appointment[] = [];
  filteredAppointments: Appointment[] = [];
  loading = false;
  error: string | null = null;
  statusFilter = 'all';
  selectedAppointment: Appointment | null = null;
  showApproveModal = false;
  showDenyModal = false;
  showInvoiceModal = false;

  approveForm: ApproveAppointmentDto = {
    hourlyRate: undefined,
    notes: '',
  };

  denyForm: DenyAppointmentDto = {
    denialReason: '',
  };

  generatedInvoice: any = null;

  constructor(private storeService: StoreService) {}

  ngOnInit(): void {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.loading = true;
    this.error = null;

    this.storeService.getAppointments().subscribe({
      next: (appointments) => {
        this.appointments = appointments;
        this.filterAppointments();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load appointments';
        this.loading = false;
        console.error(err);
      },
    });
  }

  filterAppointments(): void {
    if (this.statusFilter === 'all') {
      this.filteredAppointments = this.appointments;
    } else {
      this.filteredAppointments = this.appointments.filter(
        (a) => a.status === this.statusFilter
      );
    }
  }

  onStatusFilterChange(): void {
    this.filterAppointments();
  }

  openApproveModal(appointment: Appointment): void {
    this.selectedAppointment = appointment;
    this.approveForm = {
      hourlyRate: appointment.hourlyRate,
      notes: '',
    };
    this.showApproveModal = true;
  }

  closeApproveModal(): void {
    this.showApproveModal = false;
    this.selectedAppointment = null;
    this.approveForm = { hourlyRate: undefined, notes: '' };
  }

  approveAppointment(): void {
    if (!this.selectedAppointment) return;

    this.loading = true;
    this.error = null;

    this.storeService
      .approveAppointment(this.selectedAppointment.id, this.approveForm)
      .subscribe({
        next: () => {
          this.closeApproveModal();
          this.loadAppointments();
        },
        error: (err) => {
          this.error = 'Failed to approve appointment';
          this.loading = false;
          console.error(err);
        },
      });
  }

  openDenyModal(appointment: Appointment): void {
    this.selectedAppointment = appointment;
    this.denyForm = { denialReason: '' };
    this.showDenyModal = true;
  }

  closeDenyModal(): void {
    this.showDenyModal = false;
    this.selectedAppointment = null;
    this.denyForm = { denialReason: '' };
  }

  denyAppointment(): void {
    if (!this.selectedAppointment) return;

    this.loading = true;
    this.error = null;

    this.storeService
      .denyAppointment(this.selectedAppointment.id, this.denyForm)
      .subscribe({
        next: () => {
          this.closeDenyModal();
          this.loadAppointments();
        },
        error: (err) => {
          this.error = 'Failed to deny appointment';
          this.loading = false;
          console.error(err);
        },
      });
  }

  completeAppointment(appointment: Appointment): void {
    if (!confirm('Mark this appointment as completed?')) return;

    this.loading = true;
    this.error = null;

    this.storeService.completeAppointment(appointment.id).subscribe({
      next: () => {
        this.loadAppointments();
      },
      error: (err) => {
        this.error = 'Failed to complete appointment';
        this.loading = false;
        console.error(err);
      },
    });
  }

  cancelAppointment(appointment: Appointment): void {
    if (!confirm('Cancel this appointment?')) return;

    this.loading = true;
    this.error = null;

    this.storeService.cancelAppointment(appointment.id).subscribe({
      next: () => {
        this.loadAppointments();
      },
      error: (err) => {
        this.error = 'Failed to cancel appointment';
        this.loading = false;
        console.error(err);
      },
    });
  }

  generateInvoice(appointment: Appointment): void {
    this.loading = true;
    this.error = null;

    this.storeService.generateInvoice(appointment.id).subscribe({
      next: (invoice) => {
        this.generatedInvoice = invoice;
        this.showInvoiceModal = true;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to generate invoice';
        this.loading = false;
        console.error(err);
      },
    });
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.generatedInvoice = null;
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'status-pending',
      approved: 'status-approved',
      denied: 'status-denied',
      cancelled: 'status-cancelled',
      completed: 'status-completed',
    };
    return statusMap[status] || '';
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
}
