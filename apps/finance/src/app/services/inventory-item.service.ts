import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';
import {
  FinanceScope,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

@Injectable()
export class InventoryItemService {
  constructor(
    @Inject(getRepositoryToken(InventoryItem))
    private readonly inventoryItemRepo: Repository<InventoryItem>
  ) {}

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  async create(createInventoryItemDto: CreateInventoryItemDto): Promise<InventoryItem> {
    const totalValue = createInventoryItemDto.quantity * createInventoryItemDto.unitValue;
    const inventoryItem = this.inventoryItemRepo.create({
      ...createInventoryItemDto,
      name: this.sanitizeContent(createInventoryItemDto.name),
      description: createInventoryItemDto.description ? this.sanitizeContent(createInventoryItemDto.description) : undefined,
      totalValue,
    });
    return await this.inventoryItemRepo.save(inventoryItem);
  }

  async findAll(
    scope?: FinanceScope,
    options?: FindManyOptions<InventoryItem>
  ): Promise<InventoryItem[]> {
    return await this.inventoryItemRepo.find(
      withScopedFindManyOptions(scope, options)
    );
  }

  async findOne(
    id: string,
    scope?: FinanceScope,
    options?: FindOneOptions<InventoryItem>
  ): Promise<InventoryItem | null> {
    return await this.inventoryItemRepo.findOne(
      withScopedFindOneOptions(id, scope, options)
    );
  }

  async update(
    id: string,
    updateInventoryItemDto: UpdateInventoryItemDto,
    scope?: FinanceScope
  ): Promise<InventoryItem> {
    const inventoryItem = await this.findOne(id, scope);
    if (!inventoryItem) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    
    const updatedData: Partial<InventoryItem> = {};
    if (updateInventoryItemDto.name) {
      updatedData.name = this.sanitizeContent(updateInventoryItemDto.name);
    }
    if (updateInventoryItemDto.description !== undefined) {
      updatedData.description = updateInventoryItemDto.description ? this.sanitizeContent(updateInventoryItemDto.description) : null;
    }
    if (updateInventoryItemDto.quantity !== undefined) {
      updatedData.quantity = updateInventoryItemDto.quantity;
    }
    if (updateInventoryItemDto.unitValue !== undefined) {
      updatedData.unitValue = updateInventoryItemDto.unitValue;
    }
    if (updateInventoryItemDto.category) {
      updatedData.category = this.sanitizeContent(updateInventoryItemDto.category);
    }
    if (updateInventoryItemDto.isActive !== undefined) {
      updatedData.isActive = updateInventoryItemDto.isActive;
    }
    if (updateInventoryItemDto.workspace) {
      updatedData.workspace = updateInventoryItemDto.workspace;
    }
    
    // Recalculate total value
    const quantity = updatedData.quantity ?? inventoryItem.quantity;
    const unitValue = updatedData.unitValue ?? inventoryItem.unitValue;
    updatedData.totalValue = quantity * unitValue;

    await this.inventoryItemRepo.update(id, updatedData);
    return await this.findOne(id, scope);
  }

  async remove(id: string, scope?: FinanceScope): Promise<void> {
    const inventoryItem = await this.findOne(id, scope);
    if (!inventoryItem) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }

    await this.inventoryItemRepo.delete(id);
  }
}
