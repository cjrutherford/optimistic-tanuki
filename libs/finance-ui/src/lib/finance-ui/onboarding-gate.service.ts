import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { FinanceOnboardingState } from '@optimistic-tanuki/finance-data-access';
import { FinanceService } from '@optimistic-tanuki/finance-data-access';

@Injectable({
  providedIn: 'root',
})
export class OnboardingGateService {
  private readonly financeService: FinanceService;

  constructor(financeService?: FinanceService) {
    this.financeService = financeService ?? inject(FinanceService);
  }

  getState(_refresh = false): Observable<FinanceOnboardingState> {
    return from(this.financeService.getOnboardingState());
  }
}
