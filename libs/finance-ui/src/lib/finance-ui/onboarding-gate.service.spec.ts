import { of } from 'rxjs';
import { OnboardingGateService } from './onboarding-gate.service';
import { FinanceService } from './services/finance.service';

describe('OnboardingGateService', () => {
  it('requires onboarding when finance setup is incomplete', (done) => {
    const financeService = {
      getOnboardingState: jest.fn().mockReturnValue(
        Promise.resolve({
          requiresOnboarding: true,
          availableWorkspaces: [],
        })
      ),
    };

    const service = new OnboardingGateService(
      financeService as unknown as FinanceService
    );

    service.getState(true).subscribe((state: any) => {
      expect(state.requiresOnboarding).toBe(true);
      done();
    });
  });
});
