import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { FinanceOnboardingState } from './models';
import { FinanceService } from './services/finance.service';

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
