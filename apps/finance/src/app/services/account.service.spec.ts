import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountService } from './account.service';
import { Account } from '../../entities/account.entity';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((value: string) => value),
  },
}));

describe('AccountService', () => {
  let service: AccountService;
  let accountRepo: jest.Mocked<Repository<Account>>;

  const mockRepoFactory = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: getRepositoryToken(Account),
          useFactory: mockRepoFactory,
        },
      ],
    }).compile();

    service = module.get(AccountService);
    accountRepo = module.get(getRepositoryToken(Account));
  });

  it('merges ownership filters when finding one account', async () => {
    accountRepo.findOne.mockResolvedValue(null);

    await service.findOne('account-1', {
      userId: 'user-1',
      profileId: 'profile-1',
      appScope: 'finance',
    } as any);

    expect(accountRepo.findOne).toHaveBeenCalledWith({
      where: {
        id: 'account-1',
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
      },
    });
  });

  it('includes tenantId in scoped account lookups', async () => {
    accountRepo.findOne.mockResolvedValue(null);

    await service.findOne('account-1', {
      userId: 'user-1',
      profileId: 'profile-1',
      appScope: 'finance',
      tenantId: 'tenant-1',
    } as any);

    expect(accountRepo.findOne).toHaveBeenCalledWith({
      where: {
        id: 'account-1',
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'finance',
        tenantId: 'tenant-1',
      },
    });
  });
});
