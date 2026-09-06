import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RecurringItemService } from './recurring-item.service';
import { RecurringItem } from '../../entities/recurring-item.entity';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((value: string) => value.replace(/<[^>]*>/g, '')),
  },
}));

describe('RecurringItemService', () => {
  let service: RecurringItemService;
  let repo: jest.Mocked<Repository<RecurringItem>>;

  const recurring = (overrides: Partial<RecurringItem> = {}) =>
    ({ id: 'rec-1', name: 'Rent', ...overrides } as RecurringItem);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringItemService,
        {
          provide: getRepositoryToken(RecurringItem),
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

    service = module.get(RecurringItemService);
    repo = module.get(getRepositoryToken(RecurringItem));
  });

  describe('create', () => {
    it('sanitizes text fields and defaults the status', async () => {
      repo.create.mockReturnValue(recurring());
      repo.save.mockResolvedValue(recurring());

      await service.create({
        name: '<b>Rent</b>',
        category: '<i>housing</i>',
        payeeOrVendor: '<b>Landlord</b>',
        notes: '<i>monthly</i>',
        amount: 1200,
      } as never);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Rent',
          category: 'housing',
          payeeOrVendor: 'Landlord',
          notes: 'monthly',
          status: 'scheduled',
        })
      );
    });

    it('keeps an explicit status', async () => {
      repo.create.mockReturnValue(recurring());
      repo.save.mockResolvedValue(recurring());

      await service.create({ name: 'Rent', status: 'paused' } as never);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'paused' })
      );
    });

    it('passes through nullish text without sanitizing', async () => {
      repo.create.mockReturnValue(recurring());
      repo.save.mockResolvedValue(recurring());

      await service.create({
        name: 'Rent',
        notes: null,
        payeeOrVendor: undefined,
      } as never);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ notes: null, payeeOrVendor: undefined })
      );
    });
  });

  describe('findAll / findOne', () => {
    it('applies the scope to a list query', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll({ tenantId: 'ten-1' });

      expect(repo.find).toHaveBeenCalledWith({ where: { tenantId: 'ten-1' } });
    });

    it('applies the scope alongside the id', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.findOne('rec-1', { userId: 'user-1' });

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'rec-1', userId: 'user-1' },
      });
    });
  });

  describe('update', () => {
    it('rejects an unknown item', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', {} as never)).rejects.toThrow(
        NotFoundException
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('sanitizes the text fields it is given', async () => {
      repo.findOne.mockResolvedValue(recurring());

      await service.update('rec-1', {
        name: '<b>Mortgage</b>',
        category: '<i>housing</i>',
        payeeOrVendor: '<b>Bank</b>',
        notes: '<i>auto</i>',
      } as never);

      expect(repo.update).toHaveBeenCalledWith('rec-1', {
        name: 'Mortgage',
        category: 'housing',
        payeeOrVendor: 'Bank',
        notes: 'auto',
      });
    });

    it('writes explicit nulls for cleared text', async () => {
      repo.findOne.mockResolvedValue(recurring());

      await service.update('rec-1', { notes: null } as never);

      expect(repo.update).toHaveBeenCalledWith('rec-1', { notes: null });
    });

    it('carries scalar fields including false and zero', async () => {
      repo.findOne.mockResolvedValue(recurring());

      await service.update('rec-1', {
        amount: 0,
        isActive: false,
        cadence: 'weekly',
        status: 'paused',
        accountId: 'acc-1',
        workspace: 'personal',
      } as never);

      expect(repo.update).toHaveBeenCalledWith('rec-1', {
        amount: 0,
        isActive: false,
        cadence: 'weekly',
        status: 'paused',
        accountId: 'acc-1',
        workspace: 'personal',
      });
    });

    it('carries the next due date', async () => {
      repo.findOne.mockResolvedValue(recurring());
      const nextDueDate = new Date('2026-04-01T00:00:00.000Z');

      await service.update('rec-1', { nextDueDate, type: 'expense' } as never);

      expect(repo.update).toHaveBeenCalledWith('rec-1', {
        nextDueDate,
        type: 'expense',
      });
    });

    it('writes nothing for an empty patch', async () => {
      repo.findOne.mockResolvedValue(recurring());

      await service.update('rec-1', {} as never);

      expect(repo.update).toHaveBeenCalledWith('rec-1', {});
    });
  });

  describe('remove', () => {
    it('rejects an unknown item', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes an existing item', async () => {
      repo.findOne.mockResolvedValue(recurring());

      await service.remove('rec-1');

      expect(repo.delete).toHaveBeenCalledWith('rec-1');
    });
  });
});
