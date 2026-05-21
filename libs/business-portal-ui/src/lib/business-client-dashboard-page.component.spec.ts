import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
} from '@optimistic-tanuki/business-data-access';

import { BusinessClientDashboardPageComponent } from './business-client-dashboard-page.component';

describe('BusinessClientDashboardPageComponent', () => {
  async function render(clientTasksEnabled: boolean) {
    await TestBed.configureTestingModule({
      imports: [BusinessClientDashboardPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getClientBookings: jest
              .fn()
              .mockReturnValue(of([{ id: 'booking-1' }])),
            getClientRoutines: jest
              .fn()
              .mockReturnValue(of([{ id: 'routine-1' }])),
            getClientCheckIns: jest
              .fn()
              .mockReturnValue(of([{ id: 'checkin-1' }])),
            getSiteConfig: jest.fn().mockReturnValue(
              of({
                configId: 'config-1',
                config: {
                  features: {
                    clientTasks: {
                      enabled: clientTasksEnabled,
                      allowClientCompletion: false,
                    },
                  },
                },
              })
            ),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: {
            clientUser: jest.fn().mockReturnValue({
              profileId: 'client-profile-1',
              userId: 'client-user-1',
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      BusinessClientDashboardPageComponent
    );
    fixture.detectChanges();
    return fixture;
  }

  it('hides routine and check-in stats when client tasks are disabled', async () => {
    const fixture = await render(false);
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Upcoming sessions');
    expect(text).not.toContain('Assigned routines');
    expect(text).not.toContain('Recent check-ins');
  });
});
