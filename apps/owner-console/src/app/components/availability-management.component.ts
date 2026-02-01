import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../services/store.service';
import {
  Availability,
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
} from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-availability-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './availability-management.component.html',
  styleUrls: ['./availability-management.component.scss'],
})
export class AvailabilityManagementComponent implements OnInit {
  private storeService = inject(StoreService);

  availabilities: Availability[] = [];
  loading = false;
  error: string | null = null;
  showCreateModal = false;
  showEditModal = false;
  selectedAvailability: Availability | null = null;

  createForm: CreateAvailabilityDto = {
    ownerId: '',
    dayOfWeek: 0,
    startTime: '09:00:00',
    endTime: '17:00:00',
    hourlyRate: 0,
    serviceType: '',
    isActive: true,
  };

  editForm: UpdateAvailabilityDto = {};

  daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];



  ngOnInit(): void {
    this.loadAvailabilities();
  }

  loadAvailabilities(): void {
    this.loading = true;
    this.error = null;

    this.storeService.getAvailabilities().subscribe({
      next: (availabilities) => {
        this.availabilities = availabilities;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load availabilities';
        this.loading = false;
        console.error(err);
      },
    });
  }

  openCreateModal(): void {
    // TODO: Get current user ID from auth service
    // For now using a placeholder that needs to be replaced with actual user ID
    this.createForm = {
      ownerId: 'OWNER_ID_FROM_AUTH_SERVICE', // Replace with actual user ID from auth service
      dayOfWeek: 1,
      startTime: '09:00:00',
      endTime: '17:00:00',
      hourlyRate: 50,
      serviceType: '',
      isActive: true,
    };
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  createAvailability(): void {
    this.loading = true;
    this.error = null;

    this.storeService.createAvailability(this.createForm).subscribe({
      next: () => {
        this.closeCreateModal();
        this.loadAvailabilities();
      },
      error: (err) => {
        this.error = 'Failed to create availability';
        this.loading = false;
        console.error(err);
      },
    });
  }

  openEditModal(availability: Availability): void {
    this.selectedAvailability = availability;
    this.editForm = {
      dayOfWeek: availability.dayOfWeek,
      startTime: availability.startTime,
      endTime: availability.endTime,
      hourlyRate: availability.hourlyRate,
      serviceType: availability.serviceType,
      isActive: availability.isActive,
    };
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedAvailability = null;
    this.editForm = {};
  }

  updateAvailability(): void {
    if (!this.selectedAvailability) return;

    this.loading = true;
    this.error = null;

    this.storeService
      .updateAvailability(this.selectedAvailability.id, this.editForm)
      .subscribe({
        next: () => {
          this.closeEditModal();
          this.loadAvailabilities();
        },
        error: (err) => {
          this.error = 'Failed to update availability';
          this.loading = false;
          console.error(err);
        },
      });
  }

  deleteAvailability(availability: Availability): void {
    if (!confirm('Delete this availability slot?')) return;

    this.loading = true;
    this.error = null;

    this.storeService.deleteAvailability(availability.id).subscribe({
      next: () => {
        this.loadAvailabilities();
      },
      error: (err) => {
        this.error = 'Failed to delete availability';
        this.loading = false;
        console.error(err);
      },
    });
  }

  getDayLabel(dayOfWeek: number): string {
    const day = this.daysOfWeek.find((d) => d.value === dayOfWeek);
    return day ? day.label : 'Unknown';
  }

  formatTime(time: string): string {
    // Convert HH:MM:SS to HH:MM AM/PM
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }
}
