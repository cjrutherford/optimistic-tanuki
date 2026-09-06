import { EMPTY, of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountCommands,
  BudgetCommands,
  FinCommanderGoalCommands,
  FinCommanderPlanCommands,
  FinCommanderProjectionCommands,
  FinCommanderScenarioCommands,
  FinanceBankingCommands,
  FinanceSummaryCommands,
  FinanceTenantCommands,
  FinancialUtilitiesCommands,
  InventoryItemCommands,
  RecurringItemCommands,
  TransactionCommands,
} from '@optimistic-tanuki/constants';
import { FinanceWorkspace } from '@optimistic-tanuki/models';
import { FinanceController } from './finance.controller';

/**
 * The spec beside this one asserts guard/permission metadata. These invoke the
 * handlers themselves: the exact message pattern and payload each one sends to
 * the finance service, how the caller scope is stamped on, and which handlers
 * translate a downstream failure into an HTTP status versus letting the raw
 * RPC error escape.
 */
describe('Gateway FinanceController handlers', () => {
  let controller: FinanceController;
  let finance: { send: jest.Mock };

  const user = { userId: 'user-1', profileId: 'profile-1' };
  const appScope = 'fin-commander';
  const tenantId = 'tenant-1';

  /** What getScope() produces for the arguments used throughout this spec. */
  const SCOPE = {
    userId: 'user-1',
    profileId: 'profile-1',
    tenantId: 'tenant-1',
    appScope: 'fin-commander',
  };

  const resolves = (value: unknown) => finance.send.mockReturnValue(of(value));
  const lastPattern = () => finance.send.mock.calls.at(-1)?.[0];
  const lastPayload = () => finance.send.mock.calls.at(-1)?.[1];

  beforeEach(() => {
    finance = { send: jest.fn().mockReturnValue(of(null)) };
    controller = new FinanceController(finance as unknown as ClientProxy);
    // Silence the per-instance logger rather than the console.
    (controller as unknown as { logger: { log: jest.Mock } }).logger = {
      log: jest.fn(),
    } as never;
  });

  afterEach(() => jest.restoreAllMocks());

  type HandlerCase = {
    name: string;
    call: (c: FinanceController) => Promise<unknown>;
    cmd: string;
    payload: unknown;
    /** A handler declared Promise<void> awaits the reply but returns nothing. */
    returnsVoid?: boolean;
  };

  const cases: HandlerCase[] = [
    // ── Accounts ────────────────────────────────────────────────────────────
    {
      name: 'createAccount merges the body with the caller scope',
      call: (c) =>
        c.createAccount(user, appScope, tenantId, { name: 'Checking' }),
      cmd: AccountCommands.CREATE,
      payload: { name: 'Checking', ...SCOPE },
    },
    {
      name: 'getAccount sends the id with the caller scope',
      call: (c) => c.getAccount(user, 'acct-1', appScope, tenantId),
      cmd: AccountCommands.FIND,
      payload: { id: 'acct-1', ...SCOPE },
    },
    {
      name: 'getAllAccounts filters by workspace when one is requested',
      call: (c) =>
        c.getAllAccounts(
          user,
          appScope,
          tenantId,
          'business' as FinanceWorkspace
        ),
      cmd: AccountCommands.FIND_MANY,
      payload: { ...SCOPE, where: { workspace: 'business' } },
    },
    {
      name: 'getAllAccounts omits the where clause with no workspace',
      call: (c) => c.getAllAccounts(user, appScope, tenantId),
      cmd: AccountCommands.FIND_MANY,
      payload: { ...SCOPE },
    },
    {
      name: 'updateAccount nests the patch under data',
      call: (c) =>
        c.updateAccount(user, 'acct-1', appScope, tenantId, {
          name: 'Renamed',
        } as never),
      cmd: AccountCommands.UPDATE,
      payload: { id: 'acct-1', data: { name: 'Renamed' }, ...SCOPE },
    },
    {
      name: 'deleteAccount sends the id with the caller scope',
      call: (c) => c.deleteAccount(user, 'acct-1', appScope, tenantId),
      cmd: AccountCommands.DELETE,
      payload: { id: 'acct-1', ...SCOPE },
    },

    // ── Transactions ────────────────────────────────────────────────────────
    {
      name: 'createTransaction merges the body with the caller scope',
      call: (c) =>
        c.createTransaction(user, appScope, tenantId, { amount: 25 }),
      cmd: TransactionCommands.CREATE,
      payload: { amount: 25, ...SCOPE },
    },
    {
      name: 'getTransaction sends the id with the caller scope',
      call: (c) => c.getTransaction(user, 'txn-1', appScope, tenantId),
      cmd: TransactionCommands.FIND,
      payload: { id: 'txn-1', ...SCOPE },
    },
    {
      name: 'getTransactionsByAccount pairs the account with the workspace',
      call: (c) =>
        c.getTransactionsByAccount(
          user,
          'acct-1',
          appScope,
          tenantId,
          'personal' as FinanceWorkspace
        ),
      cmd: TransactionCommands.FIND_MANY,
      payload: {
        ...SCOPE,
        where: { accountId: 'acct-1', workspace: 'personal' },
      },
    },
    {
      name: 'getTransactionsByAccount filters on the account alone without a workspace',
      call: (c) =>
        c.getTransactionsByAccount(user, 'acct-1', appScope, tenantId),
      cmd: TransactionCommands.FIND_MANY,
      payload: { ...SCOPE, where: { accountId: 'acct-1' } },
    },
    {
      name: 'getAllTransactions filters by workspace when one is requested',
      call: (c) =>
        c.getAllTransactions(
          user,
          appScope,
          tenantId,
          'net-worth' as FinanceWorkspace
        ),
      cmd: TransactionCommands.FIND_MANY,
      payload: { ...SCOPE, where: { workspace: 'net-worth' } },
    },
    {
      name: 'updateTransaction nests the patch under data',
      call: (c) =>
        c.updateTransaction(user, 'txn-1', appScope, tenantId, {
          amount: 42,
        } as never),
      cmd: TransactionCommands.UPDATE,
      payload: { id: 'txn-1', data: { amount: 42 }, ...SCOPE },
    },
    {
      name: 'deleteTransaction sends the id with the caller scope',
      call: (c) => c.deleteTransaction(user, 'txn-1', appScope, tenantId),
      cmd: TransactionCommands.DELETE,
      payload: { id: 'txn-1', ...SCOPE },
    },

    // ── Banking ─────────────────────────────────────────────────────────────
    {
      name: 'createBankLinkToken merges the body with the caller scope',
      call: (c) =>
        c.createBankLinkToken(user, appScope, tenantId, {
          provider: 'plaid',
        } as never),
      cmd: FinanceBankingCommands.CREATE_LINK_TOKEN,
      payload: { provider: 'plaid', ...SCOPE },
    },
    {
      name: 'connectBankProvider merges the exchange body with the caller scope',
      call: (c) =>
        c.connectBankProvider(user, appScope, tenantId, {
          publicToken: 'public-token',
        } as never),
      cmd: FinanceBankingCommands.EXCHANGE_PUBLIC_TOKEN,
      payload: { publicToken: 'public-token', ...SCOPE },
    },
    {
      name: 'listBankConnections sends only the caller scope',
      call: (c) => c.listBankConnections(user, appScope, tenantId),
      cmd: FinanceBankingCommands.LIST_CONNECTIONS,
      payload: { ...SCOPE },
    },
    {
      name: 'syncBankConnection names the connection id explicitly',
      call: (c) => c.syncBankConnection(user, 'conn-1', appScope, tenantId),
      cmd: FinanceBankingCommands.SYNC_CONNECTION,
      payload: { connectionId: 'conn-1', ...SCOPE },
    },
    {
      name: 'disconnectBankConnection names the connection id explicitly',
      call: (c) =>
        c.disconnectBankConnection(user, 'conn-1', appScope, tenantId),
      cmd: FinanceBankingCommands.DISCONNECT_CONNECTION,
      payload: { connectionId: 'conn-1', ...SCOPE },
    },
    {
      // The provider webhook is unauthenticated, so there is no caller scope to
      // stamp on: the raw body is forwarded verbatim.
      name: 'receivePlaidWebhook forwards the raw provider body with no scope',
      call: (c) =>
        c.receivePlaidWebhook({ webhook_type: 'TRANSACTIONS', item_id: 'i-1' }),
      cmd: FinanceBankingCommands.PROCESS_WEBHOOK,
      payload: { webhook_type: 'TRANSACTIONS', item_id: 'i-1' },
    },

    // ── Inventory ───────────────────────────────────────────────────────────
    {
      name: 'createInventoryItem merges the body with the caller scope',
      call: (c) =>
        c.createInventoryItem(user, appScope, tenantId, { name: 'Laptop' }),
      cmd: InventoryItemCommands.CREATE,
      payload: { name: 'Laptop', ...SCOPE },
    },
    {
      name: 'getInventoryItem sends the id with the caller scope',
      call: (c) => c.getInventoryItem(user, 'inv-1', appScope, tenantId),
      cmd: InventoryItemCommands.FIND,
      payload: { id: 'inv-1', ...SCOPE },
    },
    {
      name: 'getAllInventoryItems filters by workspace when one is requested',
      call: (c) =>
        c.getAllInventoryItems(
          user,
          appScope,
          tenantId,
          'business' as FinanceWorkspace
        ),
      cmd: InventoryItemCommands.FIND_MANY,
      payload: { ...SCOPE, where: { workspace: 'business' } },
    },
    {
      name: 'updateInventoryItem nests the patch under data',
      call: (c) =>
        c.updateInventoryItem(user, 'inv-1', appScope, tenantId, {
          name: 'Desktop',
        } as never),
      cmd: InventoryItemCommands.UPDATE,
      payload: { id: 'inv-1', data: { name: 'Desktop' }, ...SCOPE },
    },
    {
      name: 'deleteInventoryItem sends the id with the caller scope',
      call: (c) => c.deleteInventoryItem(user, 'inv-1', appScope, tenantId),
      cmd: InventoryItemCommands.DELETE,
      payload: { id: 'inv-1', ...SCOPE },
    },

    // ── Budgets and summaries ───────────────────────────────────────────────
    {
      name: 'createBudget merges the body with the caller scope',
      call: (c) => c.createBudget(user, appScope, tenantId, { limit: 500 }),
      cmd: BudgetCommands.CREATE,
      payload: { limit: 500, ...SCOPE },
    },
    {
      name: 'getBudget sends the id with the caller scope',
      call: (c) => c.getBudget(user, 'bud-1', appScope, tenantId),
      cmd: BudgetCommands.FIND,
      payload: { id: 'bud-1', ...SCOPE },
    },
    {
      name: 'getAllBudgets filters by workspace when one is requested',
      call: (c) =>
        c.getAllBudgets(
          user,
          appScope,
          tenantId,
          'personal' as FinanceWorkspace
        ),
      cmd: BudgetCommands.FIND_MANY,
      payload: { ...SCOPE, where: { workspace: 'personal' } },
    },
    {
      name: 'updateBudget nests the patch under data',
      call: (c) =>
        c.updateBudget(user, 'bud-1', appScope, tenantId, {
          limit: 900,
        } as never),
      cmd: BudgetCommands.UPDATE,
      payload: { id: 'bud-1', data: { limit: 900 }, ...SCOPE },
    },
    {
      name: 'deleteBudget sends the id with the caller scope',
      call: (c) => c.deleteBudget(user, 'bud-1', appScope, tenantId),
      cmd: BudgetCommands.DELETE,
      payload: { id: 'bud-1', ...SCOPE },
    },
    {
      name: 'getSummary names the workspace as a path parameter',
      call: (c) =>
        c.getSummary(user, 'business' as FinanceWorkspace, appScope, tenantId),
      cmd: FinanceSummaryCommands.GET_WORKSPACE_SUMMARY,
      payload: { workspace: 'business', ...SCOPE },
    },
    {
      name: 'getWorkQueue names the workspace as a path parameter',
      call: (c) =>
        c.getWorkQueue(
          user,
          'business' as FinanceWorkspace,
          appScope,
          tenantId
        ),
      cmd: FinanceSummaryCommands.GET_WORK_QUEUE,
      payload: { workspace: 'business', ...SCOPE },
    },
    {
      name: 'getOnboardingState sends only the caller scope',
      call: (c) => c.getOnboardingState(user, appScope, tenantId),
      cmd: FinanceSummaryCommands.GET_ONBOARDING_STATE,
      payload: { ...SCOPE },
    },
    {
      name: 'bootstrapWorkspaces nests the body under data',
      call: (c) =>
        c.bootstrapWorkspaces(user, appScope, tenantId, {
          workspace: 'business',
        } as never),
      cmd: FinanceSummaryCommands.BOOTSTRAP,
      payload: { data: { workspace: 'business' }, ...SCOPE },
    },

    // ── Recurring items ─────────────────────────────────────────────────────
    {
      name: 'createRecurringItem merges the body with the caller scope',
      call: (c) =>
        c.createRecurringItem(user, appScope, tenantId, { name: 'Rent' }),
      cmd: RecurringItemCommands.CREATE,
      payload: { name: 'Rent', ...SCOPE },
    },
    {
      name: 'getAllRecurringItems filters by workspace when one is requested',
      call: (c) =>
        c.getAllRecurringItems(
          user,
          appScope,
          tenantId,
          'personal' as FinanceWorkspace
        ),
      cmd: RecurringItemCommands.FIND_MANY,
      payload: { ...SCOPE, where: { workspace: 'personal' } },
    },
    {
      name: 'getRecurringItem sends the id with the caller scope',
      call: (c) => c.getRecurringItem(user, 'rec-1', appScope, tenantId),
      cmd: RecurringItemCommands.FIND,
      payload: { id: 'rec-1', ...SCOPE },
    },
    {
      name: 'updateRecurringItem nests the patch under data',
      call: (c) =>
        c.updateRecurringItem(user, 'rec-1', appScope, tenantId, {
          name: 'Mortgage',
        } as never),
      cmd: RecurringItemCommands.UPDATE,
      payload: { id: 'rec-1', data: { name: 'Mortgage' }, ...SCOPE },
    },
    {
      name: 'deleteRecurringItem sends the id with the caller scope',
      call: (c) => c.deleteRecurringItem(user, 'rec-1', appScope, tenantId),
      cmd: RecurringItemCommands.DELETE,
      payload: { id: 'rec-1', ...SCOPE },
    },

    // ── Invoices ────────────────────────────────────────────────────────────
    {
      name: 'createInvoice merges the body with the caller scope',
      call: (c) =>
        c.createInvoice(user, appScope, tenantId, {
          customerName: 'Acme',
        } as never),
      cmd: FinancialUtilitiesCommands.CREATE_INVOICE,
      payload: { customerName: 'Acme', ...SCOPE },
    },
    {
      name: 'listInvoices filters by workspace when one is requested',
      call: (c) =>
        c.listInvoices(
          user,
          appScope,
          tenantId,
          'business' as FinanceWorkspace
        ),
      cmd: FinancialUtilitiesCommands.LIST_INVOICES,
      payload: { ...SCOPE, where: { workspace: 'business' } },
    },
    {
      name: 'getInvoice sends the id with the caller scope',
      call: (c) => c.getInvoice(user, 'inv-9', appScope, tenantId),
      cmd: FinancialUtilitiesCommands.GET_INVOICE,
      payload: { id: 'inv-9', ...SCOPE },
    },
    {
      name: 'updateInvoice nests the patch under data',
      call: (c) =>
        c.updateInvoice(user, 'inv-9', appScope, tenantId, {
          notes: 'Updated',
        } as never),
      cmd: FinancialUtilitiesCommands.UPDATE_INVOICE,
      payload: { id: 'inv-9', data: { notes: 'Updated' }, ...SCOPE },
    },
    {
      name: 'sendInvoice sends the id with the caller scope',
      call: (c) => c.sendInvoice(user, 'inv-9', appScope, tenantId),
      cmd: FinancialUtilitiesCommands.SEND_INVOICE,
      payload: { id: 'inv-9', ...SCOPE },
    },
    {
      name: 'voidInvoice sends the id with the caller scope',
      call: (c) => c.voidInvoice(user, 'inv-9', appScope, tenantId),
      cmd: FinancialUtilitiesCommands.VOID_INVOICE,
      payload: { id: 'inv-9', ...SCOPE },
    },
    {
      name: 'recordInvoicePayment nests the payment under data',
      call: (c) =>
        c.recordInvoicePayment(user, 'inv-9', appScope, tenantId, {
          amountCents: 100,
        } as never),
      cmd: FinancialUtilitiesCommands.RECORD_INVOICE_PAYMENT,
      payload: { id: 'inv-9', data: { amountCents: 100 }, ...SCOPE },
    },

    // ── Checkout sessions ───────────────────────────────────────────────────
    {
      name: 'createCheckoutSession merges the body with the caller scope',
      call: (c) =>
        c.createCheckoutSession(user, appScope, tenantId, {
          amountCents: 5000,
        } as never),
      cmd: FinancialUtilitiesCommands.CREATE_CHECKOUT_SESSION,
      payload: { amountCents: 5000, ...SCOPE },
    },
    {
      name: 'listCheckoutSessions filters by workspace when one is requested',
      call: (c) =>
        c.listCheckoutSessions(
          user,
          appScope,
          tenantId,
          'business' as FinanceWorkspace
        ),
      cmd: FinancialUtilitiesCommands.LIST_CHECKOUT_SESSIONS,
      payload: { ...SCOPE, where: { workspace: 'business' } },
    },
    {
      name: 'getCheckoutSession sends the id with the caller scope',
      call: (c) => c.getCheckoutSession(user, 'cs-1', appScope, tenantId),
      cmd: FinancialUtilitiesCommands.GET_CHECKOUT_SESSION,
      payload: { id: 'cs-1', ...SCOPE },
    },

    // ── Tenants ─────────────────────────────────────────────────────────────
    {
      // createTenant/listTenants take no tenant id: a tenant cannot be scoped
      // to itself before it exists, so the payload carries no tenantId.
      name: 'createTenant scopes the new tenant to the caller alone',
      call: (c) => c.createTenant(user, appScope, { name: 'Acme' } as never),
      cmd: FinanceTenantCommands.CREATE_TENANT,
      payload: {
        name: 'Acme',
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'fin-commander',
      },
    },
    {
      name: 'listTenants sends the caller scope without a tenant id',
      call: (c) => c.listTenants(user, appScope),
      cmd: FinanceTenantCommands.LIST_TENANTS,
      payload: {
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'fin-commander',
      },
    },
    {
      name: 'getCurrentTenant sends the caller scope including the tenant id',
      call: (c) => c.getCurrentTenant(user, appScope, tenantId),
      cmd: FinanceTenantCommands.GET_CURRENT_TENANT,
      payload: { ...SCOPE },
    },
    {
      name: 'listTenantMembers sends only the caller scope',
      call: (c) => c.listTenantMembers(user, appScope, tenantId),
      cmd: FinanceTenantCommands.LIST_TENANT_MEMBERS,
      payload: { ...SCOPE },
    },
    {
      name: 'createTenantMember merges the body with the caller scope',
      call: (c) =>
        c.createTenantMember(user, appScope, tenantId, {
          email: 'member@example.com',
        } as never),
      cmd: FinanceTenantCommands.CREATE_TENANT_MEMBER,
      payload: { email: 'member@example.com', ...SCOPE },
    },
    {
      name: 'updateTenantMember names the member id explicitly',
      call: (c) =>
        c.updateTenantMember(user, appScope, tenantId, 'member-1', {
          role: 'admin',
        } as never),
      cmd: FinanceTenantCommands.UPDATE_TENANT_MEMBER,
      payload: { role: 'admin', memberId: 'member-1', ...SCOPE },
    },
    {
      name: 'removeTenantMember names the member id explicitly',
      call: (c) => c.removeTenantMember(user, appScope, tenantId, 'member-1'),
      cmd: FinanceTenantCommands.REMOVE_TENANT_MEMBER,
      payload: { memberId: 'member-1', ...SCOPE },
      returnsVoid: true,
    },

    // ── Fin Commander plans ─────────────────────────────────────────────────
    {
      name: 'createFinCommanderPlan merges the body with the caller scope',
      call: (c) =>
        c.createFinCommanderPlan(user, appScope, tenantId, { name: 'Plan A' }),
      cmd: FinCommanderPlanCommands.CREATE,
      payload: { name: 'Plan A', ...SCOPE },
    },
    {
      name: 'listFinCommanderPlans sends only the caller scope',
      call: (c) => c.listFinCommanderPlans(user, appScope, tenantId),
      cmd: FinCommanderPlanCommands.FIND_MANY,
      payload: { ...SCOPE },
    },
    {
      name: 'getFinCommanderCashFlowProjection names the plan id',
      call: (c) =>
        c.getFinCommanderCashFlowProjection(user, 'plan-1', appScope, tenantId),
      cmd: FinCommanderProjectionCommands.GET,
      payload: { planId: 'plan-1', ...SCOPE },
    },
    {
      name: 'getFinCommanderPlan sends the id with the caller scope',
      call: (c) => c.getFinCommanderPlan(user, 'plan-1', appScope, tenantId),
      cmd: FinCommanderPlanCommands.FIND,
      payload: { id: 'plan-1', ...SCOPE },
    },
    {
      name: 'updateFinCommanderPlan nests the patch under data',
      call: (c) =>
        c.updateFinCommanderPlan(user, 'plan-1', appScope, tenantId, {
          name: 'Plan B',
        } as never),
      cmd: FinCommanderPlanCommands.UPDATE,
      payload: { id: 'plan-1', data: { name: 'Plan B' }, ...SCOPE },
    },
    {
      name: 'deleteFinCommanderPlan sends the id with the caller scope',
      call: (c) => c.deleteFinCommanderPlan(user, 'plan-1', appScope, tenantId),
      cmd: FinCommanderPlanCommands.DELETE,
      payload: { id: 'plan-1', ...SCOPE },
    },

    // ── Fin Commander goals ─────────────────────────────────────────────────
    {
      name: 'createFinCommanderGoal stamps the plan id from the route',
      call: (c) =>
        c.createFinCommanderGoal(user, 'plan-1', appScope, tenantId, {
          name: 'Emergency fund',
        }),
      cmd: FinCommanderGoalCommands.CREATE,
      payload: { name: 'Emergency fund', planId: 'plan-1', ...SCOPE },
    },
    {
      name: 'listFinCommanderGoals filters on the plan id',
      call: (c) => c.listFinCommanderGoals(user, 'plan-1', appScope, tenantId),
      cmd: FinCommanderGoalCommands.FIND_MANY,
      payload: { ...SCOPE, where: { planId: 'plan-1' } },
    },
    {
      name: 'getFinCommanderGoal sends the id with the caller scope',
      call: (c) => c.getFinCommanderGoal(user, 'goal-1', appScope, tenantId),
      cmd: FinCommanderGoalCommands.FIND,
      payload: { id: 'goal-1', ...SCOPE },
    },
    {
      name: 'previewFinCommanderFundingDirective names the goal id',
      call: (c) =>
        c.previewFinCommanderFundingDirective(
          user,
          'goal-1',
          appScope,
          tenantId
        ),
      cmd: FinCommanderGoalCommands.FUNDING_DIRECTIVE_PREVIEW,
      payload: { goalId: 'goal-1', ...SCOPE },
    },
    {
      name: 'approveFinCommanderFundingDirective names the goal id',
      call: (c) =>
        c.approveFinCommanderFundingDirective(
          user,
          'goal-1',
          appScope,
          tenantId
        ),
      cmd: FinCommanderGoalCommands.FUNDING_DIRECTIVE_APPROVE,
      payload: { goalId: 'goal-1', ...SCOPE },
    },
    {
      name: 'cancelFinCommanderFundingDirective names the goal id',
      call: (c) =>
        c.cancelFinCommanderFundingDirective(
          user,
          'goal-1',
          appScope,
          tenantId
        ),
      cmd: FinCommanderGoalCommands.FUNDING_DIRECTIVE_CANCEL,
      payload: { goalId: 'goal-1', ...SCOPE },
    },
    {
      name: 'updateFinCommanderGoal nests the patch under data',
      call: (c) =>
        c.updateFinCommanderGoal(user, 'goal-1', appScope, tenantId, {
          name: 'Bigger fund',
        } as never),
      cmd: FinCommanderGoalCommands.UPDATE,
      payload: { id: 'goal-1', data: { name: 'Bigger fund' }, ...SCOPE },
    },
    {
      name: 'deleteFinCommanderGoal sends the id with the caller scope',
      call: (c) => c.deleteFinCommanderGoal(user, 'goal-1', appScope, tenantId),
      cmd: FinCommanderGoalCommands.DELETE,
      payload: { id: 'goal-1', ...SCOPE },
    },

    // ── Fin Commander scenarios ─────────────────────────────────────────────
    {
      name: 'createFinCommanderScenario stamps the plan id from the route',
      call: (c) =>
        c.createFinCommanderScenario(user, 'plan-1', appScope, tenantId, {
          name: 'Downturn',
        }),
      cmd: FinCommanderScenarioCommands.CREATE,
      payload: { name: 'Downturn', planId: 'plan-1', ...SCOPE },
    },
    {
      name: 'listFinCommanderScenarios filters on the plan id',
      call: (c) =>
        c.listFinCommanderScenarios(user, 'plan-1', appScope, tenantId),
      cmd: FinCommanderScenarioCommands.FIND_MANY,
      payload: { ...SCOPE, where: { planId: 'plan-1' } },
    },
    {
      name: 'getFinCommanderScenario sends the id with the caller scope',
      call: (c) => c.getFinCommanderScenario(user, 'scn-1', appScope, tenantId),
      cmd: FinCommanderScenarioCommands.FIND,
      payload: { id: 'scn-1', ...SCOPE },
    },
    {
      name: 'updateFinCommanderScenario nests the patch under data',
      call: (c) =>
        c.updateFinCommanderScenario(user, 'scn-1', appScope, tenantId, {
          name: 'Upside',
        } as never),
      cmd: FinCommanderScenarioCommands.UPDATE,
      payload: { id: 'scn-1', data: { name: 'Upside' }, ...SCOPE },
    },
    {
      name: 'deleteFinCommanderScenario sends the id with the caller scope',
      call: (c) =>
        c.deleteFinCommanderScenario(user, 'scn-1', appScope, tenantId),
      cmd: FinCommanderScenarioCommands.DELETE,
      payload: { id: 'scn-1', ...SCOPE },
    },
  ];

  describe.each(cases)('$name', ({ call, cmd, payload, returnsVoid }) => {
    it('sends the expected pattern and payload and returns the reply', async () => {
      resolves({ ok: true });

      const result = await call(controller);

      expect(lastPattern()).toEqual({ cmd });
      expect(lastPayload()).toEqual(payload);
      if (returnsVoid) {
        expect(result).toBeUndefined();
      } else {
        expect(result).toEqual({ ok: true });
      }
    });
  });

  describe('scope defaults', () => {
    it("falls back to the 'finance' app scope when the request carries none", async () => {
      resolves([]);

      await controller.getAllAccounts(user, undefined as never, 'tenant-1');

      expect(lastPayload()).toEqual({
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      });
    });

    it('omits tenantId entirely when the request carries no tenant header', async () => {
      resolves([]);

      await controller.getAllAccounts(user, appScope, null);

      expect(lastPayload()).toEqual({
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'fin-commander',
      });
      expect(lastPayload()).not.toHaveProperty('tenantId');
    });
  });

  describe('delete handlers tolerate an empty reply', () => {
    it('deleteAccount resolves to undefined when the service completes without emitting', async () => {
      finance.send.mockReturnValue(EMPTY);

      await expect(
        controller.deleteAccount(user, 'acct-1', appScope, tenantId)
      ).resolves.toBeUndefined();
    });

    it('removeTenantMember resolves to undefined when the service completes without emitting', async () => {
      finance.send.mockReturnValue(EMPTY);

      await expect(
        controller.removeTenantMember(user, appScope, tenantId, 'member-1')
      ).resolves.toBeUndefined();
    });
  });

  describe('error handling differs by handler', () => {
    // Handlers routed through sendFinanceCommand() translate the RPC error into
    // an HTTP status; the ones that call firstValueFrom(send(...)) directly do
    // not, so the raw error object reaches the caller unchanged.
    it('maps a 400 from the finance service to BadRequestException', async () => {
      finance.send.mockReturnValue(
        throwError(() => ({ statusCode: 400, message: 'bad invoice' }))
      );

      await expect(
        controller.getInvoice(user, 'inv-9', appScope, tenantId)
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps a 404 from the finance service to NotFoundException', async () => {
      finance.send.mockReturnValue(
        throwError(() => ({ statusCode: 404, message: 'no such invoice' }))
      );

      await expect(
        controller.getInvoice(user, 'inv-9', appScope, tenantId)
      ).rejects.toThrow(new NotFoundException('no such invoice').message);
    });

    it('maps any other status to InternalServerErrorException', async () => {
      finance.send.mockReturnValue(
        throwError(() => ({ statusCode: 503, message: 'unavailable' }))
      );

      await expect(
        controller.getInvoice(user, 'inv-9', appScope, tenantId)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('joins an array of validation messages into one message', async () => {
      finance.send.mockReturnValue(
        throwError(() => ({
          statusCode: 400,
          message: ['amount must be positive', 'currency is required'],
        }))
      );

      await expect(
        controller.createInvoice(user, appScope, tenantId, {} as never)
      ).rejects.toThrow('amount must be positive, currency is required');
    });

    it('uses the message of a plain Error', async () => {
      finance.send.mockReturnValue(
        throwError(() => new Error('socket hang up'))
      );

      await expect(
        controller.listInvoices(user, appScope, tenantId)
      ).rejects.toThrow('socket hang up');
    });

    it('falls back to a generic message for a non-object failure', async () => {
      finance.send.mockReturnValue(throwError(() => 'nope'));

      await expect(
        controller.listInvoices(user, appScope, tenantId)
      ).rejects.toThrow('Finance service request failed');
    });

    it('rethrows an HttpException from the service untouched', async () => {
      const forbidden = new ForbiddenException('not your tenant');
      finance.send.mockReturnValue(throwError(() => forbidden));

      await expect(
        controller.listTenantMembers(user, appScope, tenantId)
      ).rejects.toBe(forbidden);
    });

    it('maps the error for removeTenantMember too', async () => {
      finance.send.mockReturnValue(
        throwError(() => ({ statusCode: 404, message: 'no such member' }))
      );

      await expect(
        controller.removeTenantMember(user, appScope, tenantId, 'member-1')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets the raw RPC error escape from handlers that skip the mapper', async () => {
      const raw = { statusCode: 404, message: 'no such account' };
      finance.send.mockReturnValue(throwError(() => raw));

      // getAccount uses firstValueFrom(send(...)) directly, so unlike
      // getInvoice it does NOT become a NotFoundException here.
      await expect(
        controller.getAccount(user, 'acct-1', appScope, tenantId)
      ).rejects.toBe(raw);
    });
  });
});
