import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';

import { BusinessOwnerDashboardPageComponent } from './business-owner-dashboard-page.component';

describe('BusinessOwnerDashboardPageComponent', () => {
  it('uses aggregate owner data instead of a hard-coded client check-in query', async () => {
    const getAllCheckIns = jest.fn().mockReturnValue(of([{ id: 'checkin-1' }]));

    await TestBed.configureTestingModule({
      imports: [BusinessOwnerDashboardPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getOwnerBookings: jest.fn().mockReturnValue(
              of([
                { id: 'booking-1', status: 'pending' },
                { id: 'booking-2', status: 'completed' },
              ])
            ),
            getAllRoutines: jest
              .fn()
              .mockReturnValue(of([{ id: 'routine-1' }])),
            getAllCheckIns,
            getOwnerProspects: jest
              .fn()
              .mockReturnValue(of([{ id: 'lead-1' }])),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn().mockReturnValue({
              ...DEFAULT_BUSINESS_SITE_CONFIG,
              features: {
                ...DEFAULT_BUSINESS_SITE_CONFIG.features,
                clientTasks: {
                  enabled: true,
                  allowClientCompletion: true,
                },
              },
            }),
            fetch: jest.fn().mockReturnValue(of(DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      BusinessOwnerDashboardPageComponent
    );
    fixture.detectChanges();

    expect(getAllCheckIns).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Prospects');
    expect(fixture.nativeElement.textContent).toContain('Completed bookings');
  });
});
