import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AccountListComponent } from './account-list.component';
import { FinanceService } from '../services/finance.service';
import type { Account } from '../models';

type Formatter = (params: { value: unknown }) => string;

/**
 * Built through runInInjectionContext rather than createComponent: these
 * exercise the component's logic, not its ag-grid template.
 */
describe('AccountListComponent behaviour', () => {
  let component: AccountListComponent;
  let finance: {
    getAccounts: jest.Mock;
    getBankConnections: jest.Mock;
    createAccount: jest.Mock;
    updateAccount: jest.Mock;
    deleteAccount: jest.Mock;
    syncBankConnection: jest.Mock;
    disconnectBankConnection: jest.Mock;
    createBankLinkToken: jest.Mock;
    connectBankProvider: jest.Mock;
  };
  let workspaceParam: string | null;

  const account = (overrides: Partial<Account> = {}): Account =>
    ({
      id: 'acc-1',
      name: 'Checking',
      type: 'bank',
      balance: 100,
      currency: 'USD',
      ...overrides,
    } as Account);

  const build = () => {
    workspaceParam = 'business';
    finance = {
      getAccounts: jest.fn().mockResolvedValue([]),
      getBankConnections: jest.fn().mockResolvedValue([]),
      createAccount: jest.fn().mockResolvedValue({}),
      updateAccount: jest.fn().mockResolvedValue({}),
      deleteAccount: jest.fn().mockResolvedValue(undefined),
      syncBankConnection: jest
        .fn()
        .mockResolvedValue({ added: 1, modified: 2, removed: 3 }),
      disconnectBankConnection: jest.fn().mockResolvedValue({}),
      createBankLinkToken: jest.fn().mockResolvedValue({ linkToken: 'tok' }),
      connectBankProvider: jest.fn().mockResolvedValue({}),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: FinanceService, useValue: finance },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => workspaceParam } },
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new AccountListComponent());
  };

  beforeEach(() => build());

  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as { Plaid?: unknown }).Plaid;
  });

  describe('loadAccounts', () => {
    it('reads the workspace from the route and loads both feeds', async () => {
      finance.getAccounts.mockResolvedValue([account()]);
      finance.getBankConnections.mockResolvedValue([{ id: 'conn-1' }]);

      await component.loadAccounts();

      expect(component.workspace()).toBe('business');
      expect(finance.getAccounts).toHaveBeenCalledWith('business');
      expect(component.accounts()).toHaveLength(1);
      expect(component.connections()).toHaveLength(1);
      expect(component.loading()).toBe(false);
    });

    it('defaults the workspace to personal when the route has none', async () => {
      workspaceParam = null;

      await component.loadAccounts();

      expect(component.workspace()).toBe('personal');
    });

    it('resets the draft when not editing', async () => {
      component.draft = { name: 'stale' };

      await component.loadAccounts();

      expect(component.draft.name).toBe('');
    });

    it('preserves the draft while editing', async () => {
      component.editAccount(account({ id: 'acc-9', name: 'Being edited' }));

      await component.loadAccounts();

      expect(component.draft.name).toBe('Being edited');
    });

    it('swallows abort-like errors without logging', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      finance.getAccounts.mockRejectedValue(
        new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' })
      );

      await component.loadAccounts();

      expect(consoleError).not.toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });

    it('logs other failures and still clears loading', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      finance.getAccounts.mockRejectedValue(new Error('boom'));

      await component.loadAccounts();

      expect(consoleError).toHaveBeenCalledWith(
        'Error loading accounts:',
        expect.any(Error)
      );
      expect(component.loading()).toBe(false);
    });
  });

  describe('ngOnInit', () => {
    it('seeds the draft and loads', async () => {
      await component.ngOnInit();

      expect(finance.getAccounts).toHaveBeenCalled();
      expect(component.draft.type).toBe('bank');
    });
  });

  describe('draft helpers', () => {
    it('emptyDraft carries the current workspace', () => {
      component.workspace.set('net-worth');

      const draft = component.emptyDraft();

      expect(draft).toMatchObject({
        name: '',
        type: 'bank',
        balance: 0,
        currency: 'USD',
        workspace: 'net-worth',
      });
      expect(draft.lastReviewedAt).toBeInstanceOf(Date);
    });

    it('editAccount copies the account into the draft', () => {
      const target = account({ id: 'acc-7', name: 'Savings' });

      component.editAccount(target);

      expect(component.editingId()).toBe('acc-7');
      expect(component.draft).toMatchObject({ id: 'acc-7', name: 'Savings' });
      // A copy, not the same reference.
      expect(component.draft).not.toBe(target);
    });

    it('manualAccounts excludes provider-linked accounts', () => {
      component.accounts.set([
        account({ id: 'manual' }),
        account({ id: 'linked', providerConnectionId: 'conn-1' } as never),
      ]);

      expect(component.manualAccounts().map((a) => a.id)).toEqual(['manual']);
    });
  });

  describe('column formatters', () => {
    const formatterFor = (field: string) =>
      component.columnDefs.find((c) => c.field === field)
        ?.valueFormatter as unknown as Formatter;

    it('formats the balance as US currency', () => {
      expect(formatterFor('balance')({ value: 1234.5 })).toBe('$1,234.50');
    });

    it('treats a missing balance as zero', () => {
      expect(formatterFor('balance')({ value: null })).toBe('$0.00');
    });

    it('falls back to Manual for accounts with no institution', () => {
      expect(formatterFor('institutionName')({ value: '' })).toBe('Manual');
      expect(formatterFor('institutionName')({ value: 'Chase' })).toBe('Chase');
    });

    it('marks an unreviewed account as needing review', () => {
      expect(formatterFor('lastReviewedAt')({ value: null })).toBe(
        'Needs review'
      );
    });

    it('formats a review date', () => {
      expect(
        formatterFor('lastReviewedAt')({ value: '2026-03-04T00:00:00.000Z' })
      ).toMatch(/Mar/);
    });
  });

  describe('actions cell renderer', () => {
    const renderer = () =>
      component.columnDefs.find((c) => c.headerName === 'Actions')
        ?.cellRenderer as (p: { data?: Account }) => HTMLElement | string;

    it('renders nothing without row data', () => {
      expect(renderer()({})).toBe('');
    });

    it('renders the three row actions', () => {
      const wrapper = renderer()({ data: account() }) as HTMLElement;

      const labels = Array.from(wrapper.querySelectorAll('button')).map(
        (b) => b.textContent
      );
      expect(labels).toEqual(['Edit', 'Reviewed', 'Delete']);
      expect(wrapper.className).toBe('grid-actions');
    });

    it('wires Edit to editAccount and stops the grid from also handling it', () => {
      const wrapper = renderer()({
        data: account({ id: 'acc-3' }),
      }) as HTMLElement;
      const edit = wrapper.querySelectorAll('button')[0];

      const event = new MouseEvent('click', { cancelable: true });
      edit.dispatchEvent(event);

      expect(component.editingId()).toBe('acc-3');
      expect(event.defaultPrevented).toBe(true);
    });

    it('gives the delete action its danger class', () => {
      const wrapper = renderer()({ data: account() }) as HTMLElement;
      expect(wrapper.querySelectorAll('button')[2].className).toBe(
        'workspace-button-danger'
      );
    });
  });

  describe('saveAccount', () => {
    it('creates when nothing is being edited', async () => {
      component.workspace.set('business');
      component.draft = { name: 'New account' };

      await component.saveAccount();

      expect(finance.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New account', workspace: 'business' })
      );
      expect(finance.updateAccount).not.toHaveBeenCalled();
      expect(component.editingId()).toBeNull();
    });

    it('updates when an account is being edited', async () => {
      component.editAccount(account({ id: 'acc-5' }));

      await component.saveAccount();

      expect(finance.updateAccount).toHaveBeenCalledWith(
        'acc-5',
        expect.objectContaining({ id: 'acc-5' })
      );
      expect(finance.createAccount).not.toHaveBeenCalled();
      expect(component.editingId()).toBeNull();
    });

    it('reloads afterwards', async () => {
      await component.saveAccount();
      expect(finance.getAccounts).toHaveBeenCalled();
    });
  });

  describe('connection actions', () => {
    it('reports sync counts', async () => {
      await component.syncConnection('conn-1');

      expect(component.status()).toBe(
        'Synced linked account feed. Added 1, modified 2, removed 3.'
      );
      expect(finance.getAccounts).toHaveBeenCalled();
    });

    it('surfaces the error message when sync fails', async () => {
      finance.syncBankConnection.mockRejectedValue(new Error('rate limited'));

      await component.syncConnection('conn-1');

      expect(component.status()).toBe('rate limited');
    });

    it('falls back to a generic message for a messageless failure', async () => {
      finance.syncBankConnection.mockRejectedValue('nope');

      await component.syncConnection('conn-1');

      expect(component.status()).toBe('Sync failed.');
    });

    it('confirms a disconnect and reloads', async () => {
      await component.disconnectConnection('conn-1');

      expect(component.status()).toBe('Disconnected linked bank account.');
      expect(finance.getAccounts).toHaveBeenCalled();
    });

    it('reports a failed disconnect', async () => {
      finance.disconnectBankConnection.mockRejectedValue('nope');

      await component.disconnectConnection('conn-1');

      expect(component.status()).toBe('Disconnect failed.');
    });
  });

  describe('connectBankAccount', () => {
    const installPlaid = () => {
      const open = jest.fn();
      const create = jest.fn().mockReturnValue({ open });
      (window as unknown as { Plaid: unknown }).Plaid = { create };
      return { open, create };
    };

    it('requests a link token and opens the Plaid handler', async () => {
      const { open, create } = installPlaid();

      await component.connectBankAccount();

      expect(finance.createBankLinkToken).toHaveBeenCalledWith({
        provider: 'plaid',
      });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'tok' })
      );
      expect(open).toHaveBeenCalled();
      expect(component.status()).toBe('Opening Plaid Link…');
    });

    it('reports a failure to start linking', async () => {
      installPlaid();
      finance.createBankLinkToken.mockRejectedValue(new Error('no provider'));

      await component.connectBankAccount();

      expect(component.status()).toBe('no provider');
    });

    it('connects the institution on Plaid success', async () => {
      const { create } = installPlaid();
      component.workspace.set('business');

      await component.connectBankAccount();
      const config = create.mock.calls[0][0];
      await config.onSuccess('public-tok', {
        institution: { institution_id: 'ins_1', name: 'Chase' },
      });

      expect(finance.connectBankProvider).toHaveBeenCalledWith({
        provider: 'plaid',
        publicToken: 'public-tok',
        institutionId: 'ins_1',
        institutionName: 'Chase',
        workspace: 'business',
      });
      expect(component.status()).toBe(
        'Connected Plaid institution. Initial sync requested.'
      );
    });

    it('reports a failure to complete the connection', async () => {
      const { create } = installPlaid();
      finance.connectBankProvider.mockRejectedValue('nope');

      await component.connectBankAccount();
      await create.mock.calls[0][0].onSuccess('public-tok', {});

      expect(component.status()).toBe(
        'Bank link opened, but the connection could not be completed.'
      );
    });

    it('reports cancellation only while the link is still opening', async () => {
      const { create } = installPlaid();

      await component.connectBankAccount();
      create.mock.calls[0][0].onExit();

      expect(component.status()).toBe('Bank linking cancelled.');
    });

    it('leaves a later status alone on exit', async () => {
      const { create } = installPlaid();

      await component.connectBankAccount();
      component.status.set('Something else happened');
      create.mock.calls[0][0].onExit();

      expect(component.status()).toBe('Something else happened');
    });
  });

  describe('markReviewed', () => {
    it('stamps the review date and reloads', async () => {
      await component.markReviewed(account({ id: 'acc-2' }));

      expect(finance.updateAccount).toHaveBeenCalledWith('acc-2', {
        lastReviewedAt: expect.any(Date),
      });
      expect(finance.getAccounts).toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('does nothing when the confirm is declined', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);

      await component.deleteAccount('acc-1');

      expect(finance.deleteAccount).not.toHaveBeenCalled();
    });

    it('deletes and reloads when confirmed', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);

      await component.deleteAccount('acc-1');

      expect(finance.deleteAccount).toHaveBeenCalledWith('acc-1');
      expect(finance.getAccounts).toHaveBeenCalled();
    });

    it('swallows abort-like delete errors', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      finance.deleteAccount.mockRejectedValue(
        new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' })
      );

      await component.deleteAccount('acc-1');

      expect(consoleError).not.toHaveBeenCalled();
    });

    it('logs other delete failures', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      finance.deleteAccount.mockRejectedValue(new Error('server down'));

      await component.deleteAccount('acc-1');

      expect(consoleError).toHaveBeenCalledWith(
        'Error deleting account:',
        expect.any(Error)
      );
    });
  });
});
