import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account, BankConnection, LinkedBankAccount } from '../../entities';
import { BankConnectionService } from './bank-connection.service';
import { AccountService } from './account.service';
import { TransactionService } from './transaction.service';

describe('BankConnectionService', () => {
  let service: BankConnectionService;
  let connectionRepo: jest.Mocked<Repository<BankConnection>>;
  let linkedAccountRepo: jest.Mocked<Repository<LinkedBankAccount>>;
  let accountRepo: jest.Mocked<Repository<Account>>;
  let accountService: { create: jest.Mock };
  let transactionService: { syncBankFeed: jest.Mock };

  const mockRepoFactory = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  });

  beforeEach(async () => {
    accountService = {
      create: jest.fn(),
    };
    transactionService = {
      syncBankFeed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankConnectionService,
        {
          provide: getRepositoryToken(BankConnection),
          useFactory: mockRepoFactory,
        },
        {
          provide: getRepositoryToken(LinkedBankAccount),
          useFactory: mockRepoFactory,
        },
        {
          provide: getRepositoryToken(Account),
          useFactory: mockRepoFactory,
        },
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: TransactionService,
          useValue: transactionService,
        },
      ],
    }).compile();

    service = module.get(BankConnectionService);
    connectionRepo = module.get(getRepositoryToken(BankConnection));
    linkedAccountRepo = module.get(getRepositoryToken(LinkedBankAccount));
    accountRepo = module.get(getRepositoryToken(Account));
  });

  it('creates a scoped connection, linked accounts, and missing finance accounts from provider metadata', async () => {
    const savedConnection = {
      id: 'connection-1',
      provider: 'plaid',
      itemId: 'item-1',
      accessToken: 'access-1',
      institutionName: 'Bank of Tests',
      institutionId: 'ins_1',
      status: 'healthy',
      userId: 'user-1',
      profileId: 'profile-1',
      tenantId: 'tenant-1',
      appScope: 'finance',
    } as BankConnection;

    connectionRepo.create.mockReturnValue(savedConnection);
    connectionRepo.save.mockResolvedValue(savedConnection);
    accountRepo.findOne.mockResolvedValue(null);
    accountService.create.mockResolvedValue({
      id: 'finance-account-1',
    });
    linkedAccountRepo.create.mockImplementation((value) => value as any);
    linkedAccountRepo.save.mockResolvedValue([] as any);
    transactionService.syncBankFeed.mockResolvedValue({ added: 2, modified: 0, removed: 0 });

    const result = await service.createConnection({
      provider: 'plaid',
      status: 'healthy',
      institutionId: 'ins_1',
      institutionName: 'Bank of Tests',
      itemId: 'item-1',
      accessToken: 'access-1',
      userId: 'user-1',
      profileId: 'profile-1',
      tenantId: 'tenant-1',
      appScope: 'finance',
      workspace: 'personal',
      accounts: [
        {
          providerAccountId: 'provider-account-1',
          name: 'Plaid Checking',
          mask: '1234',
          subtype: 'checking',
          type: 'depository',
          balance: 1400.25,
          currency: 'USD',
        },
      ],
    } as any);

    expect(connectionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'plaid',
        institutionName: 'Bank of Tests',
        itemId: 'item-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
      })
    );
    expect(accountService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Plaid Checking',
        type: 'bank',
        balance: 1400.25,
        workspace: 'personal',
        tenantId: 'tenant-1',
      })
    );
    expect(linkedAccountRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          providerAccountId: 'provider-account-1',
          financeAccountId: 'finance-account-1',
        }),
      ])
    );
    expect(transactionService.syncBankFeed).toHaveBeenCalledWith(
      'connection-1',
      expect.objectContaining({
        userId: 'user-1',
        tenantId: 'tenant-1',
      })
    );
    expect(result).toBe(savedConnection);
  });

  it('marks a connection disconnected within scope', async () => {
    const existing = {
      id: 'connection-1',
      status: 'healthy',
    } as BankConnection;
    connectionRepo.findOne.mockResolvedValue(existing);
    connectionRepo.update.mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] });
    connectionRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce({
      ...existing,
      status: 'disconnected',
      isActive: false,
    } as BankConnection);

    const result = await service.disconnectConnection('connection-1', {
      userId: 'user-1',
      profileId: 'profile-1',
      tenantId: 'tenant-1',
      appScope: 'finance',
    });

    expect(connectionRepo.update).toHaveBeenCalledWith('connection-1', {
      status: 'disconnected',
      isActive: false,
      lastError: null,
    });
    expect(result?.status).toBe('disconnected');
  });
});
