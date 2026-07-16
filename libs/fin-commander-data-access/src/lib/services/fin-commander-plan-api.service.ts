import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  FinCommanderGoal,
  FinCommanderPlan,
  FinCommanderScenario,
} from '../models/fin-commander.models';
import { FinCommanderScope } from '../models/fin-commander-scope.model';

/**
 * Talks to the gateway Fin Commander endpoints. The authenticated tenant/profile
 * scope is derived server-side from the bearer token and the
 * `x-finance-tenant-id` header (attached by the app's finance interceptor), so
 * the client-side {@link FinCommanderScope} is only used to gate requests when a
 * scope is active — it is never trusted by the backend for identity.
 *
 * All money fields are integer cents end-to-end, matching the cents-native
 * finance backend entities.
 */
@Injectable({
  providedIn: 'root',
})
export class FinCommanderPlanApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/finance/fin-commander';

  async listPlans(scope: FinCommanderScope): Promise<FinCommanderPlan[]> {
    if (!scope) {
      return [];
    }
    return firstValueFrom(
      this.http.get<FinCommanderPlan[]>(`${this.baseUrl}/plans`)
    );
  }

  async listGoals(
    scope: FinCommanderScope,
    planId: string
  ): Promise<FinCommanderGoal[]> {
    if (!scope || !planId) {
      return [];
    }
    return firstValueFrom(
      this.http.get<FinCommanderGoal[]>(`${this.baseUrl}/plan/${planId}/goals`)
    );
  }

  async saveGoal(
    scope: FinCommanderScope,
    goal: FinCommanderGoal
  ): Promise<void> {
    if (!scope) {
      return;
    }
    await firstValueFrom(
      this.http.post<FinCommanderGoal>(
        `${this.baseUrl}/plan/${goal.planId}/goal`,
        {
          name: goal.name,
          targetAmountCents: goal.targetAmountCents,
          currentAmountCents: goal.currentAmountCents,
          dueDate: goal.dueDate,
          strategy: goal.strategy,
        }
      )
    );
  }

  async deleteGoal(scope: FinCommanderScope, goalId: string): Promise<void> {
    if (!scope) {
      return;
    }
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/goal/${goalId}`)
    );
  }

  async listScenarios(
    scope: FinCommanderScope,
    planId: string
  ): Promise<FinCommanderScenario[]> {
    if (!scope || !planId) {
      return [];
    }
    return firstValueFrom(
      this.http.get<FinCommanderScenario[]>(
        `${this.baseUrl}/plan/${planId}/scenarios`
      )
    );
  }

  async saveScenario(
    scope: FinCommanderScope,
    scenario: FinCommanderScenario
  ): Promise<void> {
    if (!scope) {
      return;
    }
    await firstValueFrom(
      this.http.post<FinCommanderScenario>(
        `${this.baseUrl}/plan/${scenario.planId}/scenario`,
        {
          name: scenario.name,
          summary: scenario.summary,
          assumptions: scenario.assumptions,
        }
      )
    );
  }

  async deleteScenario(
    scope: FinCommanderScope,
    scenarioId: string
  ): Promise<void> {
    if (!scope) {
      return;
    }
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/scenario/${scenarioId}`)
    );
  }
}
