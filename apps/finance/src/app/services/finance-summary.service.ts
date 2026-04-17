import { Injectable } from '@nestjs/common';
import {
  BootstrapFinanceWorkspaceDto,
  CreateAccountDto,
  CreateBudgetDto,
  CreateInventoryItemDto,
  CreateRecurringItemDto,
  FinanceCoachCardDto,
  FinanceOnboardingStateDto,
  FinanceWorkQueueDto,
  FinanceWorkspace,
  FinanceWorkspaceSummaryDto,
} from '@optimistic-tanuki/models';
import { AccountService } from './account.service';
import { BudgetService } from './budget.service';
import { InventoryItemService } from './inventory-item.service';
import { RecurringItemService } from './recurring-item.service';
import { TransactionService } from './transaction.service';
import { FinanceScope } from './finance-scope';
import { FinanceTenantService } from './finance-tenant.service';

type FinanceRecord = { workspace?: FinanceWorkspace | null };
type CoachCategory = 'data-hygiene' | 'cash-pressure' | 'boundary-drift';
type CoachSeverity = 'info' | 'warning' | 'action';

@Injectable()
export class FinanceSummaryService {
  constructor(
    private readonly accountService: AccountService,
    private readonly transactionService: TransactionService,
    private readonly budgetService: BudgetService,
    private readonly inventoryItemService: InventoryItemService,
    private readonly recurringItemService: RecurringItemService,
    private readonly financeTenantService: FinanceTenantService
  ) {}

  private async resolveTenantId(scope: FinanceScope): Promise<string> {
    if (scope.tenantId) {
      return scope.tenantId;
    }

    const tenant = await this.financeTenantService.getCurrentTenant(scope);
    return tenant.id;
  }

  private matchesWorkspace<T extends FinanceRecord>(
    record: T,
    workspace: FinanceWorkspace
  ): boolean {
    if (workspace === 'net-worth') {
      return true;
    }

    return record.workspace === workspace;
  }

  private numberValue(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private pushRule(
    items: FinanceCoachCardDto[],
    rule: FinanceCoachCardDto | null
  ): void {
    if (rule) {
      items.push(rule);
    }
  }

  private priorityFor(item: FinanceCoachCardDto): number {
    const severityPriority: Record<CoachSeverity, number> = {
      action: 0,
      warning: 1,
      info: 2,
    };
    const categoryPriority: Record<CoachCategory, number> = {
      'data-hygiene': 0,
      'cash-pressure': 1,
      'boundary-drift': 2,
    };

    return (
      severityPriority[item.severity] * 10 + categoryPriority[item.category]
    );
  }

  private createRule(
    workspace: FinanceWorkspace,
    ruleId: string,
    category: CoachCategory,
    severity: CoachSeverity,
    title: string,
    message: string,
    explanation: string,
    whyItMatters: string,
    actionLabel: string,
    actionRoute: string,
    entityRefs: FinanceCoachCardDto['entityRefs']
  ): FinanceCoachCardDto {
    return {
      id: `${workspace}-${ruleId}`,
      ruleId,
      category,
      severity,
      title,
      message,
      explanation,
      whyItMatters,
      actionLabel,
      actionRoute,
      entityRefs,
    };
  }

  async getWorkQueue(
    scope: FinanceScope,
    workspace: FinanceWorkspace
  ): Promise<FinanceWorkQueueDto> {
    const [
      accountsResult,
      transactionsResult,
      budgetsResult,
      inventoryItemsResult,
      recurringItemsResult,
    ] = await Promise.all([
      this.accountService.findAll(scope),
      this.transactionService.findAll(scope),
      this.budgetService.findAll(scope),
      this.inventoryItemService.findAll(scope),
      this.recurringItemService.findAll(scope),
    ]);
    const accounts = (accountsResult ?? []).filter((record) =>
      this.matchesWorkspace(record, workspace)
    );
    const transactions = (transactionsResult ?? []).filter((record) =>
      this.matchesWorkspace(record, workspace)
    );
    const budgets = (budgetsResult ?? []).filter((record) =>
      this.matchesWorkspace(record, workspace)
    );
    const inventoryItems = (inventoryItemsResult ?? []).filter((record) =>
      this.matchesWorkspace(record, workspace)
    );
    const recurringItems = (recurringItemsResult ?? []).filter((record) =>
      this.matchesWorkspace(record, workspace)
    );

    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const items: FinanceCoachCardDto[] = [];

    const uncategorizedTransactions = transactions.filter(
      (transaction) =>
        !transaction.category || !String(transaction.category).trim()
    );
    this.pushRule(
      items,
      uncategorizedTransactions.length
        ? this.createRule(
            workspace,
            'uncategorized-transactions',
            'data-hygiene',
            'action',
            'Categorize recent transactions',
            `${uncategorizedTransactions.length} transactions still need a category.`,
            'These transactions were recorded without a category.',
            'Categories power budgets, review queues, and clearer reporting.',
            'Review transactions',
            `/finance/${workspace}/transactions`,
            uncategorizedTransactions.map((transaction) => ({
              entityType: 'transaction',
              entityId: transaction.id,
            }))
          )
        : null
    );

    const activeBudgets = budgets.filter((budget) => budget.isActive);
    this.pushRule(
      items,
      transactions.length > 0 && activeBudgets.length === 0
        ? this.createRule(
            workspace,
            'missing-budget-coverage',
            'data-hygiene',
            'action',
            'Create budget coverage',
            'This workspace has transaction activity but no active budgets.',
            'Money is moving through the ledger without any planning guardrails.',
            'Budgets let the system surface pressure, variance, and due actions.',
            'Create a budget',
            `/finance/${workspace}/budgets`,
            []
          )
        : null
    );

    const staleAccounts = accounts.filter(
      (account) =>
        !account.lastReviewedAt ||
        new Date(account.lastReviewedAt) < thirtyDaysAgo
    );
    this.pushRule(
      items,
      staleAccounts.length
        ? this.createRule(
            workspace,
            'stale-account-review',
            'data-hygiene',
            'action',
            'Review stale account balances',
            `${staleAccounts.length} accounts have not been reviewed recently.`,
            'These balances may no longer match reality.',
            'Unreviewed accounts weaken every downstream metric and coaching rule.',
            'Review accounts',
            `/finance/${workspace}/accounts`,
            staleAccounts.map((account) => ({
              entityType: 'account',
              entityId: account.id,
            }))
          )
        : null
    );

    const dueSoonRecurring = recurringItems.filter((item) => {
      const dueDate = new Date(item.nextDueDate);
      return item.isActive && dueDate >= now && dueDate <= sevenDaysFromNow;
    });
    this.pushRule(
      items,
      dueSoonRecurring.length
        ? this.createRule(
            workspace,
            'recurring-due-soon',
            'cash-pressure',
            'warning',
            'Recurring items are due soon',
            `${dueSoonRecurring.length} recurring items need attention in the next 7 days.`,
            'A bill, income event, or recurring transfer is approaching its due date.',
            'Reviewing recurring items early reduces misses and cash surprises.',
            'Review recurring',
            `/finance/${workspace}/recurring`,
            dueSoonRecurring.map((item) => ({
              entityType: 'recurring-item',
              entityId: item.id,
            }))
          )
        : null
    );

    const nearLimitBudgets = activeBudgets.filter((budget) => {
      const limit = this.numberValue(budget.limit);
      const spent = this.numberValue(budget.spent);
      return limit > 0 && spent / limit >= 0.8 && spent / limit < 1;
    });
    this.pushRule(
      items,
      nearLimitBudgets.length
        ? this.createRule(
            workspace,
            'budget-near-limit',
            'cash-pressure',
            'warning',
            'Budget pressure is building',
            `${nearLimitBudgets.length} budgets are above 80% of their limit.`,
            'Spending in these categories is trending close to plan.',
            'Catching pressure early gives time to adjust before budgets break.',
            'Review budgets',
            `/finance/${workspace}/budgets`,
            nearLimitBudgets.map((budget) => ({
              entityType: 'budget',
              entityId: budget.id,
            }))
          )
        : null
    );

    const overLimitBudgets = activeBudgets.filter((budget) => {
      const limit = this.numberValue(budget.limit);
      const spent = this.numberValue(budget.spent);
      return limit > 0 && spent / limit >= 1;
    });
    this.pushRule(
      items,
      overLimitBudgets.length
        ? this.createRule(
            workspace,
            'budget-over-limit',
            'cash-pressure',
            'action',
            'A budget is already over limit',
            `${overLimitBudgets.length} budgets have exceeded plan.`,
            'Actual spending is past the configured limit.',
            'Over-limit budgets are an immediate signal to adjust cash flow or revise the plan.',
            'Adjust budgets',
            `/finance/${workspace}/budgets`,
            overLimitBudgets.map((budget) => ({
              entityType: 'budget',
              entityId: budget.id,
            }))
          )
        : null
    );

    const ownerTransferCandidates =
      workspace === 'business'
        ? transactions.filter((transaction) => {
            const text = `${transaction.description ?? ''} ${
              transaction.payeeOrVendor ?? ''
            }`.toLowerCase();
            return (
              !transaction.transferType &&
              (text.includes('owner') ||
                text.includes('personal') ||
                text.includes('draw'))
            );
          })
        : [];
    this.pushRule(
      items,
      ownerTransferCandidates.length
        ? this.createRule(
            workspace,
            'owner-transfer-review',
            'boundary-drift',
            'warning',
            'Review owner transfer activity',
            `${ownerTransferCandidates.length} business transactions may be owner transfers.`,
            'The wording suggests money moved between business and personal use.',
            'Explicit transfer classification keeps business and personal reporting separate.',
            'Classify transfers',
            `/finance/${workspace}/transactions`,
            ownerTransferCandidates.map((transaction) => ({
              entityType: 'transaction',
              entityId: transaction.id,
            }))
          )
        : null
    );

    this.pushRule(
      items,
      workspace === 'net-worth' &&
        accounts.length > 0 &&
        inventoryItems.length === 0
        ? this.createRule(
            workspace,
            'net-worth-missing-assets',
            'boundary-drift',
            'info',
            'Track off-ledger assets',
            'Net worth is currently based only on account balances.',
            'No tracked assets have been added outside the cash ledgers.',
            'Asset tracking makes the net-worth rollup more complete and less cash-centric.',
            'Add assets',
            '/finance/net-worth/assets',
            []
          )
        : null
    );

    items.sort(
      (left, right) => this.priorityFor(left) - this.priorityFor(right)
    );

    return {
      workspace,
      items,
    };
  }

  async getWorkspaceSummary(
    scope: FinanceScope,
    workspace: FinanceWorkspace
  ): Promise<FinanceWorkspaceSummaryDto> {
    const [
      accountsResult,
      transactionsResult,
      budgetsResult,
      inventoryItemsResult,
      recurringItemsResult,
      workQueue,
    ] = await Promise.all([
      this.accountService.findAll(scope),
      this.transactionService.findAll(scope),
      this.budgetService.findAll(scope),
      this.inventoryItemService.findAll(scope),
      this.recurringItemService.findAll(scope),
      this.getWorkQueue(scope, workspace),
    ]);
    const accounts = accountsResult ?? [];
    const transactions = transactionsResult ?? [];
    const budgets = budgetsResult ?? [];
    const inventoryItems = inventoryItemsResult ?? [];
    const recurringItems = recurringItemsResult ?? [];

    const scopedAccounts = accounts.filter((record) =>
      this.matchesWorkspace(record, workspace)
    );
    const scopedTransactions = transactions.filter((record) =>
      this.matchesWorkspace(record, workspace)
    );
    const scopedBudgets = budgets.filter((record) =>
      this.matchesWorkspace(record, workspace)
    );
    const scopedInventoryItems = inventoryItems.filter((record) =>
      this.matchesWorkspace(record, workspace)
    );

    const totalBalance = scopedAccounts.reduce(
      (sum, account) => sum + this.numberValue(account.balance),
      0
    );
    const assetValue = scopedInventoryItems.reduce(
      (sum, item) => sum + this.numberValue(item.totalValue),
      0
    );
    const liabilityValue = scopedAccounts
      .filter((account) => this.numberValue(account.balance) < 0)
      .reduce(
        (sum, account) => sum + Math.abs(this.numberValue(account.balance)),
        0
      );
    const monthlySpend = scopedTransactions
      .filter((transaction) => transaction.type === 'debit')
      .reduce(
        (sum, transaction) => sum + this.numberValue(transaction.amount),
        0
      );
    const budgetsAtRiskCount = scopedBudgets.filter((budget) => {
      const spent = this.numberValue(budget.spent);
      const limit = this.numberValue(budget.limit);
      return limit > 0 && spent / limit >= 0.8;
    }).length;
    const upcomingRecurringCount = recurringItems.filter(
      (item) => item.isActive && item.workspace === workspace
    ).length;
    const netWorth = totalBalance + assetValue;

    return {
      workspace,
      headline:
        workspace === 'personal'
          ? 'Personal cash flow and day-to-day spending'
          : workspace === 'business'
          ? 'Business operations, burn, and income tracking'
          : 'Net worth rollup across ledgers and tracked assets',
      metrics: {
        accountCount: scopedAccounts.length,
        budgetCount: scopedBudgets.length,
        totalBalance,
        monthlySpend,
        assetValue,
        liabilityValue,
        netWorth,
        budgetsAtRiskCount,
        upcomingRecurringCount,
      },
      coachCards: workQueue.items.slice(0, 3),
    };
  }

  async getOnboardingState(
    scope: FinanceScope
  ): Promise<FinanceOnboardingStateDto> {
    const [accountsResult, budgetsResult] = await Promise.all([
      this.accountService.findAll(scope),
      this.budgetService.findAll(scope),
    ]);
    const accounts = accountsResult ?? [];
    const budgets = budgetsResult ?? [];

    const availableWorkspaces = (
      ['personal', 'business'] as FinanceWorkspace[]
    ).filter((workspace) =>
      accounts.some((account) => account.workspace === workspace)
    );

    return {
      requiresOnboarding: availableWorkspaces.length === 0,
      availableWorkspaces,
      checklist: [
        {
          id: 'setup-personal',
          label: 'Create a personal account workspace',
          complete: availableWorkspaces.includes('personal'),
        },
        {
          id: 'setup-business',
          label: 'Create a business account workspace',
          complete: availableWorkspaces.includes('business'),
        },
        {
          id: 'create-budget',
          label: 'Add at least one budget',
          complete: budgets.length > 0,
        },
      ],
    };
  }

  async bootstrap(
    scope: FinanceScope,
    dto: BootstrapFinanceWorkspaceDto
  ): Promise<FinanceOnboardingStateDto> {
    const workspaces = Array.from(new Set(dto.workspaces ?? []));
    const tenantId = await this.resolveTenantId(scope);

    for (const workspace of workspaces) {
      if (workspace === 'personal') {
        const account: CreateAccountDto = {
          name: 'Personal Checking',
          type: 'bank',
          balance: 0,
          currency: 'USD',
          description: 'Starter account for personal budgeting',
          workspace,
          userId: scope.userId!,
          profileId: scope.profileId!,
          tenantId,
          appScope: scope.appScope ?? 'finance',
        };
        const budget: CreateBudgetDto = {
          name: 'Monthly Essentials',
          category: 'living',
          limit: 2000,
          spent: 0,
          period: 'monthly',
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
          alertOnExceed: true,
          workspace,
          userId: scope.userId!,
          profileId: scope.profileId!,
          tenantId,
          appScope: scope.appScope ?? 'finance',
        };
        await this.accountService.create(account);
        await this.budgetService.create(budget);
      }

      if (workspace === 'business') {
        const account: CreateAccountDto = {
          name: 'Business Operating',
          type: 'bank',
          balance: 0,
          currency: 'USD',
          description: 'Starter account for income and expense tracking',
          workspace,
          userId: scope.userId!,
          profileId: scope.profileId!,
          tenantId,
          appScope: scope.appScope ?? 'finance',
        };
        const budget: CreateBudgetDto = {
          name: 'Operating Expenses',
          category: 'operations',
          limit: 5000,
          spent: 0,
          period: 'monthly',
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
          alertOnExceed: true,
          workspace,
          userId: scope.userId!,
          profileId: scope.profileId!,
          tenantId,
          appScope: scope.appScope ?? 'finance',
        };
        const recurringItem: CreateRecurringItemDto = {
          name: 'Quarterly Bookkeeping Review',
          amount: 0,
          type: 'debit',
          category: 'operations',
          cadence: 'quarterly',
          nextDueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
          status: 'scheduled',
          notes: 'Review transfers and bookkeeping hygiene.',
          workspace,
          userId: scope.userId!,
          profileId: scope.profileId!,
          tenantId,
          appScope: scope.appScope ?? 'finance',
        };
        const asset: CreateInventoryItemDto = {
          name: 'Starter Equipment',
          category: 'equipment',
          quantity: 1,
          unitValue: 1500,
          description: 'Seed asset for net worth tracking',
          workspace: 'net-worth',
          userId: scope.userId!,
          profileId: scope.profileId!,
          tenantId,
          appScope: scope.appScope ?? 'finance',
        };
        await this.accountService.create(account);
        await this.budgetService.create(budget);
        await this.recurringItemService.create(recurringItem);
        await this.inventoryItemService.create(asset);
      }
    }

    return this.getOnboardingState(scope);
  }
}
