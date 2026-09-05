import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TransactionListComponent } from './transaction-list.component';
import { FinanceService } from '../services/finance.service';
import type { Transaction } from '../models';

/**
 * Built through runInInjectionContext rather than createComponent: these
 * exercise the component's logic, not its ag-grid template.
 */
describe('TransactionListComponent behaviour', () => {
  let component: TransactionListComponent;
  let finance: {
    getTransactions: jest.Mock;
    getAccounts: jest.Mock;
    getCategorySuggestions: jest.Mock;
    createTransaction: jest.Mock;
    updateTransaction: jest.Mock;
    deleteTransaction: jest.Mock;
  };
  let workspaceParam: string | null;

  const txn = (overrides: Partial<Transaction> = {}): Transaction =>
    ({
      id: 'txn-1',
      accountId: 'acc-1',
      amount: 10,
      type: 'debit',
      category: 'food',
      isRecurring: false,
      transactionDate: '2026-03-04T00:00:00.000Z',
      ...overrides,
    } as Transaction);

  beforeEach(() => {
    workspaceParam = 'business';
    finance = {
      getTransactions: jest.fn().mockResolvedValue([]),
      getAccounts: jest.fn().mockResolvedValue([]),
      getCategorySuggestions: jest.fn().mockResolvedValue([]),
      createTransaction: jest.fn().mockResolvedValue({}),
      updateTransaction: jest.fn().mockResolvedValue({}),
      deleteTransaction: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: FinanceService, useValue: finance },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => workspaceParam } } },
        },
      ],
    });

    component = TestBed.runInInjectionContext(
      () => new TransactionListComponent()
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe('ngOnInit', () => {
    it('adopts the route workspace and loads', async () => {
      finance.getTransactions.mockResolvedValue([txn()]);
      finance.getAccounts.mockResolvedValue([{ id: 'acc-9' }]);
      finance.getCategorySuggestions.mockResolvedValue(['food']);

      await component.ngOnInit();

      expect(component.workspace()).toBe('business');
      expect(component.transactions()).toHaveLength(1);
      expect(component.categoryOptions()).toEqual(['food']);
      // The draft defaults to the first available account.
      expect(component.draft.accountId).toBe('acc-9');
    });

    it('defaults to the personal workspace', async () => {
      workspaceParam = null;
      await component.ngOnInit();
      expect(component.workspace()).toBe('personal');
    });

    it('leaves the draft account empty when there are no accounts', async () => {
      await component.ngOnInit();
      expect(component.draft.accountId).toBe('');
    });

    it('swallows abort-like load errors', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      finance.getTransactions.mockRejectedValue(
        new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' })
      );

      await component.ngOnInit();

      expect(consoleError).not.toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });

    it('logs other load errors', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      finance.getTransactions.mockRejectedValue(new Error('boom'));

      await component.ngOnInit();

      expect(consoleError).toHaveBeenCalledWith(
        'Error loading transactions:',
        expect.any(Error)
      );
      expect(component.loading()).toBe(false);
    });
  });

  describe('filteredTransactions', () => {
    beforeEach(() => {
      component.transactions.set([
        txn({ id: 'a', sourceType: 'bank-sync', accountId: 'acc-1' } as never),
        txn({ id: 'b', accountId: 'acc-2' }),
        txn({
          id: 'c',
          sourceType: 'import',
          accountId: 'acc-1',
          reviewStatus: 'reviewed',
        } as never),
      ]);
    });

    it('returns everything with no filters set', () => {
      expect(component.filteredTransactions()).toHaveLength(3);
    });

    it('filters by source type, treating a missing type as manual', () => {
      component.selectedSourceType.set('manual');
      expect(component.filteredTransactions().map((t) => t.id)).toEqual(['b']);

      component.selectedSourceType.set('bank-sync');
      expect(component.filteredTransactions().map((t) => t.id)).toEqual(['a']);
    });

    it('filters by account', () => {
      component.selectedAccountId.set('acc-1');
      expect(component.filteredTransactions().map((t) => t.id)).toEqual([
        'a',
        'c',
      ]);
    });

    it('filters by review status, defaulting to needs-review', () => {
      component.reviewFilter.set('reviewed');
      expect(component.filteredTransactions().map((t) => t.id)).toEqual(['c']);

      component.reviewFilter.set('needs-review');
      expect(component.filteredTransactions().map((t) => t.id)).toEqual([
        'a',
        'b',
      ]);
    });

    it('combines filters', () => {
      component.selectedAccountId.set('acc-1');
      component.reviewFilter.set('reviewed');
      expect(component.filteredTransactions().map((t) => t.id)).toEqual(['c']);
    });
  });

  describe('draft helpers', () => {
    it('emptyDraft carries the workspace and today', () => {
      component.workspace.set('net-worth');

      const draft = component.emptyDraft();

      expect(draft).toMatchObject({
        accountId: '',
        amount: 0,
        type: 'debit',
        workspace: 'net-worth',
        isRecurring: false,
      });
      expect(draft.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('editTransaction maps the row into the draft', () => {
      component.workspace.set('business');

      component.editTransaction(
        txn({ id: 'txn-8', amount: '42' as never, payeeOrVendor: 'Acme' })
      );

      expect(component.editingId()).toBe('txn-8');
      expect(component.draft).toMatchObject({
        accountId: 'acc-1',
        amount: 42,
        payeeOrVendor: 'Acme',
        transactionDate: '2026-03-04',
        workspace: 'business',
      });
    });

    it('editTransaction blanks absent payee and transfer type', () => {
      component.editTransaction(txn());

      expect(component.draft.payeeOrVendor).toBe('');
      expect(component.draft.transferType).toBe('');
    });
  });

  describe('sourceLabel', () => {
    it('names each known source', () => {
      expect(component.sourceLabel('bank-sync')).toBe('Bank sync');
      expect(component.sourceLabel('import')).toBe('Import');
    });

    it('falls back to Manual', () => {
      expect(component.sourceLabel()).toBe('Manual');
      expect(component.sourceLabel('anything-else' as never)).toBe('Manual');
    });
  });

  describe('saveTransaction', () => {
    it('creates when nothing is being edited', async () => {
      component.workspace.set('business');
      component.draft = {
        ...component.emptyDraft(),
        category: '  food  ',
        amount: 5,
      };

      await component.saveTransaction();

      expect(finance.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'food',
          workspace: 'business',
          transactionDate: expect.any(Date),
        })
      );
      expect(component.editingId()).toBeNull();
    });

    it('sends undefined rather than an empty transfer type', async () => {
      component.draft = { ...component.emptyDraft(), transferType: '' };

      await component.saveTransaction();

      expect(
        finance.createTransaction.mock.calls[0][0].transferType
      ).toBeUndefined();
    });

    it('keeps a populated transfer type', async () => {
      component.draft = { ...component.emptyDraft(), transferType: 'internal' };

      await component.saveTransaction();

      expect(finance.createTransaction.mock.calls[0][0].transferType).toBe(
        'internal'
      );
    });

    it('updates when a row is being edited', async () => {
      component.editTransaction(txn({ id: 'txn-3' }));

      await component.saveTransaction();

      expect(finance.updateTransaction).toHaveBeenCalledWith(
        'txn-3',
        expect.any(Object)
      );
      expect(finance.createTransaction).not.toHaveBeenCalled();
    });
  });

  describe('deleteTransaction', () => {
    it('deletes and reloads', async () => {
      await component.deleteTransaction('txn-1');

      expect(finance.deleteTransaction).toHaveBeenCalledWith('txn-1');
      expect(finance.getTransactions).toHaveBeenCalled();
    });
  });

  describe('column definitions', () => {
    const colFor = (field: string) =>
      component.columnDefs.find((c) => c.field === field);

    it('formats the amount as currency', () => {
      const format = colFor('amount')?.valueFormatter as unknown as (p: {
        value: unknown;
      }) => string;
      expect(format({ value: 1234.5 })).toBe('$1,234.50');
      expect(format({ value: null })).toBe('$0.00');
    });

    it('formats the date and blanks a missing one', () => {
      const format = colFor('transactionDate')
        ?.valueFormatter as unknown as (p: { value: unknown }) => string;
      expect(format({ value: '' })).toBe('');
      expect(format({ value: '2026-03-04T00:00:00.000Z' })).toMatch(/Mar/);
    });

    it('exposes the date as a date-input value', () => {
      const get = colFor('transactionDate')?.valueGetter as unknown as (p: {
        data?: Transaction;
      }) => string;
      expect(get({ data: txn() })).toBe('2026-03-04');
      expect(get({ data: undefined })).toBe('');
    });

    it('writes an edited date back onto the row', () => {
      const set = colFor('transactionDate')?.valueSetter as unknown as (p: {
        data?: Transaction;
        newValue: unknown;
      }) => boolean;

      const row = txn();
      expect(set({ data: row, newValue: '2026-05-06' })).toBe(true);
      expect(set({ data: undefined, newValue: '2026-05-06' })).toBe(false);
    });

    it('labels payee and description fallbacks', () => {
      const payee = colFor('payeeOrVendor')?.valueFormatter as unknown as (p: {
        value: unknown;
      }) => string;
      expect(payee({ value: '' })).toBe('Unknown');
      expect(payee({ value: 'Acme' })).toBe('Acme');

      const description = colFor('description')
        ?.valueFormatter as unknown as (p: { value: unknown }) => string;
      expect(description({ value: null })).toBe('');
    });

    it('renders the source cell through sourceLabel', () => {
      const render = colFor('sourceType')?.cellRenderer as (p: {
        value?: string;
      }) => HTMLElement;
      expect(render({ value: 'bank-sync' }).textContent).toContain('Bank sync');
      expect(render({}).textContent).toContain('Manual');
    });
  });
});
