import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BusinessApiService } from '@optimistic-tanuki/business-data-access';

import {
  businessPlatformHomePageStyles,
  BusinessPlatformHomePageComponent,
} from './business-platform-home-page.component';

describe('BusinessPlatformHomePageComponent', () => {
  async function render() {
    await TestBed.configureTestingModule({
      imports: [BusinessPlatformHomePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessApiService,
          useValue: {
            listPublishedSites: jest.fn().mockReturnValue(of([])),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessPlatformHomePageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders platform messaging for owners and clients', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Hosted business connection services');
    expect(text).toContain('Start as an owner');
    expect(text).toContain('Client account');
    expect(text).toContain('Profile-to-site onboarding');
    expect(text).toContain('Live WYSIWYG composition');
    expect(text).toContain('Tenant-scoped public experiences');
  });

  it('links the primary platform actions to auth and client registration', async () => {
    const fixture = await render();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));

    expect(links.map((link) => link.href)).toEqual(
      expect.arrayContaining(['/auth', '/client/register'])
    );
  });

  it('defines explicit light-mode contrast overrides for landing-page legibility', async () => {
    expect(businessPlatformHomePageStyles).toContain(
      ":host-context([data-mode='light'])"
    );
    expect(businessPlatformHomePageStyles).toContain(
      '--platform-muted: #425466'
    );
    expect(businessPlatformHomePageStyles).toContain(
      '--platform-card: #ffffff'
    );
  });
});
