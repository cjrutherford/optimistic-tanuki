jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn((value: string) => value) },
}));

import { AppController } from './app.controller';
import { AccountService } from './services/account.service';
import { TransactionService } from './services/transaction.service';
import { InventoryItemService } from './services/inventory-item.service';
import { BudgetService } from './services/budget.service';
import { FinanceSummaryService } from './services/finance-summary.service';
import { RecurringItemService } from './services/recurring-item.service';
import { FinanceTenantService } from './services/finance-tenant.service';
import { BankConnectionService } from './services/bank-connection.service';
import { FinancialUtilitiesService } from './services/financial-utilities.service';
import { FinCommanderPlanService } from './services/fin-commander-plan.service';
import { FinCommanderGoalService } from './services/fin-commander-goal.service';
import { FinCommanderScenarioService } from './services/fin-commander-scenario.service';
import { FinCommanderProjectionService } from './services/fin-commander-projection.service';
import { FinCommanderFundingDirectiveService } from './services/fin-commander-funding-directive.service';

type Mocks = Record<string, jest.Mock>;

/**
 * The controller is 72 thin message handlers over 14 services. The spec beside
 * this one covers the tenant-isolation chokepoint in depth; this one asserts
 * every handler is wired to the service method it claims, which is exactly the
 * kind of mistake a copy-pasted handler makes.
 */
describe('AppController delegation', () => {
  const CRUD = ['create', 'findAll', 'findOne', 'update', 'remove'];

  const TOKENS: Record<string, string> = {
    accountService: 'account',
    transactionService: 'transaction',
    inventoryItemService: 'inventory',
    budgetService: 'budget',
    recurringItemService: 'recurring',
    financeSummaryService: 'summary',
    financeTenantService: 'tenant',
    bankConnectionService: 'bank',
    financialUtilitiesService: 'utilities',
    finCommanderPlanService: 'plan',
    finCommanderGoalService: 'goal',
    finCommanderScenarioService: 'scenario',
    finCommanderProjectionService: 'projection',
    finCommanderFundingDirectiveService: 'directive',
  };

  const mockOf = (methods: string[], token: string): Mocks =>
    Object.fromEntries(
      methods.map((m) => [m, jest.fn().mockResolvedValue(`${token}:${m}`)])
    );

  let controller: AppController;
  let services: Record<string, Mocks>;

  beforeEach(() => {
    services = {
      accountService: mockOf(CRUD, 'account'),
      transactionService: mockOf(CRUD, 'transaction'),
      inventoryItemService: mockOf(CRUD, 'inventory'),
      budgetService: mockOf(CRUD, 'budget'),
      recurringItemService: mockOf(CRUD, 'recurring'),
      financeSummaryService: mockOf(
        [
          'getWorkspaceSummary',
          'getWorkQueue',
          'getOnboardingState',
          'bootstrap',
        ],
        'summary'
      ),
      financeTenantService: mockOf(
        [
          'getCurrentTenant',
          'createTenant',
          'listTenants',
          'listMembers',
          'addMember',
          'updateMemberRole',
          'removeMember',
          'assertTenantAccess',
        ],
        'tenant'
      ),
      bankConnectionService: mockOf(
        [
          'createConnection',
          'listConnections',
          'syncConnection',
          'disconnectConnection',
          'createLinkToken',
          'exchangePublicToken',
          'processWebhook',
        ],
        'bank'
      ),
      financialUtilitiesService: mockOf(
        [
          'createInvoice',
          'listInvoices',
          'getInvoice',
          'updateInvoice',
          'sendInvoice',
          'voidInvoice',
          'recordInvoicePayment',
          'createCheckoutSession',
          'listCheckoutSessions',
          'getCheckoutSession',
        ],
        'utilities'
      ),
      finCommanderPlanService: mockOf([...CRUD, 'assertAccess'], 'plan'),
      finCommanderGoalService: mockOf([...CRUD, 'getFundingDirective'], 'goal'),
      finCommanderScenarioService: mockOf(CRUD, 'scenario'),
      finCommanderProjectionService: mockOf(['getProjection'], 'projection'),
      finCommanderFundingDirectiveService: mockOf(
        ['preview', 'approve', 'cancel'],
        'directive'
      ),
    };

    // getCurrentTenant feeds withResolvedTenant on the create paths.
    services['financeTenantService']['getCurrentTenant'].mockResolvedValue({
      id: 'tenant-1',
    });

    controller = new AppController(
      services['accountService'] as unknown as AccountService,
      services['transactionService'] as unknown as TransactionService,
      services['inventoryItemService'] as unknown as InventoryItemService,
      services['budgetService'] as unknown as BudgetService,
      services['financeSummaryService'] as unknown as FinanceSummaryService,
      services['recurringItemService'] as unknown as RecurringItemService,
      services['financeTenantService'] as unknown as FinanceTenantService,
      services['bankConnectionService'] as unknown as BankConnectionService,
      services[
        'financialUtilitiesService'
      ] as unknown as FinancialUtilitiesService,
      services['finCommanderPlanService'] as unknown as FinCommanderPlanService,
      services['finCommanderGoalService'] as unknown as FinCommanderGoalService,
      services[
        'finCommanderScenarioService'
      ] as unknown as FinCommanderScenarioService,
      services[
        'finCommanderProjectionService'
      ] as unknown as FinCommanderProjectionService,
      services[
        'finCommanderFundingDirectiveService'
      ] as unknown as FinCommanderFundingDirectiveService
    );
  });

  // handler, service key, service method
  const table: Array<[string, string, string]> = [
    ['createAccount', 'accountService', 'create'],
    ['findAllAccounts', 'accountService', 'findAll'],
    ['findOneAccount', 'accountService', 'findOne'],
    ['updateAccount', 'accountService', 'update'],
    ['removeAccount', 'accountService', 'remove'],

    ['createTransaction', 'transactionService', 'create'],
    ['findAllTransactions', 'transactionService', 'findAll'],
    ['findOneTransaction', 'transactionService', 'findOne'],
    ['updateTransaction', 'transactionService', 'update'],
    ['removeTransaction', 'transactionService', 'remove'],

    ['createBankConnection', 'bankConnectionService', 'createConnection'],
    ['listBankConnections', 'bankConnectionService', 'listConnections'],
    ['syncBankConnection', 'bankConnectionService', 'syncConnection'],
    [
      'disconnectBankConnection',
      'bankConnectionService',
      'disconnectConnection',
    ],
    ['createBankLinkToken', 'bankConnectionService', 'createLinkToken'],
    ['exchangePublicToken', 'bankConnectionService', 'exchangePublicToken'],
    ['processBankWebhook', 'bankConnectionService', 'processWebhook'],

    ['createFinancialInvoice', 'financialUtilitiesService', 'createInvoice'],
    ['listFinancialInvoices', 'financialUtilitiesService', 'listInvoices'],
    ['getFinancialInvoice', 'financialUtilitiesService', 'getInvoice'],
    ['updateFinancialInvoice', 'financialUtilitiesService', 'updateInvoice'],
    ['sendFinancialInvoice', 'financialUtilitiesService', 'sendInvoice'],
    ['voidFinancialInvoice', 'financialUtilitiesService', 'voidInvoice'],
    [
      'recordFinancialInvoicePayment',
      'financialUtilitiesService',
      'recordInvoicePayment',
    ],
    [
      'createFinancialCheckoutSession',
      'financialUtilitiesService',
      'createCheckoutSession',
    ],
    [
      'listFinancialCheckoutSessions',
      'financialUtilitiesService',
      'listCheckoutSessions',
    ],
    [
      'getFinancialCheckoutSession',
      'financialUtilitiesService',
      'getCheckoutSession',
    ],

    ['createInventoryItem', 'inventoryItemService', 'create'],
    ['findAllInventoryItems', 'inventoryItemService', 'findAll'],
    ['findOneInventoryItem', 'inventoryItemService', 'findOne'],
    ['updateInventoryItem', 'inventoryItemService', 'update'],
    ['removeInventoryItem', 'inventoryItemService', 'remove'],

    ['createBudget', 'budgetService', 'create'],
    ['findAllBudgets', 'budgetService', 'findAll'],
    ['findOneBudget', 'budgetService', 'findOne'],
    ['updateBudget', 'budgetService', 'update'],
    ['removeBudget', 'budgetService', 'remove'],

    ['createRecurringItem', 'recurringItemService', 'create'],
    ['findAllRecurringItems', 'recurringItemService', 'findAll'],
    ['findOneRecurringItem', 'recurringItemService', 'findOne'],
    ['updateRecurringItem', 'recurringItemService', 'update'],
    ['removeRecurringItem', 'recurringItemService', 'remove'],

    ['getWorkspaceSummary', 'financeSummaryService', 'getWorkspaceSummary'],
    ['getWorkQueue', 'financeSummaryService', 'getWorkQueue'],
    ['getOnboardingState', 'financeSummaryService', 'getOnboardingState'],
    ['bootstrapFinance', 'financeSummaryService', 'bootstrap'],

    ['createTenant', 'financeTenantService', 'createTenant'],
    ['listTenants', 'financeTenantService', 'listTenants'],
    ['listTenantMembers', 'financeTenantService', 'listMembers'],
    ['createTenantMember', 'financeTenantService', 'addMember'],
    ['updateTenantMember', 'financeTenantService', 'updateMemberRole'],
    ['removeTenantMember', 'financeTenantService', 'removeMember'],

    ['createFinCommanderPlan', 'finCommanderPlanService', 'create'],
    ['findAllFinCommanderPlans', 'finCommanderPlanService', 'findAll'],
    ['findOneFinCommanderPlan', 'finCommanderPlanService', 'findOne'],
    ['updateFinCommanderPlan', 'finCommanderPlanService', 'update'],
    ['removeFinCommanderPlan', 'finCommanderPlanService', 'remove'],

    [
      'getFinCommanderCashFlowProjection',
      'finCommanderProjectionService',
      'getProjection',
    ],

    // The four goal read/write handlers are not plain delegations - they
    // decorate the goal with its funding directive. Covered separately below.
    ['removeFinCommanderGoal', 'finCommanderGoalService', 'remove'],

    [
      'previewFinCommanderFundingDirective',
      'finCommanderFundingDirectiveService',
      'preview',
    ],
    [
      'approveFinCommanderFundingDirective',
      'finCommanderFundingDirectiveService',
      'approve',
    ],
    [
      'cancelFinCommanderFundingDirective',
      'finCommanderFundingDirectiveService',
      'cancel',
    ],

    ['createFinCommanderScenario', 'finCommanderScenarioService', 'create'],
    ['findAllFinCommanderScenarios', 'finCommanderScenarioService', 'findAll'],
    ['findOneFinCommanderScenario', 'finCommanderScenarioService', 'findOne'],
    ['updateFinCommanderScenario', 'finCommanderScenarioService', 'update'],
    ['removeFinCommanderScenario', 'finCommanderScenarioService', 'remove'],
  ];

  it.each(table)(
    '%s delegates to %s.%s',
    async (handler, serviceKey, method) => {
      const payload = {
        id: 'entity-1',
        planId: 'plan-1',
        goalId: 'goal-1',
        data: { name: 'Example' },
        workspace: 'personal',
        userId: 'user-1',
        profileId: 'profile-1',
      };

      const call = (
        controller as unknown as Record<
          string,
          (p: unknown) => Promise<unknown>
        >
      )[handler];
      expect(typeof call).toBe('function');

      const result = await call.call(controller, payload);

      expect(services[serviceKey][method]).toHaveBeenCalled();
      // Each mock resolves a sentinel naming its own service and method, so a
      // handler wired to the wrong one returns the wrong string.
      expect(result).toBe(`${TOKENS[serviceKey]}:${method}`);
    }
  );

  describe('fin-commander goal handlers attach the funding directive', () => {
    const goal = { id: 'goal-1', name: 'Emergency fund' };
    const directive = { id: 'dir-1', amount: 250 };

    beforeEach(() => {
      services['finCommanderGoalService'][
        'getFundingDirective'
      ].mockResolvedValue(directive);
      services['finCommanderPlanService']['findOne'].mockResolvedValue({
        id: 'plan-1',
      });
    });

    it('decorates a created goal', async () => {
      services['finCommanderGoalService']['create'].mockResolvedValue(goal);

      const result = await controller.createFinCommanderGoal({
        planId: 'plan-1',
        name: 'Emergency fund',
        profileId: 'profile-1',
      } as never);

      expect(result).toEqual({ ...goal, fundingDirective: directive });
    });

    it('decorates every goal in a list', async () => {
      services['finCommanderGoalService']['findAll'].mockResolvedValue([
        goal,
        { id: 'goal-2' },
      ]);

      const result = (await controller.findAllFinCommanderGoals({
        profileId: 'profile-1',
      } as never)) as Array<Record<string, unknown>>;

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ ...goal, fundingDirective: directive });
      expect(result[1]).toEqual({
        id: 'goal-2',
        fundingDirective: directive,
      });
    });

    it('decorates a single goal', async () => {
      services['finCommanderGoalService']['findOne'].mockResolvedValue(goal);

      const result = await controller.findOneFinCommanderGoal({
        id: 'goal-1',
        profileId: 'profile-1',
      } as never);

      expect(result).toEqual({ ...goal, fundingDirective: directive });
    });

    it('returns null for a goal that does not exist', async () => {
      services['finCommanderGoalService']['findOne'].mockResolvedValue(null);

      const result = await controller.findOneFinCommanderGoal({
        id: 'missing',
        profileId: 'profile-1',
      } as never);

      expect(result).toBeNull();
      expect(
        services['finCommanderGoalService']['getFundingDirective']
      ).not.toHaveBeenCalled();
    });

    it('decorates an updated goal', async () => {
      services['finCommanderGoalService']['update'].mockResolvedValue(goal);

      const result = await controller.updateFinCommanderGoal({
        id: 'goal-1',
        data: { name: 'Renamed' },
        profileId: 'profile-1',
      } as never);

      expect(result).toEqual({ ...goal, fundingDirective: directive });
    });
  });

  it('reads the current tenant through the tenant service', async () => {
    const result = await controller.getCurrentTenant({
      profileId: 'profile-1',
    } as never);

    expect(
      services['financeTenantService']['getCurrentTenant']
    ).toHaveBeenCalled();
    expect(result).toEqual({ id: 'tenant-1' });
  });
});
