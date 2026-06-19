import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  RouterLink,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
} from '@optimistic-tanuki/business-data-access';

import { BusinessClientDashboardPageComponent } from './business-client-dashboard-page.component';

describe('BusinessClientDashboardPageComponent', () => {
  async function render(clientTasksEnabled: boolean) {
    const api = {
      getClientBookings: jest.fn().mockReturnValue(of([{ id: 'booking-1' }])),
      getClientRoutines: jest.fn().mockReturnValue(of([{ id: 'routine-1' }])),
      getClientCheckIns: jest.fn().mockReturnValue(of([{ id: 'checkin-1' }])),
      listPublishedSites: jest.fn().mockReturnValue(
        of([
          {
            slug: 'steady-hand-contracting',
            businessName: 'Steady Hand Contracting',
            tagline: 'Repairs and maintenance',
            location: 'Raleigh, NC',
            businessType: 'home-services',
          },
          {
            slug: 'emberline-studio',
            businessName: 'Emberline Studio',
            tagline: 'Custom illustration and commissions',
            location: 'Remote',
            businessType: 'creative',
          },
        ])
      ),
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
    };

    await TestBed.configureTestingModule({
      imports: [BusinessClientDashboardPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
            },
          },
        },
        {
          provide: BusinessApiService,
          useValue: api,
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
    return { fixture, api };
  }

  it('hides routine and check-in stats when client tasks are disabled', async () => {
    const { fixture } = await render(false);
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Upcoming sessions');
    expect(text).not.toContain('Assigned routines');
    expect(text).not.toContain('Recent check-ins');
  });

  it('requests client dashboard data using the hosted tenant slug', async () => {
    const { api } = await render(true);

    expect(api.getClientBookings).toHaveBeenCalledWith(
      'steady-hand-contracting'
    );
    expect(api.getClientRoutines).toHaveBeenCalledWith(
      'client-user-1',
      'steady-hand-contracting'
    );
    expect(api.getClientCheckIns).toHaveBeenCalledWith(
      'client-user-1',
      'steady-hand-contracting'
    );
  });

  it('shows a hosted booking action and additional businesses for the client', async () => {
    const { fixture } = await render(true);

    const text = fixture.nativeElement.textContent as string;
    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink).href);

    expect(links).toContain('/sites/steady-hand-contracting/book');
    expect(text).toContain('Emberline Studio');
  });
});
