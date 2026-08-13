import {
  FinanceWorkspace,
  FinanceWorkspaceSummary,
} from '@optimistic-tanuki/finance-ui';

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
  /** Target amount in integer cents. Never store money as a float. */
  targetAmountCents: number;
  /** Current amount in integer cents. Never store money as a float. */
  currentAmountCents: number;
  dueDate: string;
  strategy: string;
  fundingAccountId?: string | null;
  fundingDirective?: {
    fundingAccountId: string;
    fundingAccountName: string;
    fundingAccountBalanceCents: number;
    remainingAmountCents: number;
    monthsRemaining: number;
    requiredMonthlyContributionCents: number;
    isOverdue: boolean;
  } | null;
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

export interface FinCommanderCashFlowProjection {
  calculatedAt: string;
  workspace: FinanceWorkspace;
  openingBalanceCents: number;
  projectedBalanceCents: number;
  horizonDays: number;
  events: Array<{
    date: string;
    amountCents: number;
    kind: string;
    label: string;
    sourceId: string;
  }>;
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
