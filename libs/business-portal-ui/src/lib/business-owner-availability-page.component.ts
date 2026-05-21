import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import {
  Availability,
  AvailabilityOverride,
  BusinessApiService,
  CreateAvailabilityDto,
} from '@optimistic-tanuki/business-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'business-owner-availability-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FullCalendarModule,
    ButtonComponent,
    CardComponent,
  ],
  template: `
    <section class="stack">
      <otui-card>
        <h2>Availability Calendar</h2>
        <full-calendar [options]="calendarOptions"></full-calendar>
      </otui-card>

      <div class="grid">
        <otui-card>
          <h2>Weekly availability</h2>
          <form class="form" (ngSubmit)="saveAvailability()">
            <label>
              Day of week
              <select
                [(ngModel)]="availabilityDraft.dayOfWeek"
                name="dayOfWeek"
              >
                @for (day of dayOptions; track day.value) {
                <option [ngValue]="day.value">{{ day.label }}</option>
                }
              </select>
            </label>
            <label>
              Start time
              <input
                [(ngModel)]="availabilityDraft.startTime"
                name="startTime"
                type="time"
              />
            </label>
            <label>
              End time
              <input
                [(ngModel)]="availabilityDraft.endTime"
                name="endTime"
                type="time"
              />
            </label>
            <label>
              Hourly rate
              <input
                [(ngModel)]="availabilityDraft.hourlyRate"
                name="hourlyRate"
                type="number"
                min="0"
              />
            </label>
            <label>
              Service type
              <input
                [(ngModel)]="availabilityDraft.serviceType"
                name="serviceType"
              />
            </label>
            <otui-button type="submit" variant="primary">
              {{
                editingAvailabilityId()
                  ? 'Update weekly slot'
                  : 'Add weekly slot'
              }}
            </otui-button>
          </form>

          <div class="list">
            @for (entry of availabilities(); track entry.id) {
            <div class="row">
              <div>
                <strong>{{ dayLabel(entry.dayOfWeek) }}</strong>
                <p>{{ availabilitySummary(entry) }}</p>
                <p>{{ entry.serviceType || 'General consultation' }}</p>
              </div>
              <div class="row-actions">
                <otui-button
                  variant="outlined"
                  (action)="startEditAvailability(entry)"
                >
                  Edit
                </otui-button>
                <otui-button
                  variant="outlined"
                  (action)="removeAvailability(entry.id)"
                >
                  Remove
                </otui-button>
              </div>
            </div>
            } @empty {
            <p class="empty">No weekly availability published yet.</p>
            }
          </div>
        </otui-card>

        <otui-card>
          <h2>Date overrides</h2>
          <form class="form" (ngSubmit)="saveOverride()">
            <label>
              Mode
              <select [(ngModel)]="overrideDraft.mode" name="mode">
                <option value="blocked">Blocked</option>
                <option value="available">Available</option>
              </select>
            </label>
            <label>
              Start
              <input
                [(ngModel)]="overrideDraft.startTime"
                name="overrideStart"
                type="datetime-local"
              />
            </label>
            <label>
              End
              <input
                [(ngModel)]="overrideDraft.endTime"
                name="overrideEnd"
                type="datetime-local"
              />
            </label>
            <label>
              Hourly rate
              <input
                [(ngModel)]="overrideDraft.hourlyRate"
                name="overrideRate"
                type="number"
                min="0"
              />
            </label>
            <label>
              Service type
              <input
                [(ngModel)]="overrideDraft.serviceType"
                name="overrideServiceType"
              />
            </label>
            <otui-button type="submit" variant="primary">
              {{ editingOverrideId() ? 'Update override' : 'Add override' }}
            </otui-button>
          </form>

          <div class="list">
            @for (entry of overrides(); track entry.id) {
            <div class="row">
              <div>
                <strong>{{ entry.mode | titlecase }}</strong>
                <p>
                  {{ entry.startTime | date : 'medium' }} -
                  {{ entry.endTime | date : 'medium' }}
                </p>
                <p>{{ entry.serviceType || 'General consultation' }}</p>
              </div>
              <div class="row-actions">
                <otui-button
                  variant="outlined"
                  (action)="startEditOverride(entry)"
                >
                  Edit
                </otui-button>
                <otui-button
                  variant="outlined"
                  (action)="removeOverride(entry.id)"
                >
                  Remove
                </otui-button>
              </div>
            </div>
            } @empty {
            <p class="empty">No date-specific overrides yet.</p>
            }
          </div>
        </otui-card>
      </div>
    </section>
  `,
  styles: [
    `
      .stack,
      .grid,
      .form,
      .list {
        display: grid;
        gap: 1rem;
      }
      .grid {
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-weight: 600;
      }
      input,
      select {
        font: inherit;
        padding: 0.75rem 0.9rem;
        border-radius: var(--personality-input-radius, 1rem);
        border: var(--personality-input-border-width, 1px) solid var(--border);
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding-top: 0.85rem;
        border-top: 1px solid var(--border);
      }
      .row-actions {
        display: flex;
        gap: 0.5rem;
      }
      .row:first-child {
        border-top: 0;
        padding-top: 0;
      }
      p,
      .empty {
        margin: 0.15rem 0 0;
        color: var(--muted);
      }
    `,
  ],
})
export class BusinessOwnerAvailabilityPageComponent {
  private readonly api = inject(BusinessApiService);

  readonly availabilities = signal<Availability[]>([]);
  readonly overrides = signal<AvailabilityOverride[]>([]);
  readonly editingAvailabilityId = signal<string | null>(null);
  readonly editingOverrideId = signal<string | null>(null);
  readonly dayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];
  readonly availabilityDraft: CreateAvailabilityDto = {
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    hourlyRate: 120,
    serviceType: 'Consultation',
    isActive: true,
  };
  readonly overrideDraft = {
    mode: 'blocked' as 'available' | 'blocked',
    startTime: '',
    endTime: '',
    hourlyRate: 120,
    serviceType: 'Consultation',
    isActive: true,
  };

  readonly calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek',
    },
    events: [],
  };

  constructor() {
    this.reload();
  }

  saveAvailability(): void {
    const payload = {
      ...this.availabilityDraft,
      startTime: this.normalizeTime(this.availabilityDraft.startTime),
      endTime: this.normalizeTime(this.availabilityDraft.endTime),
    };
    const request$ = this.editingAvailabilityId()
      ? this.api.updateOwnerAvailability(this.editingAvailabilityId()!, payload)
      : this.api.createOwnerAvailability(payload);

    request$.subscribe(() => {
      this.editingAvailabilityId.set(null);
      this.reload();
    });
  }

  removeAvailability(id: string): void {
    this.api.removeOwnerAvailability(id).subscribe(() => this.reload());
  }

  saveOverride(): void {
    const payload = {
      ...this.overrideDraft,
      startTime: new Date(this.overrideDraft.startTime).toISOString(),
      endTime: new Date(this.overrideDraft.endTime).toISOString(),
    };
    const request$ = this.editingOverrideId()
      ? this.api.updateOwnerAvailabilityOverride(
          this.editingOverrideId()!,
          payload
        )
      : this.api.createOwnerAvailabilityOverride(payload);

    request$.subscribe(() => {
      this.editingOverrideId.set(null);
      this.reload();
    });
  }

  removeOverride(id: string): void {
    this.api.removeOwnerAvailabilityOverride(id).subscribe(() => this.reload());
  }

  dayLabel(dayOfWeek: number): string {
    return (
      this.dayOptions.find((day) => day.value === dayOfWeek)?.label ?? 'Unknown'
    );
  }

  availabilitySummary(entry: Availability): string {
    return `${entry.startTime} - ${entry.endTime} | $${entry.hourlyRate}/hr`;
  }

  startEditAvailability(entry: Availability): void {
    this.editingAvailabilityId.set(entry.id);
    this.availabilityDraft.dayOfWeek = entry.dayOfWeek;
    this.availabilityDraft.startTime = entry.startTime.slice(0, 5);
    this.availabilityDraft.endTime = entry.endTime.slice(0, 5);
    this.availabilityDraft.hourlyRate = Number(entry.hourlyRate);
    this.availabilityDraft.serviceType = entry.serviceType || '';
    this.availabilityDraft.isActive = entry.isActive !== false;
  }

  startEditOverride(entry: AvailabilityOverride): void {
    this.editingOverrideId.set(entry.id);
    this.overrideDraft.mode = entry.mode;
    this.overrideDraft.startTime = this.toDateTimeLocal(entry.startTime);
    this.overrideDraft.endTime = this.toDateTimeLocal(entry.endTime);
    this.overrideDraft.hourlyRate = Number(entry.hourlyRate);
    this.overrideDraft.serviceType = entry.serviceType || '';
    this.overrideDraft.isActive = entry.isActive !== false;
  }

  private reload(): void {
    this.api.getOwnerAvailabilities().subscribe((availabilities) => {
      this.availabilities.set(availabilities);
      this.refreshCalendar();
    });
    this.api.getOwnerAvailabilityOverrides().subscribe((overrides) => {
      this.overrides.set(overrides);
      this.refreshCalendar();
    });
  }

  private refreshCalendar(): void {
    this.calendarOptions.events = [
      ...this.availabilities().map((entry) => ({
        id: entry.id,
        title: `${this.dayLabel(entry.dayOfWeek)} availability`,
        daysOfWeek: [String(entry.dayOfWeek)],
        startTime: entry.startTime,
        endTime: entry.endTime,
        backgroundColor: '#1f7a63',
        borderColor: '#1f7a63',
      })),
      ...this.overrides().map((entry) => ({
        id: entry.id,
        title:
          entry.mode === 'blocked' ? 'Blocked time' : 'Special availability',
        start: entry.startTime,
        end: entry.endTime,
        backgroundColor: entry.mode === 'blocked' ? '#b91c1c' : '#2563eb',
        borderColor: entry.mode === 'blocked' ? '#b91c1c' : '#2563eb',
      })),
    ];
  }

  private normalizeTime(value: string): string {
    return value.length === 5 ? `${value}:00` : value;
  }

  private toDateTimeLocal(value: string | Date): string {
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000)
      .toISOString()
      .slice(0, 16);
  }
}
