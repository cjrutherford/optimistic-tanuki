import { signal } from '@angular/core';
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

import { BusinessClientPortalHomePageComponent } from './business-client-portal-home-page.component';

describe('BusinessClientPortalHomePageComponent', () => {
  async function render(
    status: Record<string, unknown> = {
      accepted: false,
      hasAccount: true,
      stage: 'lead_under_review',
      nextAction:
        'Your request is under review. The business will follow up before booking opens.',
      primaryAction: 'await_review',
    }
  ) {
    const clientUser = signal({
      profileId: 'client-profile-1',
      userId: 'client-user-1',
    });
    const auth = {
      clientUser,
    };
    const api = {
      getClientBookingStatus: jest.fn().mockReturnValue(of(status)),
    };

    await TestBed.configureTestingModule({
      imports: [BusinessClientPortalHomePageComponent],
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
          provide: BusinessSiteConfigStore,
          useValue: {
            site: signal(DEFAULT_BUSINESS_SITE_CONFIG).asReadonly(),
            fetch: jest.fn().mockReturnValue(of(DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
        {
          provide: BusinessApiService,
          useValue: api,
        },
        {
          provide: BusinessAuthService,
          useValue: auth,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      BusinessClientPortalHomePageComponent
    );
    fixture.detectChanges();
    return { fixture, api, auth, clientUser };
  }

  it('keeps the hosted tenant slug in client portal home actions', async () => {
    const { fixture } = await render();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink).href);

    expect(links).toContain('/sites/steady-hand-contracting/client/dashboard');
    expect(links).toContain('/sites/steady-hand-contracting/book');
  });

  it('shows consultation wording while the client is still under review', async () => {
    const { fixture } = await render();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Request consultation');
    expect(text).toContain(
      'Your request is under review. The business will follow up before booking opens.'
    );
  });

  it('shows booking wording once the client is accepted', async () => {
    const { fixture } = await render({
      accepted: true,
      hasAccount: true,
      stage: 'accepted_client',
      nextAction: 'Choose a published time to request your next session.',
      primaryAction: 'book_session',
    });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Book session');
    expect(text).toContain(
      'Choose a published time to request your next session.'
    );
  });

  it('refreshes status wording when the client auth signal changes', async () => {
    const acceptedStatus = {
      accepted: true,
      hasAccount: true,
      stage: 'accepted_client',
      nextAction: 'Choose a published time to request your next session.',
      primaryAction: 'book_session',
    };
    const { fixture, api, clientUser } = await render();

    clientUser.set({
      profileId: 'client-profile-2',
      userId: 'client-user-2',
    });
    api.getClientBookingStatus.mockReturnValueOnce(of(acceptedStatus));

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Book session');
    expect(text).toContain(
      'Choose a published time to request your next session.'
    );
  });
});
