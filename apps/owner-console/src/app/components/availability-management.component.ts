import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../services/store.service';
import { AuthService } from '../services/auth.service';
import {
  Availability,
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
} from '@optimistic-tanuki/ui-models';
import { AgGridUiComponent, ColDef } from '@optimistic-tanuki/ag-grid-ui';
import { CommerceWorkspaceNavComponent } from './commerce-workspace-nav.component';

@Component({
  selector: 'app-availability-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridUiComponent,
    CommerceWorkspaceNavComponent,
  ],
  templateUrl: './availability-management.component.html',
  styleUrls: ['./availability-management.component.scss'],
})
export class AvailabilityManagementComponent implements OnInit {
  availabilities: Availability[] = [];
  loading = false;
  error: string | null = null;
  showCreateModal = false;
  showEditModal = false;
  selectedAvailability: Availability | null = null;
  gridHeight = '520px';

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

  constructor(
    private storeService: StoreService,
    private authService: AuthService
  ) {}

  columnDefs: ColDef[] = [
    {
      field: 'dayOfWeek',
      headerName: 'Day of Week',
      minWidth: 150,
      valueFormatter: (params) => this.getDayLabel(params.value),
    },
    {
      field: 'startTime',
      headerName: 'Start Time',
      minWidth: 140,
      valueFormatter: (params) => this.formatTime(params.value),
    },
    {
      field: 'endTime',
      headerName: 'End Time',
      minWidth: 140,
      valueFormatter: (params) => this.formatTime(params.value),
    },
    {
      field: 'hourlyRate',
      headerName: 'Hourly Rate',
      minWidth: 130,
      valueFormatter: (params) => `$${Number(params.value ?? 0).toFixed(2)}/hr`,
    },
    { field: 'serviceType', headerName: 'Service Type', minWidth: 150 },
    {
      field: 'isActive',
      headerName: 'Status',
      minWidth: 120,
      valueFormatter: (params) => (params.value ? 'Active' : 'Inactive'),
    },
    {
      headerName: 'Actions',
      minWidth: 180,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '8px';

        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.className = 'ag-grid-action-button';
        editButton.addEventListener('click', () =>
          this.openEditModal(params.data as Availability)
        );
        container.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'ag-grid-action-button ag-grid-delete-button';
        deleteButton.addEventListener('click', () =>
          this.deleteAvailability(params.data as Availability)
        );
        container.appendChild(deleteButton);

        return container;
      },
    },
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

  get gridAvailabilities(): Availability[] {
    return this.availabilities;
  }

  openCreateModal(): void {
    const ownerId = this.getOwnerIdFromToken();
    if (!ownerId) {
      this.error =
        'Unable to determine operator identity for availability creation.';
      this.showCreateModal = false;
      return;
    }

    this.createForm = {
      ownerId,
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

  private getOwnerIdFromToken(): string | null {
    const token = this.authService.getToken();
    if (!token) return null;

    const [, payload] = token.split('.');
    if (!payload) return null;
    if (typeof atob !== 'function') return null;

    try {
      const decodedPayload = atob(
        payload.replace(/-/g, '+').replace(/_/g, '/')
      );
      const parsed = JSON.parse(decodedPayload) as { userId?: string };
      return parsed.userId || null;
    } catch {
      return null;
    }
  }
}
