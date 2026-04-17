import { FinanceWorkspace, FinanceWorkspaceSummary } from '@optimistic-tanuki/finance-ui';

export interface FinCommanderPlan {
  id: string;
  name: string;
  description: string;
  defaultWorkspace: FinanceWorkspace;
  updatedAt: string;
}

export interface FinCommanderGoal {
  id: string;
  planId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  dueDate: string;
  strategy: string;
}

export interface FinCommanderScenarioAssumption {
  id: string;
  label: string;
  delta: string;
  impactArea: 'income' | 'spend' | 'savings' | 'debt';
}

export interface FinCommanderScenario {
  id: string;
  planId: string;
  name: string;
  summary: string;
  assumptions: FinCommanderScenarioAssumption[];
}

export interface FinCommanderOverview {
  plan: FinCommanderPlan;
  goals: FinCommanderGoal[];
  scenarios: FinCommanderScenario[];
  workspaces: Array<{
    workspace: FinanceWorkspace;
    summary: FinanceWorkspaceSummary | null;
    available: boolean;
  }>;
}
