jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: (value: string) => value,
  },
}));

import { FinanceSummaryService } from './finance-summary.service';
import type { AccountService } from './account.service';
import type { TransactionService } from './transaction.service';
import type { BudgetService } from './budget.service';
import type { InventoryItemService } from './inventory-item.service';
import type { RecurringItemService } from './recurring-item.service';
import type { FinanceTenantService } from './finance-tenant.service';

describe('FinanceSummaryService', () => {
  let service: FinanceSummaryService;
  let accountService: { findAll: jest.Mock; create: jest.Mock };
  let transactionService: { findAll: jest.Mock };
  let budgetService: { findAll: jest.Mock; create: jest.Mock };
  let inventoryItemService: { findAll: jest.Mock };
  let recurringItemService: { findAll: jest.Mock; create: jest.Mock };
  let financeTenantService: { getCurrentTenant: jest.Mock };

  beforeEach(() => {
    accountService = { findAll: jest.fn(), create: jest.fn() };
    transactionService = { findAll: jest.fn() };
    budgetService = { findAll: jest.fn(), create: jest.fn() };
    inventoryItemService = { findAll: jest.fn() };
    recurringItemService = { findAll: jest.fn(), create: jest.fn() };
    financeTenantService = { getCurrentTenant: jest.fn() };

    service = new FinanceSummaryService(
      accountService as unknown as AccountService,
      transactionService as unknown as TransactionService,
      budgetService as unknown as BudgetService,
      inventoryItemService as unknown as InventoryItemService,
      recurringItemService as unknown as RecurringItemService,
      financeTenantService as unknown as FinanceTenantService
    );
  });

  it('builds a net-worth rollup from personal, business, and asset records', async () => {
    accountService.findAll.mockResolvedValue([
      { id: 'a1', balance: 1000, type: 'bank', workspace: 'personal' },
      { id: 'a2', balance: 2500, type: 'bank', workspace: 'business' },
      { id: 'a3', balance: -700, type: 'credit', workspace: 'personal' },
    ]);
    transactionService.findAll.mockResolvedValue([]);
    budgetService.findAll.mockResolvedValue([]);
    inventoryItemService.findAll.mockResolvedValue([
      { id: 'i1', totalValue: 5000, workspace: 'net-worth' },
      { id: 'i2', totalValue: 1500, workspace: 'personal' },
    ]);
    recurringItemService.findAll.mockResolvedValue([]);

    const summary = await service.getWorkspaceSummary(
      {
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      },
      'net-worth'
    );

    expect(summary.workspace).toBe('net-worth');
    expect(summary.metrics.netWorth).toBe(9300);
    expect(summary.metrics.assetValue).toBe(6500);
    expect(summary.metrics.liabilityValue).toBe(700);
    expect(summary.metrics.accountCount).toBe(3);
  });

  it('flags onboarding as required when no personal or business accounts exist', async () => {
    accountService.findAll.mockResolvedValue([]);
    budgetService.findAll.mockResolvedValue([]);
    inventoryItemService.findAll.mockResolvedValue([]);

    const state = await service.getOnboardingState({
      userId: 'user-1',
      profileId: 'profile-1',
      appScope: 'finance',
    });

    expect(state.requiresOnboarding).toBe(true);
    expect(state.availableWorkspaces).toEqual([]);
  });

  it('prioritizes uncategorized transactions ahead of budget warnings in the work queue', async () => {
    accountService.findAll.mockResolvedValue([
      {
        id: 'a1',
        balance: 2000,
        workspace: 'business',
        lastReviewedAt: new Date(),
      },
    ]);
    transactionService.findAll.mockResolvedValue([
      {
        id: 't1',
        type: 'debit',
        amount: 120,
        workspace: 'business',
        category: '',
        description: 'Owner draw?',
      },
    ]);
    budgetService.findAll.mockResolvedValue([
      {
        id: 'b1',
        workspace: 'business',
        limit: 100,
        spent: 90,
        isActive: true,
      },
    ]);
    inventoryItemService.findAll.mockResolvedValue([]);
    recurringItemService.findAll.mockResolvedValue([]);

    const queue = await service.getWorkQueue(
      { userId: 'user-1', profileId: 'profile-1', appScope: 'finance' },
      'business'
    );

    expect(queue.items[0]?.ruleId).toBe('uncategorized-transactions');
    expect(
      queue.items.some(
        (item: { ruleId: string }) => item.ruleId === 'budget-near-limit'
      )
    ).toBe(true);
  });

  it('derives budget pressure from categorized transactions that match the budget category', async () => {
    accountService.findAll.mockResolvedValue([
      {
        id: 'a1',
        balance: 1200,
        workspace: 'personal',
        lastReviewedAt: new Date(),
      },
    ]);
    transactionService.findAll.mockResolvedValue([
      {
        id: 't1',
        type: 'debit',
        amount: 85,
        workspace: 'personal',
        category: 'Groceries',
        transactionDate: new Date(),
      },
    ]);
    budgetService.findAll.mockResolvedValue([
      {
        id: 'b1',
        workspace: 'personal',
        category: 'Groceries',
        limit: 100,
        spent: 0,
        isActive: true,
      },
    ]);
    inventoryItemService.findAll.mockResolvedValue([]);
    recurringItemService.findAll.mockResolvedValue([]);

    const queue = await service.getWorkQueue(
      { userId: 'user-1', profileId: 'profile-1', appScope: 'finance' },
      'personal'
    );

    expect(
      queue.items.some(
        (item: { ruleId: string }) => item.ruleId === 'budget-near-limit'
      )
    ).toBe(true);
  });

  it('resolves tenantId before bootstrapping starter finance records', async () => {
    financeTenantService.getCurrentTenant.mockResolvedValue({
      id: 'tenant-1',
      name: 'Household',
      profileId: 'profile-1',
      appScope: 'finance',
    });
    accountService.findAll.mockResolvedValue([]);
    budgetService.findAll.mockResolvedValue([]);
    accountService.create.mockResolvedValue({ id: 'account-1' });
    budgetService.create.mockResolvedValue({ id: 'budget-1' });

    await service.bootstrap(
      {
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      },
      { workspaces: ['personal'] }
    );

    expect(financeTenantService.getCurrentTenant).toHaveBeenCalledWith({
      userId: 'user-1',
      profileId: 'profile-1',
      appScope: 'finance',
    });
    expect(accountService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
      })
    );
    expect(budgetService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
      })
    );
  });
});
