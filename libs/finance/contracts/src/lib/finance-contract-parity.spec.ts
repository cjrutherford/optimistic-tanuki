import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  AccountCommands,
  BudgetCommands,
  FinanceBankingCommands,
  FinanceSummaryCommands,
  FinanceTenantCommands,
  FinancialUtilitiesCommands,
  InventoryItemCommands,
  RecurringItemCommands,
  TransactionCommands,
} from '../index';
import {
  BankConnectionExchangeDto,
  BankConnectionLinkTokenDto,
  CreateAccountDto,
  CreateBudgetDto,
  CreateFinanceTenantDto,
  CreateFinanceTenantMemberDto,
  CreateFinancialCheckoutSessionDto,
  CreateFinancialInvoiceDto,
  CreateInventoryItemDto,
  CreateRecurringItemDto,
  CreateTransactionDto,
} from '../index';

/**
 * Covered mutation patterns with their contract DTO plus one valid and one
 * invalid sample. Read/update/delete patterns take `{id}`/scope,
 * `FindManyOptions`, or summary-query payloads (verified in
 * `apps/finance/src/app/app.controller.ts`) and are complete by definition —
 * listed in SCALAR_OR_EMPTY. The E3 posting extensions and E6
 * `billingInvoiceId` link are column additions that arrive with the
 * persistence moves, not new patterns.
 */
const COVERED: Array<{
  pattern: string;
  dto: new () => object;
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
  invalidProps: string[];
}> = [
  {
    pattern: AccountCommands.CREATE,
    dto: CreateAccountDto,
    valid: { name: 'Cash', type: 'cash', balance: 100, currency: 'USD' },
    invalid: { name: 'Cash', type: 'cash', balance: 100 },
    invalidProps: ['currency'],
  },
  {
    pattern: TransactionCommands.CREATE,
    dto: CreateTransactionDto,
    valid: {
      amount: 42.5,
      type: 'debit',
      category: 'food',
      accountId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      transactionDate: new Date('2026-09-01T00:00:00.000Z'),
      isRecurring: false,
    },
    invalid: {
      amount: 42.5,
      category: 'food',
      accountId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      transactionDate: new Date('2026-09-01T00:00:00.000Z'),
      isRecurring: false,
    },
    invalidProps: ['type'],
  },
  {
    pattern: BudgetCommands.CREATE,
    dto: CreateBudgetDto,
    valid: {
      name: 'Groceries',
      category: 'food',
      limit: 500,
      spent: 0,
      period: 'monthly',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T00:00:00.000Z'),
      alertOnExceed: true,
    },
    invalid: {
      name: 'Groceries',
      limit: 500,
      spent: 0,
      period: 'monthly',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T00:00:00.000Z'),
      alertOnExceed: true,
    },
    invalidProps: ['category'],
  },
  {
    pattern: RecurringItemCommands.CREATE,
    dto: CreateRecurringItemDto,
    valid: {
      name: 'Rent',
      amount: 1500,
      type: 'debit',
      cadence: 'monthly',
      nextDueDate: new Date('2026-10-01T00:00:00.000Z'),
    },
    invalid: {
      name: 'Rent',
      amount: 1500,
      type: 'debit',
      nextDueDate: new Date('2026-10-01T00:00:00.000Z'),
    },
    invalidProps: ['cadence'],
  },
  {
    pattern: InventoryItemCommands.CREATE,
    dto: CreateInventoryItemDto,
    valid: { name: 'Widget', quantity: 10, unitValue: 5, category: 'stock' },
    invalid: { name: 'Widget', quantity: 10, unitValue: 5 },
    invalidProps: ['category'],
  },
  {
    pattern: FinancialUtilitiesCommands.CREATE_INVOICE,
    dto: CreateFinancialInvoiceDto,
    valid: {
      customerName: 'Acme',
      lines: [{ description: 'Consulting', quantity: 1, unitAmount: 5000 }],
    },
    invalid: {
      lines: [{ description: 'Consulting', quantity: 1, unitAmount: 5000 }],
    },
    invalidProps: ['customerName'],
  },
  {
    pattern: FinancialUtilitiesCommands.CREATE_CHECKOUT_SESSION,
    dto: CreateFinancialCheckoutSessionDto,
    valid: { customerName: 'Acme', amount: 5000 },
    invalid: { customerName: 'Acme' },
    invalidProps: ['amount'],
  },
  {
    pattern: FinanceTenantCommands.CREATE_TENANT,
    dto: CreateFinanceTenantDto,
    valid: { name: 'Household' },
    invalid: {},
    invalidProps: ['name'],
  },
  {
    pattern: FinanceTenantCommands.CREATE_TENANT_MEMBER,
    dto: CreateFinanceTenantMemberDto,
    valid: {
      memberProfileId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11',
      role: 'finance_member',
    },
    invalid: { memberProfileId: '2d3f1f90-3ac6-4d2e-9d5e-0e4f0c9d8a11' },
    invalidProps: ['role'],
  },
  {
    pattern: FinanceBankingCommands.CREATE_LINK_TOKEN,
    dto: BankConnectionLinkTokenDto,
    valid: { provider: 'plaid' },
    invalid: {},
    invalidProps: ['provider'],
  },
  {
    pattern: FinanceBankingCommands.EXCHANGE_PUBLIC_TOKEN,
    dto: BankConnectionExchangeDto,
    valid: { publicToken: 'public-1', provider: 'plaid' },
    invalid: { provider: 'plaid' },
    invalidProps: ['publicToken'],
  },
];

/** Verified `{id}`/scope, `FindManyOptions`, or summary-query sends — complete by definition. */
const SCALAR_OR_EMPTY: string[] = [
  AccountCommands.UPDATE,
  AccountCommands.DELETE,
  AccountCommands.FIND,
  AccountCommands.FIND_MANY,
  TransactionCommands.UPDATE,
  TransactionCommands.DELETE,
  TransactionCommands.FIND,
  TransactionCommands.FIND_MANY,
  InventoryItemCommands.UPDATE,
  InventoryItemCommands.DELETE,
  InventoryItemCommands.FIND,
  InventoryItemCommands.FIND_MANY,
  BudgetCommands.UPDATE,
  BudgetCommands.DELETE,
  BudgetCommands.FIND,
  BudgetCommands.FIND_MANY,
  RecurringItemCommands.UPDATE,
  RecurringItemCommands.DELETE,
  RecurringItemCommands.FIND,
  RecurringItemCommands.FIND_MANY,
  FinanceSummaryCommands.GET_WORKSPACE_SUMMARY,
  FinanceSummaryCommands.GET_WORK_QUEUE,
  FinanceSummaryCommands.GET_ONBOARDING_STATE,
  FinanceSummaryCommands.BOOTSTRAP,
  FinanceTenantCommands.LIST_TENANTS,
  FinanceTenantCommands.GET_CURRENT_TENANT,
  FinanceTenantCommands.LIST_TENANT_MEMBERS,
  FinanceTenantCommands.UPDATE_TENANT_MEMBER,
  FinanceTenantCommands.REMOVE_TENANT_MEMBER,
  FinanceBankingCommands.LIST_CONNECTIONS,
  FinanceBankingCommands.SYNC_CONNECTION,
  FinanceBankingCommands.DISCONNECT_CONNECTION,
  FinanceBankingCommands.PROCESS_WEBHOOK,
  FinanceBankingCommands.CREATE_CONNECTION,
  FinancialUtilitiesCommands.LIST_INVOICES,
  FinancialUtilitiesCommands.GET_INVOICE,
  FinancialUtilitiesCommands.UPDATE_INVOICE,
  FinancialUtilitiesCommands.SEND_INVOICE,
  FinancialUtilitiesCommands.VOID_INVOICE,
  FinancialUtilitiesCommands.RECORD_INVOICE_PAYMENT,
  FinancialUtilitiesCommands.LIST_CHECKOUT_SESSIONS,
  FinancialUtilitiesCommands.GET_CHECKOUT_SESSION,
];

const COMMAND_OBJECTS: Record<string, Record<string, string>> = {
  AccountCommands,
  TransactionCommands,
  InventoryItemCommands,
  BudgetCommands,
  RecurringItemCommands,
  FinanceSummaryCommands,
  FinanceTenantCommands,
  FinanceBankingCommands,
  FinancialUtilitiesCommands,
};

const propsOf = (errors: ValidationError[]) =>
  errors.map((e) => e.property).sort();

describe('finance-contract-parity', () => {
  it.each(COVERED.map((c) => [c.pattern, c]))(
    'pattern %s validates its DTO both ways',
    async (_pattern, entry) => {
      const valid = plainToInstance(entry.dto, entry.valid);
      expect(await validate(valid)).toEqual([]);
      const invalid = plainToInstance(entry.dto, entry.invalid);
      expect(propsOf(await validate(invalid))).toEqual(
        [...entry.invalidProps].sort()
      );
    }
  );

  it('accounts for every key in the finance command objects', () => {
    const coveredValues = new Set(COVERED.map((c) => c.pattern));
    const allowed = new Set(SCALAR_OR_EMPTY);
    for (const commands of Object.values(COMMAND_OBJECTS)) {
      for (const value of Object.values(commands)) {
        expect(coveredValues.has(value) || allowed.has(value)).toBe(true);
      }
    }
  });
});
