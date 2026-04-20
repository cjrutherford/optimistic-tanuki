import { Inject, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  FinanceService,
  FinanceWorkspace,
  FinanceWorkspaceSummary,
} from '@optimistic-tanuki/finance-ui';
import {
  FinCommanderGoal,
  FinCommanderOverview,
  FinCommanderPlan,
  FinCommanderScenario,
} from '../models/fin-commander.models';
import { FinCommanderScope } from '../models/fin-commander-scope.model';
import { FinCommanderPlanApiService } from './fin-commander-plan-api.service';

const PLANS_KEY = 'fin-commander.plans';
const GOALS_KEY = 'fin-commander.goals';
const SCENARIOS_KEY = 'fin-commander.scenarios';

const DEFAULT_PLANS: FinCommanderPlan[] = [];

const DEFAULT_GOALS: FinCommanderGoal[] = [
  {
    id: 'goal-emergency',
    planId: 'home-command',
    name: 'Emergency reserve',
    targetAmount: 18000,
    currentAmount: 9200,
    dueDate: '2026-11-01',
    strategy:
      'Route tax refunds and recurring surplus into the reserve account.',
  },
  {
    id: 'goal-runway',
    planId: 'studio-command',
    name: 'Ninety-day runway',
    targetAmount: 45000,
    currentAmount: 28600,
    dueDate: '2026-09-01',
    strategy:
      'Keep owner draws capped until the operating floor reaches target.',
  },
];

const DEFAULT_SCENARIOS: FinCommanderScenario[] = [
  {
    id: 'scenario-rate-shift',
    planId: 'home-command',
    name: 'Rate reset + daycare overlap',
    summary: 'Tests mortgage variability against a short-term childcare spike.',
    assumptions: [
      {
        id: 'assumption-1',
        label: 'Mortgage adjustment',
        delta: '+$280 / month',
        impactArea: 'spend',
      },
      {
        id: 'assumption-2',
        label: 'Side-income cushion',
        delta: '+$350 / month',
        impactArea: 'income',
      },
    ],
  },
];

@Injectable({
  providedIn: 'root',
})
export class FinCommanderPlanStore {
  private readonly financeService = inject(FinanceService);
  private readonly api = inject(FinCommanderPlanApiService);
  private readonly scope = signal<FinCommanderScope | null>(null);

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  setScope(scope: FinCommanderScope | null): void {
    this.scope.set(scope);
  }

  getScope(): FinCommanderScope | null {
    return this.scope();
  }

  async listPlansAsync(): Promise<FinCommanderPlan[]> {
    const scope = this.scope();
    if (!scope) {
      return [];
    }

    const plans = await this.api.listPlans(scope);
    return plans.length > 0 ? plans : this.listPlans();
  }

  listPlans(): FinCommanderPlan[] {
    return this.readCollection<FinCommanderPlan>(PLANS_KEY, DEFAULT_PLANS);
  }

  getPlan(planId: string): FinCommanderPlan | null {
    return this.listPlans().find((plan) => plan.id === planId) ?? null;
  }

  savePlan(plan: FinCommanderPlan): void {
    const plans = this.readCollection<FinCommanderPlan>(PLANS_KEY, []);
    const next = plans.filter((entry) => entry.id !== plan.id);
    next.push(plan);
    this.writeCollection(PLANS_KEY, next);
  }

  listGoals(planId: string): FinCommanderGoal[] {
    return this.readCollection<FinCommanderGoal>(GOALS_KEY, []).filter(
      (goal) => goal.planId === planId
    );
  }

  saveGoal(goal: FinCommanderGoal): void {
    const goals = this.readCollection<FinCommanderGoal>(GOALS_KEY, []);
    const next = goals.filter((entry) => entry.id !== goal.id);
    next.push(goal);
    this.writeCollection(GOALS_KEY, next);
  }

  deleteGoal(goalId: string): void {
    const goals = this.readCollection<FinCommanderGoal>(GOALS_KEY, []);
    this.writeCollection(
      GOALS_KEY,
      goals.filter((goal) => goal.id !== goalId)
    );
  }

  listScenarios(planId: string): FinCommanderScenario[] {
    return this.readCollection<FinCommanderScenario>(SCENARIOS_KEY, []).filter(
      (scenario) => scenario.planId === planId
    );
  }

  saveScenario(scenario: FinCommanderScenario): void {
    const scenarios = this.readCollection<FinCommanderScenario>(
      SCENARIOS_KEY,
      []
    );
    const next = scenarios.filter((entry) => entry.id !== scenario.id);
    next.push(scenario);
    this.writeCollection(SCENARIOS_KEY, next);
  }

  deleteScenario(scenarioId: string): void {
    const scenarios = this.readCollection<FinCommanderScenario>(
      SCENARIOS_KEY,
      []
    );
    this.writeCollection(
      SCENARIOS_KEY,
      scenarios.filter((scenario) => scenario.id !== scenarioId)
    );
  }

  async buildOverview(planId: string): Promise<FinCommanderOverview> {
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }
    const goals = this.listGoals(planId);
    const scenarios = this.listScenarios(planId);
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

  private readCollection<T>(key: string, fallback: T[]): T[] {
    const scope = this.scope();
    if (!isPlatformBrowser(this.platformId) || !scope) {
      return [];
    }

    try {
      const value = localStorage.getItem(this.storageKey(key, scope));
      return value ? (JSON.parse(value) as T[]) : fallback;
    } catch {
      return fallback;
    }
  }

  private writeCollection<T>(key: string, value: T[]): void {
    const scope = this.scope();
    if (!isPlatformBrowser(this.platformId) || !scope) {
      return;
    }

    localStorage.setItem(this.storageKey(key, scope), JSON.stringify(value));
  }

  private storageKey(key: string, scope: FinCommanderScope): string {
    return `${key}.${scope.tenantId}.${scope.profileId}`;
  }
}
