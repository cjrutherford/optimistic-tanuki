import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TransactionService } from './transaction.service';
import { Transaction } from '../../entities/transaction.entity';
import { AccountService } from './account.service';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((value: string) => value.replace(/<[^>]*>/g, '')),
  },
}));

/**
 * The spec beside this one covers balance reconciliation on update; these
 * cover remove's reversal and the bank-feed sync's create/dedupe paths.
 */
describe('TransactionService remove and bank sync', () => {
  let service: TransactionService;
  let repo: jest.Mocked<Repository<Transaction>>;
  let accountService: { updateBalance: jest.Mock };

  const txn = (overrides: Partial<Transaction> = {}) =>
    ({
      id: 'txn-1',
      accountId: 'acc-1',
      amount: 50,
      type: 'debit',
      ...overrides,
    } as Transaction);

  beforeEach(async () => {
    accountService = { updateBalance: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getRepositoryToken(Transaction),
          useFactory: () => ({
            create: jest.fn((value) => value),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          }),
        },
        { provide: AccountService, useValue: accountService },
      ],
    }).compile();

    service = module.get(TransactionService);
    repo = module.get(getRepositoryToken(Transaction));
  });

  describe('remove', () => {
    it('rejects an unknown transaction', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('gives back a debit before deleting it', async () => {
      repo.findOne.mockResolvedValue(txn({ amount: 50, type: 'debit' }));

      await service.remove('txn-1');

      // A debit was -50 on the balance, so removing it adds 50 back.
      expect(accountService.updateBalance).toHaveBeenCalledWith(
        'acc-1',
        50,
        undefined
      );
      expect(repo.delete).toHaveBeenCalledWith('txn-1');
    });

    it('takes back a credit before deleting it', async () => {
      repo.findOne.mockResolvedValue(txn({ amount: 50, type: 'credit' }));

      await service.remove('txn-1');

      expect(accountService.updateBalance).toHaveBeenCalledWith(
        'acc-1',
        -50,
        undefined
      );
    });
  });

  describe('syncBankFeed', () => {
    const scope = { userId: 'user-1', profileId: 'profile-1' };

    it('reports nothing for an empty feed', async () => {
      const result = await service.syncBankFeed('conn-1', scope, []);

      expect(result).toEqual({ added: 0, modified: 0, removed: 0 });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('counts an entry with no external id as added', async () => {
      repo.save.mockResolvedValue([] as never);

      const result = await service.syncBankFeed('conn-1', scope, [
        { accountId: 'acc-1', amount: 10, type: 'debit' } as never,
      ]);

      expect(result.added).toBe(1);
      expect(result.modified).toBe(0);
    });

    it('counts a matching external id as modified rather than added', async () => {
      repo.findOne.mockResolvedValue(txn({ id: 'existing-1' }));
      repo.save.mockResolvedValue([] as never);

      const result = await service.syncBankFeed('conn-1', scope, [
        {
          accountId: 'acc-1',
          amount: 10,
          type: 'debit',
          externalTransactionId: 'ext-1',
        } as never,
      ]);

      expect(result).toMatchObject({ added: 0, modified: 1 });
      // An existing row is merged, not re-balanced.
      expect(accountService.updateBalance).not.toHaveBeenCalled();
    });

    it('scopes the dedupe lookup by owner', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockResolvedValue([] as never);

      await service.syncBankFeed(
        'conn-1',
        { ...scope, tenantId: 'ten-1', appScope: 'fin' },
        [
          {
            accountId: 'acc-1',
            amount: 10,
            type: 'debit',
            externalTransactionId: 'ext-1',
          } as never,
        ]
      );

      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          externalTransactionId: 'ext-1',
          userId: 'user-1',
          profileId: 'profile-1',
          appScope: 'fin',
          tenantId: 'ten-1',
        },
      });
    });

    it('omits tenantId from the lookup when the scope has none', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockResolvedValue([] as never);

      await service.syncBankFeed('conn-1', scope, [
        {
          accountId: 'acc-1',
          amount: 10,
          type: 'debit',
          externalTransactionId: 'ext-1',
        } as never,
      ]);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: expect.not.objectContaining({ tenantId: expect.anything() }),
      });
    });

    it('balances a newly imported transaction and defaults its review state', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockResolvedValue([] as never);

      const result = await service.syncBankFeed('conn-1', scope, [
        {
          accountId: 'acc-1',
          amount: 25,
          type: 'debit',
          externalTransactionId: 'ext-new',
        } as never,
      ]);

      expect(result.added).toBe(1);
      expect(accountService.updateBalance).toHaveBeenCalledWith(
        'acc-1',
        -25,
        scope
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pending: false })
      );
    });

    it('saves everything collected in one write', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockResolvedValue([] as never);

      await service.syncBankFeed('conn-1', scope, [
        {
          accountId: 'acc-1',
          amount: 1,
          type: 'debit',
          externalTransactionId: 'ext-1',
        } as never,
        {
          accountId: 'acc-1',
          amount: 2,
          type: 'credit',
          externalTransactionId: 'ext-2',
        } as never,
      ]);

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save.mock.calls[0][0]).toHaveLength(2);
    });
  });
});
