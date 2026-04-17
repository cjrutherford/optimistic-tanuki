import { Injectable } from '@angular/core';
import {
  FinCommanderGoal,
  FinCommanderPlan,
  FinCommanderScenario,
} from '../models/fin-commander.models';
import { FinCommanderScope } from '../models/fin-commander-scope.model';

@Injectable({
  providedIn: 'root',
})
export class FinCommanderPlanApiService {
  async listPlans(_scope: FinCommanderScope): Promise<FinCommanderPlan[]> {
    return [];
  }

  async listGoals(
    _scope: FinCommanderScope,
    _planId: string
  ): Promise<FinCommanderGoal[]> {
    return [];
  }

  async saveGoal(
    _scope: FinCommanderScope,
    _goal: FinCommanderGoal
  ): Promise<void> {
    return;
  }

  async deleteGoal(_scope: FinCommanderScope, _goalId: string): Promise<void> {
    return;
  }

  async listScenarios(
    _scope: FinCommanderScope,
    _planId: string
  ): Promise<FinCommanderScenario[]> {
    return [];
  }

  async saveScenario(
    _scope: FinCommanderScope,
    _scenario: FinCommanderScenario
  ): Promise<void> {
    return;
  }

  async deleteScenario(
    _scope: FinCommanderScope,
    _scenarioId: string
  ): Promise<void> {
    return;
  }
}
