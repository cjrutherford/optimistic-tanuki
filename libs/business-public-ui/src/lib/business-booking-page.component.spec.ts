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
    } = {}
  ) {
    const offers = options.offers ?? [];
    const api = {
      getOffers: jest.fn().mockReturnValue(of(offers)),
      getAvailabilities: jest.fn().mockReturnValue(of([])),
      getAvailabilityOverrides: jest.fn().mockReturnValue(of([])),
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
      createBooking: jest.fn(),
      createLeadIntake: jest.fn(),
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
});
