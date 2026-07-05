import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AppointmentManagementComponent } from './appointment-management.component';
import { StoreService } from '../services/store.service';

describe('AppointmentManagementComponent', () => {
  const storeService = {
    getAppointments: jest.fn(),
    approveAppointment: jest.fn(),
    denyAppointment: jest.fn(),
    completeAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
    generateInvoice: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    storeService.getAppointments.mockReturnValue(
      of([
        {
          id: 'appt-1',
          title: 'Discovery Session',
          userId: 'user-1',
          startTime: new Date('2026-07-05T10:00:00.000Z'),
          endTime: new Date('2026-07-05T11:00:00.000Z'),
          status: 'pending',
          isFreeConsultation: false,
          totalCost: 120,
        },
      ])
    );

    await TestBed.configureTestingModule({
      imports: [AppointmentManagementComponent],
      providers: [
        provideRouter([]),
        { provide: StoreService, useValue: storeService },
      ],
    }).compileComponents();
  });

  it('renders appointments through the shared ag-grid table', () => {
    const fixture = TestBed.createComponent(AppointmentManagementComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('otui-ag-grid')).toBeTruthy();
  });
});
