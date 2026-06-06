import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { OnboardingComponent } from './onboarding.component';
import { FINANCE_HOST_CONFIG } from '../finance.routes';

describe('OnboardingComponent', () => {
  it('renders the configured host onboarding link without forcing navigation', async () => {
    const navigateByUrl = jest.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            navigateByUrl,
          },
        },
        {
          provide: FINANCE_HOST_CONFIG,
          useValue: {
            routeBase: '/owner/finance',
            shellTitle: 'Owner Finance',
            defaultWorkspace: 'business',
            onboardingRoute: '/owner/finance/onboarding',
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.detectChanges();

    const link: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('a.primary');

    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(link?.getAttribute('href')).toBe('/owner/finance/onboarding');
  });
});
