import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import DOMPurify from 'isomorphic-dompurify';
import {
  CreateRecurringItemDto,
  UpdateRecurringItemDto,
} from '@optimistic-tanuki/models';
import { RecurringItem } from '../../entities/recurring-item.entity';
import {
  FinanceScope,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

@Injectable()
export class RecurringItemService {
  constructor(
    @Inject(getRepositoryToken(RecurringItem))
    private readonly recurringItemRepo: Repository<RecurringItem>
  ) {}

  private sanitize(value?: string | null): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return DOMPurify.sanitize(value, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  async create(createRecurringItemDto: CreateRecurringItemDto): Promise<RecurringItem> {
    const recurringItem = this.recurringItemRepo.create({
      ...createRecurringItemDto,
      name: this.sanitize(createRecurringItemDto.name),
      category: this.sanitize(createRecurringItemDto.category),
      payeeOrVendor: this.sanitize(createRecurringItemDto.payeeOrVendor),
      notes: this.sanitize(createRecurringItemDto.notes),
      status: createRecurringItemDto.status ?? 'scheduled',
    });
    return await this.recurringItemRepo.save(recurringItem);
  }

  async findAll(
    scope?: FinanceScope,
    options?: FindManyOptions<RecurringItem>
  ): Promise<RecurringItem[]> {
    return await this.recurringItemRepo.find(withScopedFindManyOptions(scope, options));
  }

  async findOne(
    id: string,
    scope?: FinanceScope,
    options?: FindOneOptions<RecurringItem>
  ): Promise<RecurringItem | null> {
    return await this.recurringItemRepo.findOne(
      withScopedFindOneOptions(id, scope, options)
    );
  }

  async update(
    id: string,
    updateRecurringItemDto: UpdateRecurringItemDto,
    scope?: FinanceScope
  ): Promise<RecurringItem> {
    const recurringItem = await this.findOne(id, scope);
    if (!recurringItem) {
      throw new NotFoundException(`Recurring item with ID ${id} not found`);
    }

    const updatedData: Partial<RecurringItem> = {};
    if (updateRecurringItemDto.name !== undefined) {
      updatedData.name = this.sanitize(updateRecurringItemDto.name);
    }
    if (updateRecurringItemDto.amount !== undefined) {
      updatedData.amount = updateRecurringItemDto.amount;
    }
    if (updateRecurringItemDto.type !== undefined) {
      updatedData.type = updateRecurringItemDto.type;
    }
    if (updateRecurringItemDto.category !== undefined) {
      updatedData.category = this.sanitize(updateRecurringItemDto.category);
    }
    if (updateRecurringItemDto.cadence !== undefined) {
      updatedData.cadence = updateRecurringItemDto.cadence;
    }
    if (updateRecurringItemDto.nextDueDate !== undefined) {
      updatedData.nextDueDate = updateRecurringItemDto.nextDueDate;
    }
    if (updateRecurringItemDto.status !== undefined) {
      updatedData.status = updateRecurringItemDto.status;
    }
    if (updateRecurringItemDto.payeeOrVendor !== undefined) {
      updatedData.payeeOrVendor = this.sanitize(updateRecurringItemDto.payeeOrVendor);
    }
    if (updateRecurringItemDto.notes !== undefined) {
      updatedData.notes = this.sanitize(updateRecurringItemDto.notes);
    }
    if (updateRecurringItemDto.accountId !== undefined) {
      updatedData.accountId = updateRecurringItemDto.accountId;
    }
    if (updateRecurringItemDto.isActive !== undefined) {
      updatedData.isActive = updateRecurringItemDto.isActive;
    }
    if (updateRecurringItemDto.workspace !== undefined) {
      updatedData.workspace = updateRecurringItemDto.workspace;
    }

    await this.recurringItemRepo.update(id, updatedData);
    return await this.findOne(id, scope);
  }

  async remove(id: string, scope?: FinanceScope): Promise<void> {
    const recurringItem = await this.findOne(id, scope);
    if (!recurringItem) {
      throw new NotFoundException(`Recurring item with ID ${id} not found`);
    }

    await this.recurringItemRepo.delete(id);
  }
}
