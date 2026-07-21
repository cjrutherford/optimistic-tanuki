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
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';

import {
  businessBookingPageStyles,
  BusinessBookingPageComponent,
} from './business-booking-page.component';

describe('BusinessBookingPageComponent', () => {
  async function render(
    options: {
      offers?: Array<{
        id: string;
        label: string;
        allowOnlineBooking?: boolean;
      }>;
      isAuthenticated?: boolean;
      clientUser?: {
        userId: string;
        profileId: string;
        email: string;
        name?: string;
      } | null;
      status?: Record<string, unknown>;
      availabilities?: Array<{
        id: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        isActive?: boolean;
        serviceType?: string;
      }>;
      overrides?: Array<{
        id: string;
        startTime: string;
        endTime: string;
        mode: 'available' | 'blocked';
        serviceType?: string;
        isActive?: boolean;
      }>;
    } = {}
  ) {
    const offers = options.offers ?? [];
    const availabilities = options.availabilities ?? [];
    const overrides = options.overrides ?? [];
    const api = {
      getOffers: jest.fn().mockReturnValue(of(offers)),
      getAvailabilities: jest.fn().mockReturnValue(of(availabilities)),
      getAvailabilityOverrides: jest.fn().mockReturnValue(of(overrides)),
      getBusyWindows: jest.fn().mockReturnValue(of([])),
      getClientBookingStatus: jest.fn().mockReturnValue(
        of(
          options.status ?? {
            accepted: false,
            hasAccount: false,
            stage: 'new_lead',
            nextAction:
              'Share your goals to request a consultation and start the review process.',
            primaryAction: 'request_consultation',
          }
        )
      ),
      createBooking: jest.fn().mockReturnValue(of({ id: 'booking-1' })),
      createLeadIntake: jest.fn().mockReturnValue(of({ id: 'lead-1' })),
    };

    await TestBed.configureTestingModule({
      imports: [BusinessBookingPageComponent],
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
            paramMap: of(
              convertToParamMap({ siteSlug: 'steady-hand-contracting' })
            ),
          },
        },
        {
          provide: BusinessApiService,
          useValue: api,
        },
        {
          provide: BusinessAuthService,
          useValue: {
            isClientAuthenticated: jest.fn(
              () => options.isAuthenticated ?? false
            ),
            clientUser: jest.fn(() => options.clientUser ?? null),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => DEFAULT_BUSINESS_SITE_CONFIG),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessBookingPageComponent);
    fixture.detectChanges();

    return { fixture, api };
  }

  it('loads offers and availability using the hosted tenant slug from the route', async () => {
    const { api } = await render();

    expect(api.getOffers).toHaveBeenCalledWith('steady-hand-contracting');
    expect(api.getAvailabilities).toHaveBeenCalledWith(
      'steady-hand-contracting'
    );
    expect(api.getAvailabilityOverrides).toHaveBeenCalledWith(
      'steady-hand-contracting'
    );
    expect(api.getBusyWindows).toHaveBeenCalledWith('steady-hand-contracting');
  });

  it('hides the requested offer selector when the business has no offers', async () => {
    const { fixture } = await render();
    const text = fixture.nativeElement.textContent as string;

    expect(text).not.toContain('Requested offer');
  });

  it('defines explicit theme-aware booking page styling with light and dark mode overrides', () => {
    expect(businessBookingPageStyles).toContain(
      ":host-context([data-mode='dark'])"
    );
    expect(businessBookingPageStyles).toContain(
      ":host-context([data-mode='light'])"
    );
    expect(businessBookingPageStyles).toContain('--booking-copy-ink');
    expect(businessBookingPageStyles).toContain('--booking-form-surface');
  });

  it('keeps the hosted tenant slug in the create-account link', async () => {
    const { fixture } = await render();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));
    const createAccountLink = links.find((link) =>
      (link.href ?? '').includes('/client/register')
    );

    expect(createAccountLink?.href).toBe(
      '/sites/steady-hand-contracting/client/register'
    );
  });

  it('shows consultation request messaging for new visitors who are not accepted clients', async () => {
    const { fixture } = await render();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Request consultation');
    expect(text).toContain('Share your goals to request a consultation');
    expect(text).toContain('Create account');
    expect(text).not.toContain('Book session');
  });

  it('shows booking messaging for accepted clients and removes the create-account prompt', async () => {
    const { fixture, api } = await render({
      isAuthenticated: true,
      clientUser: {
        userId: 'client-user-1',
        profileId: 'client-profile-1',
        email: 'client@example.com',
        name: 'Client Example',
      },
      status: {
        accepted: true,
        hasAccount: true,
        stage: 'accepted_client',
        nextAction: 'Choose a published time to request your next session.',
        primaryAction: 'book_session',
      },
    });
    const text = fixture.nativeElement.textContent as string;

    expect(api.getClientBookingStatus).toHaveBeenCalled();
    expect(text).toContain('Book session');
    expect(text).toContain(
      'Choose a published time to request your next session.'
    );
    expect(text).not.toContain('Create account');
  });

  it('uses the client goal as the booking title before falling back to the offer label', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { fixture, api } = await render({
      offers: [
        {
          id: 'offer-1',
          label: 'Strategy Intensive',
        },
      ],
      availabilities: [
        {
          id: 'availability-1',
          dayOfWeek: tomorrow.getDay(),
          startTime: '09:00:00',
          endTime: '11:00:00',
          isActive: true,
          serviceType: 'Consultation',
        },
      ],
      isAuthenticated: true,
      clientUser: {
        userId: 'client-user-1',
        profileId: 'client-profile-1',
        email: 'client@example.com',
        name: 'Client Example',
      },
      status: {
        accepted: true,
        hasAccount: true,
        stage: 'accepted_client',
        nextAction: 'Choose a published time to request your next session.',
        primaryAction: 'book_session',
      },
    });
    const component = fixture.componentInstance;

    component.form.goal = 'Quarterly planning reset';
    component.form.context =
      'Needs a full planning review before the next sprint.';
    component.submit();

    expect(api.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Quarterly planning reset',
      })
    );
  });

  it('surfaces available override windows as bookable slots', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);

    const { fixture } = await render({
      overrides: [
        {
          id: 'override-1',
          startTime: tomorrow.toISOString(),
          endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
          mode: 'available',
          serviceType: 'After-hours consultation',
          isActive: true,
        },
      ],
    });

    fixture.detectChanges();

    const optionLabels = Array.from(
      fixture.nativeElement.querySelectorAll(
        'select[name="selectedSlotKey"] option'
      ) as NodeListOf<HTMLOptionElement>
    ).map((option) => option.textContent?.trim() ?? '');

    expect(optionLabels.some((label) => label.includes('6:00 PM'))).toBe(true);
  });
});
