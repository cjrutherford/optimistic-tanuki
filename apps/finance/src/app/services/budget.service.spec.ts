import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BudgetService } from './budget.service';
import { Budget } from '../../entities/budget.entity';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((value: string) => value.replace(/<[^>]*>/g, '')),
  },
}));

describe('BudgetService', () => {
  let service: BudgetService;
  let budgetRepo: jest.Mocked<Repository<Budget>>;

  const budget = (overrides: Partial<Budget> = {}) =>
    ({ id: 'bud-1', name: 'Groceries', spent: 0, ...overrides } as Budget);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        {
          provide: getRepositoryToken(Budget),
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

    service = module.get(BudgetService);
    budgetRepo = module.get(getRepositoryToken(Budget));
  });

  describe('create', () => {
    it('sanitizes the name and category before saving', async () => {
      budgetRepo.create.mockReturnValue(budget());
      budgetRepo.save.mockResolvedValue(budget());

      await service.create({
        name: '<b>Groceries</b>',
        category: '<i>food</i>',
        limit: 500,
      } as never);

      expect(budgetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Groceries', category: 'food' })
      );
      expect(budgetRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('passes the scope through as a where clause', async () => {
      budgetRepo.find.mockResolvedValue([]);

      await service.findAll({ userId: 'user-1', tenantId: 'ten-1' });

      expect(budgetRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', tenantId: 'ten-1' },
      });
    });

    it('leaves options untouched with no scope', async () => {
      budgetRepo.find.mockResolvedValue([]);

      await service.findAll(undefined, { take: 5 });

      expect(budgetRepo.find).toHaveBeenCalledWith({
        take: 5,
        where: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('scopes the lookup by id plus ownership', async () => {
      budgetRepo.findOne.mockResolvedValue(null);

      await service.findOne('bud-1', { profileId: 'prof-1' });

      expect(budgetRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'bud-1', profileId: 'prof-1' },
      });
    });
  });

  describe('update', () => {
    it('rejects an unknown budget', async () => {
      budgetRepo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', {} as never)).rejects.toThrow(
        NotFoundException
      );
      expect(budgetRepo.update).not.toHaveBeenCalled();
    });

    it('writes only the supplied fields, sanitizing text', async () => {
      budgetRepo.findOne.mockResolvedValue(budget());

      await service.update('bud-1', {
        name: '<b>Rent</b>',
        category: '<i>housing</i>',
        limit: 900,
      } as never);

      expect(budgetRepo.update).toHaveBeenCalledWith('bud-1', {
        name: 'Rent',
        category: 'housing',
        limit: 900,
      });
    });

    it('treats false and zero as values worth writing', async () => {
      budgetRepo.findOne.mockResolvedValue(budget());

      await service.update('bud-1', {
        limit: 0,
        spent: 0,
        isActive: false,
        alertOnExceed: false,
      } as never);

      expect(budgetRepo.update).toHaveBeenCalledWith('bud-1', {
        limit: 0,
        spent: 0,
        isActive: false,
        alertOnExceed: false,
      });
    });

    it('writes nothing for an empty patch', async () => {
      budgetRepo.findOne.mockResolvedValue(budget());

      await service.update('bud-1', {} as never);

      expect(budgetRepo.update).toHaveBeenCalledWith('bud-1', {});
    });

    it('carries period and workspace through', async () => {
      budgetRepo.findOne.mockResolvedValue(budget());

      await service.update('bud-1', {
        period: 'monthly',
        workspace: 'business',
      } as never);

      expect(budgetRepo.update).toHaveBeenCalledWith('bud-1', {
        period: 'monthly',
        workspace: 'business',
      });
    });
  });

  describe('remove', () => {
    it('rejects an unknown budget', async () => {
      budgetRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException
      );
      expect(budgetRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes an existing budget', async () => {
      budgetRepo.findOne.mockResolvedValue(budget());

      await service.remove('bud-1');

      expect(budgetRepo.delete).toHaveBeenCalledWith('bud-1');
    });
  });

  describe('updateSpent', () => {
    it('rejects an unknown budget', async () => {
      budgetRepo.findOne.mockResolvedValue(null);

      await expect(service.updateSpent('missing', 10)).rejects.toThrow(
        NotFoundException
      );
    });

    it('adds the amount to the running total', async () => {
      budgetRepo.findOne.mockResolvedValue(budget({ spent: 40 }));

      await service.updateSpent('bud-1', 10);

      expect(budgetRepo.update).toHaveBeenCalledWith('bud-1', { spent: 50 });
    });

    it('coerces a string total before adding', async () => {
      budgetRepo.findOne.mockResolvedValue(budget({ spent: '40.50' as never }));

      await service.updateSpent('bud-1', 9.5);

      expect(budgetRepo.update).toHaveBeenCalledWith('bud-1', { spent: 50 });
    });

    it('subtracts for a negative amount', async () => {
      budgetRepo.findOne.mockResolvedValue(budget({ spent: 40 }));

      await service.updateSpent('bud-1', -15);

      expect(budgetRepo.update).toHaveBeenCalledWith('bud-1', { spent: 25 });
    });
  });
});
