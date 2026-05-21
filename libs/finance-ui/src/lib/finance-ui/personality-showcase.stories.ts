import type { Meta, StoryObj } from '@storybook/angular';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { FinanceService } from './services/finance.service';

const financeServiceStub = {
  getWorkspaceSummary: async () => ({
    workspace: 'personal' as const,
    headline: 'Fin Commander keeps every plan, ledger, and scenario in formation.',
    metrics: {
      accountCount: 3,
      budgetCount: 4,
      totalBalance: 18420,
      netWorth: 62210,
      monthlySpend: 4120,
      assetValue: 43790,
      liabilityValue: 0,
      budgetsAtRiskCount: 1,
      upcomingRecurringCount: 3,
    },
    coachCards: [],
  }),
  getWorkQueue: async () => ({
    workspace: 'personal' as const,
    items: [
      {
        id: 'queue-1',
        ruleId: 'review-freshness',
        title: 'Review the checking account baseline',
        message: 'Balances have drifted from the last reconciled checkpoint.',
        explanation: 'A quick review keeps plan projections and import matching stable.',
        whyItMatters: 'Scenario outputs are only as good as the source cash position.',
        category: 'data-hygiene' as const,
        severity: 'warning' as const,
        actionLabel: 'Open accounts',
        actionRoute: ['/finance', 'personal', 'accounts'],
        entityRefs: [],
      },
    ],
  }),
  getTransactions: async () => [
    {
      id: 'transaction-1',
      amount: 2450,
      type: 'credit',
      category: 'Salary',
      userId: 'story-user',
      profileId: 'story-profile',
      appScope: 'finance',
      accountId: 'account-1',
      transactionDate: new Date('2026-04-10'),
      createdAt: new Date('2026-04-10'),
      updatedAt: new Date('2026-04-10'),
      isRecurring: false,
      workspace: 'personal' as const,
    },
  ],
  getBudgets: async () => [
    {
      id: 'budget-1',
      name: 'Household',
      category: 'Living',
      limit: 2800,
      spent: 2130,
      period: 'monthly',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-30'),
      userId: 'story-user',
      profileId: 'story-profile',
      appScope: 'finance',
      createdAt: new Date('2026-04-01'),
      updatedAt: new Date('2026-04-10'),
      isActive: true,
      alertOnExceed: true,
      workspace: 'personal' as const,
    },
  ],
  getRecurringItems: async () => [
    {
      id: 'recurring-1',
      name: 'Mortgage',
      amount: 1620,
      type: 'debit',
      cadence: 'monthly',
      nextDueDate: new Date('2026-04-20'),
      status: 'scheduled',
      userId: 'story-user',
      profileId: 'story-profile',
      appScope: 'finance',
      workspace: 'personal' as const,
      createdAt: new Date('2026-04-01'),
      updatedAt: new Date('2026-04-10'),
      isActive: true,
    },
  ],
  getInventoryItems: async () => [],
};

const meta: Meta<DashboardComponent> = {
  component: DashboardComponent,
  title: 'Theme/Personality Showcase/Finance UI',
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      ...story(),
      providers: [
        provideRouter([]),
        { provide: FinanceService, useValue: financeServiceStub },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'personal',
              },
            },
          },
        },
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<DashboardComponent>;

export const Showcase: Story = {
  render: () => ({
    template: `
      <div style="padding: 24px; background: var(--background, #f8fafc); color: var(--foreground, #1f2937);">
        <ot-finance-dashboard></ot-finance-dashboard>
      </div>
    `,
  }),
};
