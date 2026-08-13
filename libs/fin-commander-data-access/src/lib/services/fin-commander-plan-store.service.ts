import { Injectable, inject, signal } from '@angular/core';
import {
  FinanceService,
  FinanceWorkspace,
  FinanceWorkspaceSummary,
} from '@optimistic-tanuki/finance-ui';
import {
  FinCommanderGoal,
  FinCommanderFundingDirective,
  FinCommanderFundingDirectivePreview,
  FinCommanderOverview,
  FinCommanderPlan,
  FinCommanderScenario,
} from '../models/fin-commander.models';
import { FinCommanderScope } from '../models/fin-commander-scope.model';
import { FinCommanderPlanApiService } from './fin-commander-plan-api.service';

@Injectable({
  providedIn: 'root',
})
export class FinCommanderPlanStore {
  private readonly financeService = inject(FinanceService);
  private readonly api = inject(FinCommanderPlanApiService);
  private readonly scope = signal<FinCommanderScope | null>(null);
  private readonly plans = signal<FinCommanderPlan[]>([]);
  private readonly goals = signal<FinCommanderGoal[]>([]);
  private readonly scenarios = signal<FinCommanderScenario[]>([]);

  setScope(scope: FinCommanderScope | null): void {
    this.scope.set(scope);
    this.plans.set([]);
    this.goals.set([]);
    this.scenarios.set([]);
    if (scope) {
      void this.refreshPlans();
    }
  }

  getScope(): FinCommanderScope | null {
    return this.scope();
  }

  async refreshPlans(): Promise<FinCommanderPlan[]> {
    const scope = this.scope();
    if (!scope) {
      return [];
    }

    const plans = await this.api.listPlans(scope);
    if (this.hasScope(scope)) {
      this.plans.set(plans);
    }
    return plans;
  }

  listPlans(): FinCommanderPlan[] {
    return this.plans();
  }

  getPlan(planId: string): FinCommanderPlan | null {
    return this.listPlans().find((plan) => plan.id === planId) ?? null;
  }

  async savePlan(plan: FinCommanderPlan): Promise<FinCommanderPlan> {
    const scope = this.requireScope();
    const persisted = await this.api.createPlan(scope, plan);
    if (this.hasScope(scope)) {
      this.plans.update((plans) => this.upsert(plans, persisted));
    }
    return persisted;
  }

  listGoals(planId: string): FinCommanderGoal[] {
    return this.goals().filter((goal) => goal.planId === planId);
  }

  async refreshGoals(planId: string): Promise<FinCommanderGoal[]> {
    const scope = this.scope();
    if (!scope || !planId) {
      return [];
    }
    const goals = await this.api.listGoals(scope, planId);
    if (this.hasScope(scope)) {
      this.goals.update((current) => [
        ...current.filter((goal) => goal.planId !== planId),
        ...goals,
      ]);
    }
    return goals;
  }

  async saveGoal(goal: FinCommanderGoal): Promise<FinCommanderGoal> {
    const scope = this.requireScope();
    const persisted = await this.api.saveGoal(scope, goal);
    if (this.hasScope(scope)) {
      this.goals.update((goals) => this.upsert(goals, persisted));
    }
    return persisted;
  }

  async deleteGoal(goalId: string): Promise<void> {
    const scope = this.requireScope();
    await this.api.deleteGoal(scope, goalId);
    if (this.hasScope(scope)) {
      this.goals.update((goals) => goals.filter((goal) => goal.id !== goalId));
    }
  }

  async previewFundingDirective(
    goalId: string
  ): Promise<FinCommanderFundingDirectivePreview | null> {
    return this.api.previewFundingDirective(this.requireScope(), goalId);
  }

  async approveFundingDirective(
    goalId: string
  ): Promise<FinCommanderFundingDirective> {
    return this.api.approveFundingDirective(this.requireScope(), goalId);
  }

  async cancelFundingDirective(
    goalId: string
  ): Promise<FinCommanderFundingDirective> {
    return this.api.cancelFundingDirective(this.requireScope(), goalId);
  }

  listScenarios(planId: string): FinCommanderScenario[] {
    return this.scenarios().filter((scenario) => scenario.planId === planId);
  }

  async refreshScenarios(planId: string): Promise<FinCommanderScenario[]> {
    const scope = this.scope();
    if (!scope || !planId) {
      return [];
    }
    const scenarios = await this.api.listScenarios(scope, planId);
    if (this.hasScope(scope)) {
      this.scenarios.update((current) => [
        ...current.filter((scenario) => scenario.planId !== planId),
        ...scenarios,
      ]);
    }
    return scenarios;
  }

  async saveScenario(
    scenario: FinCommanderScenario
  ): Promise<FinCommanderScenario> {
    const scope = this.requireScope();
    const persisted = await this.api.saveScenario(scope, scenario);
    if (this.hasScope(scope)) {
      this.scenarios.update((scenarios) => this.upsert(scenarios, persisted));
    }
    return persisted;
  }

  async deleteScenario(scenarioId: string): Promise<void> {
    const scope = this.requireScope();
    await this.api.deleteScenario(scope, scenarioId);
    if (this.hasScope(scope)) {
      this.scenarios.update((scenarios) =>
        scenarios.filter((scenario) => scenario.id !== scenarioId)
      );
    }
  }

  async buildOverview(planId: string): Promise<FinCommanderOverview> {
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }
    const [goals, scenarios] = await Promise.all([
      this.refreshGoals(planId),
      this.refreshScenarios(planId),
    ]);
    const workspaces = await Promise.all(
      (['personal', 'business', 'net-worth'] as FinanceWorkspace[]).map(
        async (workspace) => {
          try {
            const summary = await this.financeService.getWorkspaceSummary(
              workspace
            );
            return { workspace, summary, available: true };
          } catch {
            return {
              workspace,
              summary: null as FinanceWorkspaceSummary | null,
              available: false,
            };
          }
        }
      )
    );

    return { plan, goals, scenarios, workspaces };
  }

  private requireScope(): FinCommanderScope {
    const scope = this.scope();
    if (!scope) {
      throw new Error(
        'An active tenant scope is required for planning changes'
      );
    }
    return scope;
  }

  private hasScope(scope: FinCommanderScope): boolean {
    const active = this.scope();
    return (
      active?.tenantId === scope.tenantId &&
      active.profileId === scope.profileId
    );
  }

  private upsert<T extends { id: string }>(items: T[], item: T): T[] {
    return [...items.filter((entry) => entry.id !== item.id), item];
  }
}
