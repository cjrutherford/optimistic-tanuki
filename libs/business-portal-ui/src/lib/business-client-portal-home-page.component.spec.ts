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
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';

import { BusinessClientPortalHomePageComponent } from './business-client-portal-home-page.component';

describe('BusinessClientPortalHomePageComponent', () => {
  it('keeps the hosted tenant slug in client portal home actions', async () => {
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
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      BusinessClientPortalHomePageComponent
    );
    fixture.detectChanges();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink).href);

    expect(links).toContain('/sites/steady-hand-contracting/client/dashboard');
    expect(links).toContain('/sites/steady-hand-contracting/book');
  });
});
