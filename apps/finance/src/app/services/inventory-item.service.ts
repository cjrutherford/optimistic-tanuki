import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';

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

  async findAll(options?: FindManyOptions<InventoryItem>): Promise<InventoryItem[]> {
    return await this.inventoryItemRepo.find(options);
  }

  async findOne(
    id: string,
    options?: FindOneOptions<InventoryItem>
  ): Promise<InventoryItem | null> {
    return await this.inventoryItemRepo.findOne({
      where: { id },
      ...options,
    });
  }

  async update(id: string, updateInventoryItemDto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const inventoryItem = await this.findOne(id);
    if (!inventoryItem) {
      throw new Error(`Inventory item with ID ${id} not found`);
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
    
    // Recalculate total value
    const quantity = updatedData.quantity ?? inventoryItem.quantity;
    const unitValue = updatedData.unitValue ?? inventoryItem.unitValue;
    updatedData.totalValue = quantity * unitValue;

    await this.inventoryItemRepo.update(id, updatedData);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.inventoryItemRepo.delete(id);
  }
}
