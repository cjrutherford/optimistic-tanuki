import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FinanceService } from './finance.service';

/**
 * Covers the request surface (verb, URL, payload shaping) plus the three
 * pieces of real logic in the service: the undefined-stripping applied to
 * update payloads, the spent-per-budget aggregation in getBudgets, and the
 * category collation in getCategorySuggestions.
 */
describe('FinanceService API surface', () => {
  let service: FinanceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FinanceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('workspace query', () => {
    it('appends the workspace when one is given', async () => {
      const promise = service.getAccounts('business');
      http.expectOne('/api/finance/accounts?workspace=business').flush([]);
      await expect(promise).resolves.toEqual([]);
    });

    it('omits the query entirely when no workspace is given', async () => {
      const promise = service.getAccounts();
      const request = http.expectOne('/api/finance/accounts');
      expect(request.request.urlWithParams).toBe('/api/finance/accounts');
      request.flush([]);
      await expect(promise).resolves.toEqual([]);
    });
  });

  describe('accounts', () => {
    it('creates an account', async () => {
      const promise = service.createAccount({
        name: 'Checking',
        type: 'asset',
      } as never);
      const request = http.expectOne('/api/finance/account');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ name: 'Checking', type: 'asset' });
      request.flush({ id: 'acc-1' });
      await expect(promise).resolves.toEqual({ id: 'acc-1' });
    });

    it('fetches a single account by id', async () => {
      const promise = service.getAccount('acc-1');
      const request = http.expectOne('/api/finance/account/acc-1');
      expect(request.request.method).toBe('GET');
      request.flush({ id: 'acc-1' });
      await expect(promise).resolves.toEqual({ id: 'acc-1' });
    });

    it('strips undefined fields from the update payload', async () => {
      const promise = service.updateAccount('acc-1', {
        name: 'Renamed',
        balance: 0,
        isActive: false,
      } as never);

      const request = http.expectOne('/api/finance/account/acc-1');
      expect(request.request.method).toBe('PUT');
      // Only the three supplied keys survive; the other eight are dropped
      // rather than sent as explicit nulls.
      expect(request.request.body).toEqual({
        name: 'Renamed',
        balance: 0,
        isActive: false,
      });
      request.flush({ id: 'acc-1' });
      await promise;
    });

    it('deletes an account', async () => {
      const promise = service.deleteAccount('acc-1');
      const request = http.expectOne('/api/finance/account/acc-1');
      expect(request.request.method).toBe('DELETE');
      request.flush(null);
      await promise;
    });
  });

  describe('transactions', () => {
    it('creates a transaction', async () => {
      const promise = service.createTransaction({ amount: 10 } as never);
      const request = http.expectOne('/api/finance/transaction');
      expect(request.request.method).toBe('POST');
      request.flush({ id: 'txn-1' });
      await expect(promise).resolves.toEqual({ id: 'txn-1' });
    });

    it('fetches a transaction by id', async () => {
      const promise = service.getTransaction('txn-1');
      http.expectOne('/api/finance/transaction/txn-1').flush({ id: 'txn-1' });
      await expect(promise).resolves.toEqual({ id: 'txn-1' });
    });

    it('scopes transactions to an account and workspace', async () => {
      const promise = service.getTransactionsByAccount('acc-1', 'personal');
      http
        .expectOne('/api/finance/account/acc-1/transactions?workspace=personal')
        .flush([]);
      await expect(promise).resolves.toEqual([]);
    });

    it('strips undefined fields from the update payload', async () => {
      const promise = service.updateTransaction('txn-1', {
        amount: 25,
        pending: false,
      } as never);

      const request = http.expectOne('/api/finance/transaction/txn-1');
      expect(request.request.body).toEqual({ amount: 25, pending: false });
      request.flush({ id: 'txn-1' });
      await promise;
    });

    it('deletes a transaction', async () => {
      const promise = service.deleteTransaction('txn-1');
      const request = http.expectOne('/api/finance/transaction/txn-1');
      expect(request.request.method).toBe('DELETE');
      request.flush(null);
      await promise;
    });
  });

  describe('bank connections', () => {
    it('requests a link token', async () => {
      const promise = service.createBankLinkToken({ provider: 'plaid' });
      const request = http.expectOne('/api/finance/bank/link-token');
      expect(request.request.body).toEqual({ provider: 'plaid' });
      request.flush({ linkToken: 'tok' });
      await expect(promise).resolves.toEqual({ linkToken: 'tok' });
    });

    it('connects a provider', async () => {
      const promise = service.connectBankProvider({
        provider: 'plaid',
        publicToken: 'public-tok',
      });
      const request = http.expectOne('/api/finance/bank/connect');
      expect(request.request.method).toBe('POST');
      request.flush({ id: 'conn-1' });
      await expect(promise).resolves.toEqual({ id: 'conn-1' });
    });

    it('lists connections', async () => {
      const promise = service.getBankConnections();
      http.expectOne('/api/finance/bank/connections').flush([]);
      await expect(promise).resolves.toEqual([]);
    });

    it('syncs a connection', async () => {
      const promise = service.syncBankConnection('conn-1');
      const request = http.expectOne(
        '/api/finance/bank/connection/conn-1/sync'
      );
      expect(request.request.method).toBe('POST');
      request.flush({ added: 2, modified: 1, removed: 0 });
      await expect(promise).resolves.toEqual({
        added: 2,
        modified: 1,
        removed: 0,
      });
    });

    it('disconnects a connection', async () => {
      const promise = service.disconnectBankConnection('conn-1');
      const request = http.expectOne('/api/finance/bank/connection/conn-1');
      expect(request.request.method).toBe('DELETE');
      request.flush({ id: 'conn-1' });
      await promise;
    });
  });

  describe('inventory items', () => {
    it('creates, reads and lists items', async () => {
      const created = service.createInventoryItem({ name: 'Flour' } as never);
      http.expectOne('/api/finance/inventory-item').flush({ id: 'inv-1' });
      await expect(created).resolves.toEqual({ id: 'inv-1' });

      const read = service.getInventoryItem('inv-1');
      http
        .expectOne('/api/finance/inventory-item/inv-1')
        .flush({ id: 'inv-1' });
      await read;

      const listed = service.getInventoryItems('business');
      http
        .expectOne('/api/finance/inventory-items?workspace=business')
        .flush([]);
      await expect(listed).resolves.toEqual([]);
    });

    it('strips undefined fields from the update payload', async () => {
      const promise = service.updateInventoryItem('inv-1', {
        quantity: 5,
      } as never);
      const request = http.expectOne('/api/finance/inventory-item/inv-1');
      expect(request.request.body).toEqual({ quantity: 5 });
      request.flush({ id: 'inv-1' });
      await promise;
    });

    it('deletes an item', async () => {
      const promise = service.deleteInventoryItem('inv-1');
      const request = http.expectOne('/api/finance/inventory-item/inv-1');
      expect(request.request.method).toBe('DELETE');
      request.flush(null);
      await promise;
    });
  });

  describe('budgets', () => {
    it('creates and reads a budget', async () => {
      const created = service.createBudget({ name: 'Groceries' } as never);
      http.expectOne('/api/finance/budget').flush({ id: 'bud-1' });
      await created;

      const read = service.getBudget('bud-1');
      http.expectOne('/api/finance/budget/bud-1').flush({ id: 'bud-1' });
      await expect(read).resolves.toEqual({ id: 'bud-1' });
    });

    it('totals debit transactions into each budget as spent', async () => {
      const promise = service.getBudgets('personal');

      http.expectOne('/api/finance/budgets?workspace=personal').flush([
        { id: 'bud-1', category: 'Groceries', limit: 500 },
        { id: 'bud-2', category: 'Travel', limit: 300 },
      ]);
      http.expectOne('/api/finance/transactions?workspace=personal').flush([
        { type: 'debit', category: 'groceries', amount: 40 },
        { type: 'debit', category: '  GROCERIES  ', amount: 10 },
        { type: 'credit', category: 'groceries', amount: 999 },
        { type: 'debit', category: 'travel', amount: 25 },
        { type: 'debit', category: 'unmatched', amount: 77 },
      ]);

      const budgets = await promise;
      // Category matching is trimmed and case-insensitive; credits are ignored.
      expect(budgets[0]).toMatchObject({ id: 'bud-1', spent: 50 });
      expect(budgets[1]).toMatchObject({ id: 'bud-2', spent: 25 });
    });

    it('coerces string amounts when totalling', async () => {
      const promise = service.getBudgets();

      http
        .expectOne('/api/finance/budgets')
        .flush([{ id: 'bud-1', category: 'Food' }]);
      http.expectOne('/api/finance/transactions').flush([
        { type: 'debit', category: 'food', amount: '12.50' },
        { type: 'debit', category: 'food', amount: '7.50' },
      ]);

      const budgets = await promise;
      expect(budgets[0]).toMatchObject({ spent: 20 });
    });

    it('reports zero spent when nothing matches', async () => {
      const promise = service.getBudgets();

      http
        .expectOne('/api/finance/budgets')
        .flush([{ id: 'bud-1', category: 'Rent' }]);
      http.expectOne('/api/finance/transactions').flush([]);

      const budgets = await promise;
      expect(budgets[0]).toMatchObject({ spent: 0 });
    });

    it('treats a null budget category as the empty category', async () => {
      const promise = service.getBudgets();

      http
        .expectOne('/api/finance/budgets')
        .flush([{ id: 'bud-1', category: null }]);
      http.expectOne('/api/finance/transactions').flush([
        { type: 'debit', category: null, amount: 5 },
        { type: 'debit', category: 'other', amount: 100 },
      ]);

      const budgets = await promise;
      expect(budgets[0]).toMatchObject({ spent: 5 });
    });

    it('strips undefined fields from the update payload', async () => {
      const promise = service.updateBudget('bud-1', { limit: 100 } as never);
      const request = http.expectOne('/api/finance/budget/bud-1');
      expect(request.request.body).toEqual({ limit: 100 });
      request.flush({ id: 'bud-1' });
      await promise;
    });

    it('deletes a budget', async () => {
      const promise = service.deleteBudget('bud-1');
      const request = http.expectOne('/api/finance/budget/bud-1');
      expect(request.request.method).toBe('DELETE');
      request.flush(null);
      await promise;
    });
  });

  describe('workspace reporting and onboarding', () => {
    it('reads the workspace summary', async () => {
      const promise = service.getWorkspaceSummary('business');
      http.expectOne('/api/finance/summary/business').flush({ netWorth: 1 });
      await expect(promise).resolves.toEqual({ netWorth: 1 });
    });

    it('reads the work queue', async () => {
      const promise = service.getWorkQueue('personal');
      http.expectOne('/api/finance/work-queue/personal').flush({ items: [] });
      await expect(promise).resolves.toEqual({ items: [] });
    });

    it('reads onboarding state', async () => {
      const promise = service.getOnboardingState();
      http.expectOne('/api/finance/onboarding/state').flush({ ready: true });
      await expect(promise).resolves.toEqual({ ready: true });
    });

    it('bootstraps the requested workspaces', async () => {
      const promise = service.bootstrapWorkspaces(['personal', 'business']);
      const request = http.expectOne('/api/finance/onboarding/bootstrap');
      expect(request.request.body).toEqual({
        workspaces: ['personal', 'business'],
      });
      request.flush({ ready: true });
      await promise;
    });
  });

  describe('recurring items', () => {
    it('creates and lists recurring items', async () => {
      const created = service.createRecurringItem({ name: 'Rent' } as never);
      http.expectOne('/api/finance/recurring-item').flush({ id: 'rec-1' });
      await created;

      const listed = service.getRecurringItems('personal');
      http
        .expectOne('/api/finance/recurring-items?workspace=personal')
        .flush([]);
      await expect(listed).resolves.toEqual([]);
    });

    it('strips undefined fields from the update payload', async () => {
      const promise = service.updateRecurringItem('rec-1', {
        cadence: 'monthly',
      } as never);
      const request = http.expectOne('/api/finance/recurring-item/rec-1');
      expect(request.request.body).toEqual({ cadence: 'monthly' });
      request.flush({ id: 'rec-1' });
      await promise;
    });

    it('deletes a recurring item', async () => {
      const promise = service.deleteRecurringItem('rec-1');
      const request = http.expectOne('/api/finance/recurring-item/rec-1');
      expect(request.request.method).toBe('DELETE');
      request.flush(null);
      await promise;
    });
  });

  describe('tenants', () => {
    it('reads the current tenant and the tenant list', async () => {
      const current = service.getCurrentTenant();
      http.expectOne('/api/finance/tenant/current').flush({ id: 'ten-1' });
      await expect(current).resolves.toEqual({ id: 'ten-1' });

      const all = service.getTenants();
      http.expectOne('/api/finance/tenant').flush([]);
      await expect(all).resolves.toEqual([]);
    });

    it('creates a tenant', async () => {
      const promise = service.createTenant({ name: 'Acme' });
      const request = http.expectOne('/api/finance/tenant');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ name: 'Acme' });
      request.flush({ id: 'ten-1' });
      await promise;
    });

    it('manages members', async () => {
      const listed = service.getTenantMembers();
      http.expectOne('/api/finance/tenant/members').flush([]);
      await expect(listed).resolves.toEqual([]);

      const added = service.addTenantMember({
        memberProfileId: 'prof-1',
        role: 'finance_member',
      });
      const addReq = http.expectOne('/api/finance/tenant/members');
      expect(addReq.request.method).toBe('POST');
      addReq.flush({ id: 'mem-1' });
      await added;

      const updated = service.updateTenantMemberRole('mem-1', 'finance_admin');
      const updateReq = http.expectOne('/api/finance/tenant/members/mem-1');
      expect(updateReq.request.method).toBe('PUT');
      expect(updateReq.request.body).toEqual({ role: 'finance_admin' });
      updateReq.flush({ id: 'mem-1' });
      await updated;

      const removed = service.removeTenantMember('mem-1');
      const removeReq = http.expectOne('/api/finance/tenant/members/mem-1');
      expect(removeReq.request.method).toBe('DELETE');
      removeReq.flush(null);
      await removed;
    });
  });

  describe('getCategorySuggestions', () => {
    const flushSources = (opts: {
      transactions: unknown[];
      budgets: unknown[];
      recurring?: unknown[];
      workspace: string;
    }) => {
      // getBudgets internally re-fetches transactions, so two identical
      // transaction requests are in flight.
      const txnRequests = http.match(
        `/api/finance/transactions?workspace=${opts.workspace}`
      );
      txnRequests.forEach((r) => r.flush(opts.transactions));
      http
        .expectOne(`/api/finance/budgets?workspace=${opts.workspace}`)
        .flush(opts.budgets);
      if (opts.recurring) {
        http
          .expectOne(`/api/finance/recurring-items?workspace=${opts.workspace}`)
          .flush(opts.recurring);
      }
    };

    it('collates, de-duplicates and sorts categories across sources', async () => {
      const promise = service.getCategorySuggestions('personal');
      await Promise.resolve();

      flushSources({
        workspace: 'personal',
        transactions: [{ category: 'Travel' }, { category: 'Food' }],
        budgets: [{ category: 'Food' }],
        recurring: [{ category: 'Rent' }],
      });

      await expect(promise).resolves.toEqual(['Food', 'Rent', 'Travel']);
    });

    it('trims categories and drops blank ones', async () => {
      const promise = service.getCategorySuggestions('personal');
      await Promise.resolve();

      flushSources({
        workspace: 'personal',
        transactions: [
          { category: '  Utilities  ' },
          { category: '' },
          { category: null },
          {},
        ],
        budgets: [],
        recurring: [],
      });

      await expect(promise).resolves.toEqual(['Utilities']);
    });

    it('skips recurring items for the net-worth workspace', async () => {
      const promise = service.getCategorySuggestions('net-worth');
      await Promise.resolve();

      flushSources({
        workspace: 'net-worth',
        transactions: [{ category: 'Assets' }],
        budgets: [],
      });

      await expect(promise).resolves.toEqual(['Assets']);
      // No recurring-items call is made at all for this workspace.
      http.expectNone('/api/finance/recurring-items?workspace=net-worth');
    });
  });

  describe('invoices', () => {
    it('reads a single invoice', async () => {
      const promise = service.getInvoice('inv-1');
      http.expectOne('/api/finance/invoice/inv-1').flush({ id: 'inv-1' });
      await expect(promise).resolves.toEqual({ id: 'inv-1' });
    });

    it('creates and updates an invoice', async () => {
      const created = service.createInvoice({ amount: 100 } as never);
      const createReq = http.expectOne('/api/finance/invoices');
      expect(createReq.request.method).toBe('POST');
      createReq.flush({ id: 'inv-1' });
      await created;

      const updated = service.updateInvoice('inv-1', { amount: 150 } as never);
      const updateReq = http.expectOne('/api/finance/invoice/inv-1');
      expect(updateReq.request.method).toBe('PUT');
      expect(updateReq.request.body).toEqual({ amount: 150 });
      updateReq.flush({ id: 'inv-1' });
      await updated;
    });

    it('sends, voids and records payment against an invoice', async () => {
      const sent = service.sendInvoice('inv-1');
      http.expectOne('/api/finance/invoice/inv-1/send').flush({ id: 'inv-1' });
      await sent;

      const voided = service.voidInvoice('inv-1');
      http.expectOne('/api/finance/invoice/inv-1/void').flush({ id: 'inv-1' });
      await voided;

      const paid = service.recordInvoicePayment('inv-1', {
        amount: 50,
      } as never);
      const payReq = http.expectOne('/api/finance/invoice/inv-1/pay');
      expect(payReq.request.body).toEqual({ amount: 50 });
      payReq.flush({ id: 'inv-1' });
      await paid;
    });
  });

  describe('checkout sessions', () => {
    it('lists sessions for a workspace', async () => {
      const promise = service.getCheckoutSessions('business');
      http
        .expectOne('/api/finance/checkout-sessions?workspace=business')
        .flush([]);
      await expect(promise).resolves.toEqual([]);
    });
  });
});
