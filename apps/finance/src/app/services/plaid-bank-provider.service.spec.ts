import { InternalServerErrorException } from '@nestjs/common';
import { BankConnectionStatus } from '@optimistic-tanuki/models';
import { PlaidBankProviderService } from './plaid-bank-provider.service';

/**
 * The service reads its Plaid credentials from process.env in field
 * initialisers, so each case sets the env it wants before constructing.
 */
describe('PlaidBankProviderService', () => {
  const originalEnv = process.env;
  let fetchMock: jest.Mock;

  const build = (env: Record<string, string | undefined> = {}) => {
    process.env = {
      ...originalEnv,
      PLAID_CLIENT_ID: 'client-1',
      PLAID_SECRET: 'secret-1',
      PLAID_ENV: 'sandbox',
      PLAID_CLIENT_NAME: 'Fin Commander',
      ...env,
    };
    return new PlaidBankProviderService();
  };

  const respondWith = (...bodies: unknown[]) => {
    bodies.forEach((body) =>
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => body,
      })
    );
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('configuration', () => {
    it('refuses to call Plaid without a client id', async () => {
      const service = build({ PLAID_CLIENT_ID: '' });

      await expect(
        service.createLinkToken({ userId: 'u', profileId: 'p' } as never)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses to call Plaid without a secret', async () => {
      const service = build({ PLAID_SECRET: '' });

      await expect(
        service.createLinkToken({ userId: 'u', profileId: 'p' } as never)
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('targets the sandbox host by default', async () => {
      const service = build();
      respondWith({ link_token: 'tok' });

      await service.createLinkToken({ userId: 'u', profileId: 'p' } as never);

      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://sandbox.plaid.com/link/token/create'
      );
    });

    it('targets the development host', async () => {
      const service = build({ PLAID_ENV: 'development' });
      respondWith({ link_token: 'tok' });

      await service.createLinkToken({ userId: 'u', profileId: 'p' } as never);

      expect(fetchMock.mock.calls[0][0]).toContain(
        'https://development.plaid.com'
      );
    });

    it('targets the production host', async () => {
      const service = build({ PLAID_ENV: 'production' });
      respondWith({ link_token: 'tok' });

      await service.createLinkToken({ userId: 'u', profileId: 'p' } as never);

      expect(fetchMock.mock.calls[0][0]).toContain(
        'https://production.plaid.com'
      );
    });

    it('surfaces a failed Plaid response with its status and body', async () => {
      const service = build();
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'INVALID_REQUEST',
      });

      await expect(
        service.createLinkToken({ userId: 'u', profileId: 'p' } as never)
      ).rejects.toThrow(/400 INVALID_REQUEST/);
    });

    it('sends the credentials in every request body', async () => {
      const service = build();
      respondWith({ link_token: 'tok' });

      await service.createLinkToken({ userId: 'u', profileId: 'p' } as never);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toMatchObject({
        client_id: 'client-1',
        secret: 'secret-1',
      });
    });
  });

  describe('createLinkToken', () => {
    it('identifies the user by userId:profileId and maps the response', async () => {
      const service = build();
      respondWith({ link_token: 'tok-1', expiration: '2026-01-01' });

      const result = await service.createLinkToken({
        userId: 'user-1',
        profileId: 'profile-1',
        redirectUri: 'https://app.example/return',
      } as never);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toMatchObject({
        client_name: 'Fin Commander',
        language: 'en',
        country_codes: ['US'],
        products: ['transactions'],
        user: { client_user_id: 'user-1:profile-1' },
        redirect_uri: 'https://app.example/return',
      });
      expect(result).toEqual({
        provider: 'plaid',
        linkToken: 'tok-1',
        expiration: '2026-01-01',
      });
    });
  });

  describe('exchangePublicToken', () => {
    it('exchanges the token then maps the returned accounts', async () => {
      const service = build();
      respondWith(
        { access_token: 'access-1', item_id: 'item-1' },
        {
          accounts: [
            {
              account_id: 'acc-1',
              balances: { current: 250.5 },
              mask: '1234',
              name: 'Checking',
              subtype: 'checking',
              type: 'depository',
            },
          ],
        }
      );

      const result = await service.exchangePublicToken({
        publicToken: 'public-1',
        institutionId: 'ins_1',
        institutionName: 'Chase',
      } as never);

      expect(fetchMock.mock.calls[0][0]).toContain(
        '/item/public_token/exchange'
      );
      expect(fetchMock.mock.calls[1][0]).toContain('/accounts/get');
      expect(result).toEqual({
        accessToken: 'access-1',
        itemId: 'item-1',
        institutionId: 'ins_1',
        institutionName: 'Chase',
        accounts: [
          {
            providerAccountId: 'acc-1',
            name: 'Checking',
            mask: '1234',
            subtype: 'checking',
            type: 'depository',
            balance: 250.5,
            currency: 'USD',
          },
        ],
      });
    });

    it('treats a null balance as zero', async () => {
      const service = build();
      respondWith(
        { access_token: 'access-1', item_id: 'item-1' },
        {
          accounts: [
            {
              account_id: 'acc-1',
              balances: { current: null },
              name: 'Savings',
            },
          ],
        }
      );

      const result = await service.exchangePublicToken({
        publicToken: 'public-1',
      } as never);

      expect(result.accounts[0].balance).toBe(0);
    });
  });

  describe('syncTransactions', () => {
    it('pages until has_more is false and returns the final cursor', async () => {
      const service = build();
      respondWith(
        {
          added: [
            {
              transaction_id: 'txn-1',
              account_id: 'acc-1',
              amount: 12.5,
              date: '2026-03-04',
              name: 'Coffee',
              category: ['Food and Drink'],
              pending: false,
            },
          ],
          has_more: true,
          next_cursor: 'cursor-2',
        },
        {
          added: [
            {
              transaction_id: 'txn-2',
              account_id: 'acc-1',
              amount: -40,
              date: '2026-03-05',
              merchant_name: 'Refund Co',
              name: 'refund',
              pending: true,
            },
          ],
          has_more: false,
          next_cursor: 'cursor-3',
        }
      );

      const result = await service.syncTransactions('access-1', 'cursor-1');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.nextCursor).toBe('cursor-3');
      expect(result.transactions).toHaveLength(2);
    });

    it('classifies a negative amount as a credit and a positive one as a debit', async () => {
      const service = build();
      respondWith({
        added: [
          {
            transaction_id: 'txn-1',
            account_id: 'acc-1',
            amount: 10,
            date: '2026-03-04',
            name: 'Shop',
            pending: false,
          },
          {
            transaction_id: 'txn-2',
            account_id: 'acc-1',
            amount: -10,
            date: '2026-03-04',
            name: 'Refund',
            pending: false,
          },
        ],
        has_more: false,
        next_cursor: null,
      });

      const result = await service.syncTransactions('access-1');

      expect(result.transactions[0].type).toBe('debit');
      expect(result.transactions[1].type).toBe('credit');
    });

    it('prefers the merchant name and falls back to the raw name', async () => {
      const service = build();
      respondWith({
        added: [
          {
            transaction_id: 'txn-1',
            account_id: 'acc-1',
            amount: 5,
            date: '2026-03-04',
            merchant_name: 'Blue Bottle',
            name: 'BLUEBOTTLE#12',
            pending: false,
          },
          {
            transaction_id: 'txn-2',
            account_id: 'acc-1',
            amount: 5,
            date: '2026-03-04',
            name: 'Unknown vendor',
            pending: false,
          },
        ],
        has_more: false,
        next_cursor: null,
      });

      const result = await service.syncTransactions('access-1');

      expect(result.transactions[0].description).toBe('Blue Bottle');
      expect(result.transactions[1].description).toBe('Unknown vendor');
    });

    it('defaults an uncategorised transaction to Imported', async () => {
      const service = build();
      respondWith({
        added: [
          {
            transaction_id: 'txn-1',
            account_id: 'acc-1',
            amount: 5,
            date: '2026-03-04',
            name: 'Something',
            pending: false,
          },
        ],
        has_more: false,
        next_cursor: null,
      });

      const result = await service.syncTransactions('access-1');

      expect(result.transactions[0].category).toBe('Imported');
      expect(result.transactions[0].transactionDate).toEqual(
        new Date('2026-03-04')
      );
    });

    it('starts without a cursor when none is supplied', async () => {
      const service = build();
      respondWith({ added: [], has_more: false, next_cursor: null });

      await service.syncTransactions('access-1');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.cursor).toBeUndefined();
      expect(body.access_token).toBe('access-1');
    });
  });

  describe('mapWebhookStatus', () => {
    it('maps error codes to a sync error', () => {
      const service = build();
      expect(service.mapWebhookStatus('ERROR')).toBe(
        BankConnectionStatus.SYNC_ERROR
      );
      expect(service.mapWebhookStatus('LOGIN_REPAIRED')).toBe(
        BankConnectionStatus.SYNC_ERROR
      );
    });

    it('maps a pending expiration to needing re-auth', () => {
      const service = build();
      expect(service.mapWebhookStatus('PENDING_EXPIRATION')).toBe(
        BankConnectionStatus.NEEDS_REAUTH
      );
    });

    it('treats anything else, including no code, as healthy', () => {
      const service = build();
      expect(service.mapWebhookStatus('SOMETHING_ELSE')).toBe(
        BankConnectionStatus.HEALTHY
      );
      expect(service.mapWebhookStatus()).toBe(BankConnectionStatus.HEALTHY);
    });
  });
});
