import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccountService } from './account.service';
import { Account } from '../../entities/account.entity';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((value: string) => value.replace(/<[^>]*>/g, '')),
  },
}));

/**
 * The spec beside this one covers scope merging on findOne; these cover the
 * create/update/remove/updateBalance bodies.
 */
describe('AccountService CRUD', () => {
  let service: AccountService;
  let repo: jest.Mocked<Repository<Account>>;

  const account = (overrides: Partial<Account> = {}) =>
    ({ id: 'acc-1', name: 'Checking', balance: 0, ...overrides } as Account);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: getRepositoryToken(Account),
          useFactory: () => ({
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          }),
        },
      ],
    }).compile();

    service = module.get(AccountService);
    repo = module.get(getRepositoryToken(Account));
  });

  describe('create', () => {
    it('sanitizes the name and description', async () => {
      repo.create.mockReturnValue(account());
      repo.save.mockResolvedValue(account());

      await service.create({
        name: '<b>Checking</b>',
        description: '<i>Main</i>',
      } as never);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Checking', description: 'Main' })
      );
    });

    it('leaves an absent description undefined', async () => {
      repo.create.mockReturnValue(account());
      repo.save.mockResolvedValue(account());

      await service.create({ name: 'Checking' } as never);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: undefined })
      );
    });
  });

  describe('findAll', () => {
    it('merges the scope into the where clause', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll({ userId: 'user-1' }, { take: 10 });

      expect(repo.find).toHaveBeenCalledWith({
        take: 10,
        where: { userId: 'user-1' },
      });
    });
  });

  describe('update', () => {
    it('rejects an unknown account', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', {} as never)).rejects.toThrow(
        NotFoundException
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('sanitizes the name and writes only supplied fields', async () => {
      repo.findOne.mockResolvedValue(account());

      await service.update('acc-1', {
        name: '<b>Savings</b>',
        type: 'asset',
      } as never);

      expect(repo.update).toHaveBeenCalledWith('acc-1', {
        name: 'Savings',
        type: 'asset',
      });
    });

    it('nulls a description that is explicitly cleared', async () => {
      repo.findOne.mockResolvedValue(account());

      await service.update('acc-1', { description: '' } as never);

      expect(repo.update).toHaveBeenCalledWith('acc-1', { description: null });
    });

    it('writes zero balance and false isActive rather than skipping them', async () => {
      repo.findOne.mockResolvedValue(account());

      await service.update('acc-1', {
        balance: 0,
        isActive: false,
      } as never);

      expect(repo.update).toHaveBeenCalledWith('acc-1', {
        balance: 0,
        isActive: false,
      });
    });

    it('carries the provider linkage fields, including explicit nulls', async () => {
      repo.findOne.mockResolvedValue(account());
      const lastReviewedAt = new Date('2026-03-04T00:00:00.000Z');

      await service.update('acc-1', {
        lastReviewedAt,
        providerConnectionId: null,
        providerAccountId: 'prov-acc-1',
        institutionName: 'Chase',
        workspace: 'business',
      } as never);

      expect(repo.update).toHaveBeenCalledWith('acc-1', {
        lastReviewedAt,
        providerConnectionId: null,
        providerAccountId: 'prov-acc-1',
        institutionName: 'Chase',
        workspace: 'business',
      });
    });

    it('writes nothing for an empty patch', async () => {
      repo.findOne.mockResolvedValue(account());

      await service.update('acc-1', {} as never);

      expect(repo.update).toHaveBeenCalledWith('acc-1', {});
    });
  });

  describe('remove', () => {
    it('rejects an unknown account', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes an existing account', async () => {
      repo.findOne.mockResolvedValue(account());

      await service.remove('acc-1');

      expect(repo.delete).toHaveBeenCalledWith('acc-1');
    });
  });

  describe('updateBalance', () => {
    it('rejects an unknown account', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.updateBalance('missing', 10)).rejects.toThrow(
        NotFoundException
      );
    });

    it('adds to the running balance', async () => {
      repo.findOne.mockResolvedValue(account({ balance: 100 }));

      await service.updateBalance('acc-1', 25);

      expect(repo.update).toHaveBeenCalledWith('acc-1', { balance: 125 });
    });

    it('coerces a string balance before adding', async () => {
      repo.findOne.mockResolvedValue(account({ balance: '100.25' as never }));

      await service.updateBalance('acc-1', 0.75);

      expect(repo.update).toHaveBeenCalledWith('acc-1', { balance: 101 });
    });

    it('subtracts for a negative amount', async () => {
      repo.findOne.mockResolvedValue(account({ balance: 100 }));

      await service.updateBalance('acc-1', -30);

      expect(repo.update).toHaveBeenCalledWith('acc-1', { balance: 70 });
    });
  });
});
