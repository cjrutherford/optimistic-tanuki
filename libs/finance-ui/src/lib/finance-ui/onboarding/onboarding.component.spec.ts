import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { OnboardingComponent } from './onboarding.component';
import { FinanceService } from '../services/finance.service';

describe('Finance UI OnboardingComponent', () => {
  it('redirects finance onboarding into the app onboarding flow', async () => {
    const navigateByUrl = jest.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        {
          provide: FinanceService,
          useValue: {
            bootstrapWorkspaces: jest.fn(),
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/onboarding');
  });
});
