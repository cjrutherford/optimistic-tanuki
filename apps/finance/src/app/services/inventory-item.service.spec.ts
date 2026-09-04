import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InventoryItemService } from './inventory-item.service';
import { InventoryItem } from '../../entities/inventory-item.entity';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((value: string) => value.replace(/<[^>]*>/g, '')),
  },
}));

describe('InventoryItemService', () => {
  let service: InventoryItemService;
  let repo: jest.Mocked<Repository<InventoryItem>>;

  const item = (overrides: Partial<InventoryItem> = {}) =>
    ({
      id: 'inv-1',
      name: 'Flour',
      quantity: 2,
      unitValue: 5,
      ...overrides,
    } as InventoryItem);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryItemService,
        {
          provide: getRepositoryToken(InventoryItem),
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

    service = module.get(InventoryItemService);
    repo = module.get(getRepositoryToken(InventoryItem));
  });

  describe('create', () => {
    it('derives totalValue and sanitizes text', async () => {
      repo.create.mockReturnValue(item());
      repo.save.mockResolvedValue(item());

      await service.create({
        name: '<b>Flour</b>',
        description: '<i>Bulk</i>',
        quantity: 3,
        unitValue: 4,
      } as never);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Flour',
          description: 'Bulk',
          totalValue: 12,
        })
      );
    });

    it('leaves an absent description undefined', async () => {
      repo.create.mockReturnValue(item());
      repo.save.mockResolvedValue(item());

      await service.create({
        name: 'Flour',
        quantity: 1,
        unitValue: 1,
      } as never);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: undefined })
      );
    });
  });

  describe('findAll / findOne', () => {
    it('applies the scope to a list query', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll({ appScope: 'local-hub' });

      expect(repo.find).toHaveBeenCalledWith({
        where: { appScope: 'local-hub' },
      });
    });

    it('applies the scope alongside the id', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.findOne('inv-1', { userId: 'user-1' });

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'inv-1', userId: 'user-1' },
      });
    });
  });

  describe('update', () => {
    it('rejects an unknown item', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', {} as never)).rejects.toThrow(
        NotFoundException
      );
    });

    it('recalculates totalValue from the new quantity and unit value', async () => {
      repo.findOne.mockResolvedValue(item({ quantity: 2, unitValue: 5 }));

      await service.update('inv-1', { quantity: 4, unitValue: 3 } as never);

      expect(repo.update).toHaveBeenCalledWith(
        'inv-1',
        expect.objectContaining({ quantity: 4, unitValue: 3, totalValue: 12 })
      );
    });

    it('falls back to the stored values when recalculating', async () => {
      repo.findOne.mockResolvedValue(item({ quantity: 2, unitValue: 5 }));

      await service.update('inv-1', { quantity: 6 } as never);

      // unitValue is untouched, so the stored 5 is used.
      expect(repo.update).toHaveBeenCalledWith(
        'inv-1',
        expect.objectContaining({ totalValue: 30 })
      );
    });

    it('nulls a description that is explicitly cleared', async () => {
      repo.findOne.mockResolvedValue(item());

      await service.update('inv-1', { description: '' } as never);

      expect(repo.update).toHaveBeenCalledWith(
        'inv-1',
        expect.objectContaining({ description: null })
      );
    });

    it('sanitizes name and category', async () => {
      repo.findOne.mockResolvedValue(item());

      await service.update('inv-1', {
        name: '<b>Sugar</b>',
        category: '<i>dry</i>',
      } as never);

      expect(repo.update).toHaveBeenCalledWith(
        'inv-1',
        expect.objectContaining({ name: 'Sugar', category: 'dry' })
      );
    });

    it('carries isActive false and workspace through', async () => {
      repo.findOne.mockResolvedValue(item());

      await service.update('inv-1', {
        isActive: false,
        workspace: 'business',
      } as never);

      expect(repo.update).toHaveBeenCalledWith(
        'inv-1',
        expect.objectContaining({ isActive: false, workspace: 'business' })
      );
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
      repo.findOne.mockResolvedValue(item());

      await service.remove('inv-1');

      expect(repo.delete).toHaveBeenCalledWith('inv-1');
    });
  });
});
