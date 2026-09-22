import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/finance-data-access';
import {
  FinCommanderGoal,
  FinCommanderPlan,
  FinCommanderScenario,
  FinCommanderCashFlowProjection,
  FinCommanderFundingDirective,
  FinCommanderFundingDirectivePreview,
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
  private readonly finance = inject(OptomisitcTanukiAPIService);

  async listPlans(scope: FinCommanderScope): Promise<FinCommanderPlan[]> {
    if (!scope) {
      return [];
    }
    return firstValueFrom(
      this.finance.financeControllerListFinCommanderPlans<FinCommanderPlan[]>()
    );
  }

  async createPlan(
    scope: FinCommanderScope,
    plan: FinCommanderPlan
  ): Promise<FinCommanderPlan> {
    if (!scope) {
      throw new Error('An active tenant scope is required to create a plan');
    }
    // Identity scope (userId/profileId/tenantId/appScope) is overlaid
    // server-side; the cast preserves the pass-through for the client
    // fields, as before.
    return firstValueFrom(
      this.finance.financeControllerCreateFinCommanderPlan<FinCommanderPlan>({
        name: plan.name,
        description: plan.description,
        defaultWorkspace: plan.defaultWorkspace,
      } as unknown as Parameters<typeof this.finance.financeControllerCreateFinCommanderPlan>[0])
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
      this.finance.financeControllerListFinCommanderGoals<FinCommanderGoal[]>(
        planId
      )
    );
  }

  async getCashFlowProjection(
    scope: FinCommanderScope,
    planId: string
  ): Promise<FinCommanderCashFlowProjection | null> {
    if (!scope || !planId) return null;
    return firstValueFrom(
      this.finance.financeControllerGetFinCommanderCashFlowProjection<FinCommanderCashFlowProjection>(
        planId
      )
    );
  }

  async saveGoal(
    scope: FinCommanderScope,
    goal: FinCommanderGoal
  ): Promise<FinCommanderGoal> {
    if (!scope) {
      throw new Error('An active tenant scope is required to save a goal');
    }
    return firstValueFrom(
      this.finance.financeControllerCreateFinCommanderGoal<FinCommanderGoal>(
        goal.planId,
        {
          name: goal.name,
          targetAmountCents: goal.targetAmountCents,
          currentAmountCents: goal.currentAmountCents,
          dueDate: goal.dueDate,
          strategy: goal.strategy,
          fundingAccountId: goal.fundingAccountId ?? undefined,
        } as unknown as Parameters<
          typeof this.finance.financeControllerCreateFinCommanderGoal
        >[1]
      )
    );
  }

  async deleteGoal(scope: FinCommanderScope, goalId: string): Promise<void> {
    if (!scope) {
      return;
    }
    await firstValueFrom(
      this.finance.financeControllerDeleteFinCommanderGoal<void>(goalId)
    );
  }

  async previewFundingDirective(
    scope: FinCommanderScope,
    goalId: string
  ): Promise<FinCommanderFundingDirectivePreview | null> {
    if (!scope || !goalId) return null;
    return firstValueFrom(
      this.finance.financeControllerPreviewFinCommanderFundingDirective<FinCommanderFundingDirectivePreview>(
        goalId
      )
    );
  }

  async approveFundingDirective(
    scope: FinCommanderScope,
    goalId: string
  ): Promise<FinCommanderFundingDirective> {
    if (!scope) throw new Error('An active tenant scope is required');
    return firstValueFrom(
      this.finance.financeControllerApproveFinCommanderFundingDirective<FinCommanderFundingDirective>(
        goalId
      )
    );
  }

  async cancelFundingDirective(
    scope: FinCommanderScope,
    goalId: string
  ): Promise<FinCommanderFundingDirective> {
    if (!scope) throw new Error('An active tenant scope is required');
    return firstValueFrom(
      this.finance.financeControllerCancelFinCommanderFundingDirective<FinCommanderFundingDirective>(
        goalId
      )
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
      this.finance.financeControllerListFinCommanderScenarios<
        FinCommanderScenario[]
      >(planId)
    );
  }

  async saveScenario(
    scope: FinCommanderScope,
    scenario: FinCommanderScenario
  ): Promise<FinCommanderScenario> {
    if (!scope) {
      throw new Error('An active tenant scope is required to save a scenario');
    }
    return firstValueFrom(
      this.finance.financeControllerCreateFinCommanderScenario<FinCommanderScenario>(
        scenario.planId,
        {
          name: scenario.name,
          summary: scenario.summary,
          assumptions: scenario.assumptions,
        } as unknown as Parameters<
          typeof this.finance.financeControllerCreateFinCommanderScenario
        >[1]
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
      this.finance.financeControllerDeleteFinCommanderScenario<void>(scenarioId)
    );
  }
}
