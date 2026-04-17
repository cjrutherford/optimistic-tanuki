import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from './transaction.service';
import { Transaction } from '../../entities/transaction.entity';
import { AccountService } from './account.service';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((value: string) => value),
  },
}));

describe('TransactionService', () => {
  let service: TransactionService;
  let transactionRepo: jest.Mocked<Repository<Transaction>>;
  let accountService: {
    updateBalance: jest.Mock;
  };

  const mockRepoFactory = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    accountService = {
      updateBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getRepositoryToken(Transaction),
          useFactory: mockRepoFactory,
        },
        {
          provide: AccountService,
          useValue: accountService,
        },
      ],
    }).compile();

    service = module.get(TransactionService);
    transactionRepo = module.get(getRepositoryToken(Transaction));
  });

  it('reconciles account balances when amount, type, and account change', async () => {
    const existing = {
      id: 'txn-1',
      amount: 20,
      type: 'debit',
      category: 'food',
      accountId: 'account-a',
      userId: 'user-1',
      profileId: 'profile-1',
      appScope: 'finance',
    } as Transaction;
    const updated = {
      ...existing,
      amount: 40,
      type: 'credit',
      accountId: 'account-b',
    } as Transaction;

    transactionRepo.findOne
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);
    transactionRepo.update.mockResolvedValue({
      generatedMaps: [],
      raw: [],
      affected: 1,
    });

    await service.update('txn-1', {
      amount: 40,
      type: 'credit',
      accountId: 'account-b',
    } as any);

    expect(accountService.updateBalance).toHaveBeenNthCalledWith(
      1,
      'account-a',
      20,
      undefined
    );
    expect(accountService.updateBalance).toHaveBeenNthCalledWith(
      2,
      'account-b',
      40,
      undefined
    );
    expect(transactionRepo.update).toHaveBeenCalledWith(
      'txn-1',
      expect.objectContaining({
        amount: 40,
        type: 'credit',
        accountId: 'account-b',
      })
    );
  });

  it('passes tenantId to account reconciliation for tenant-scoped transactions', async () => {
    const createInput = {
      amount: 75,
      type: 'debit',
      category: 'operations',
      description: 'Vendor payment',
      userId: 'user-1',
      profileId: 'profile-1',
      tenantId: 'tenant-1',
      appScope: 'finance',
      accountId: 'account-a',
      transactionDate: new Date('2025-01-01T00:00:00.000Z'),
      isRecurring: false,
    };

    transactionRepo.create.mockReturnValue(createInput as any);
    transactionRepo.save.mockResolvedValue(createInput as any);

    await service.create(createInput as any);

    expect(accountService.updateBalance).toHaveBeenCalledWith(
      'account-a',
      -75,
      {
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      }
    );
  });

  it('upserts external bank transactions without reapplying account balances to unchanged rows', async () => {
    const existing = {
      id: 'txn-1',
      accountId: 'account-a',
      amount: 25,
      type: 'debit',
      externalTransactionId: 'bank-txn-1',
    } as Transaction;

    transactionRepo.findOne.mockResolvedValue(existing);
    transactionRepo.save.mockResolvedValue(existing);

    const result = await service.syncBankFeed(
      'connection-1',
      {
        userId: 'user-1',
        profileId: 'profile-1',
        tenantId: 'tenant-1',
        appScope: 'finance',
      },
      [
        {
          accountId: 'account-a',
          externalTransactionId: 'bank-txn-1',
          amount: 25,
          type: 'debit',
          category: 'groceries',
          description: 'Neighborhood Market',
          transactionDate: new Date('2026-04-14T00:00:00.000Z'),
          sourceProvider: 'plaid',
          sourceType: 'bank-sync',
          pending: false,
          reviewStatus: 'reviewed',
        },
      ] as any
    );

    expect(transactionRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'txn-1',
          externalTransactionId: 'bank-txn-1',
          sourceType: 'bank-sync',
        }),
      ])
    );
    expect(accountService.updateBalance).not.toHaveBeenCalled();
    expect(result).toEqual({ added: 0, modified: 1, removed: 0 });
  });
});
