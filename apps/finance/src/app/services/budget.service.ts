import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Budget } from '../../entities/budget.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  CreateBudgetDto,
  UpdateBudgetDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';
import {
  FinanceScope,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

@Injectable()
export class BudgetService {
  constructor(
    @Inject(getRepositoryToken(Budget))
    private readonly budgetRepo: Repository<Budget>
  ) {}

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  async create(createBudgetDto: CreateBudgetDto): Promise<Budget> {
    const budget = this.budgetRepo.create({
      ...createBudgetDto,
      name: this.sanitizeContent(createBudgetDto.name),
      category: this.sanitizeContent(createBudgetDto.category),
    });
    return await this.budgetRepo.save(budget);
  }

  async findAll(
    scope?: FinanceScope,
    options?: FindManyOptions<Budget>
  ): Promise<Budget[]> {
    return await this.budgetRepo.find(withScopedFindManyOptions(scope, options));
  }

  async findOne(
    id: string,
    scope?: FinanceScope,
    options?: FindOneOptions<Budget>
  ): Promise<Budget | null> {
    return await this.budgetRepo.findOne(
      withScopedFindOneOptions(id, scope, options)
    );
  }

  async update(
    id: string,
    updateBudgetDto: UpdateBudgetDto,
    scope?: FinanceScope
  ): Promise<Budget> {
    const budget = await this.findOne(id, scope);
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found`);
    }
    
    const updatedData: Partial<Budget> = {};
    if (updateBudgetDto.name) {
      updatedData.name = this.sanitizeContent(updateBudgetDto.name);
    }
    if (updateBudgetDto.category) {
      updatedData.category = this.sanitizeContent(updateBudgetDto.category);
    }
    if (updateBudgetDto.limit !== undefined) {
      updatedData.limit = updateBudgetDto.limit;
    }
    if (updateBudgetDto.spent !== undefined) {
      updatedData.spent = updateBudgetDto.spent;
    }
    if (updateBudgetDto.period) {
      updatedData.period = updateBudgetDto.period;
    }
    if (updateBudgetDto.isActive !== undefined) {
      updatedData.isActive = updateBudgetDto.isActive;
    }
    if (updateBudgetDto.alertOnExceed !== undefined) {
      updatedData.alertOnExceed = updateBudgetDto.alertOnExceed;
    }
    if (updateBudgetDto.workspace) {
      updatedData.workspace = updateBudgetDto.workspace;
    }

    await this.budgetRepo.update(id, updatedData);
    return await this.findOne(id, scope);
  }

  async remove(id: string, scope?: FinanceScope): Promise<void> {
    const budget = await this.findOne(id, scope);
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found`);
    }

    await this.budgetRepo.delete(id);
  }

  async updateSpent(
    id: string,
    amount: number,
    scope?: FinanceScope
  ): Promise<Budget> {
    const budget = await this.findOne(id, scope);
    if (!budget) {
      throw new NotFoundException(`Budget with ID ${id} not found`);
    }
    
    const newSpent = Number(budget.spent) + amount;
    await this.budgetRepo.update(id, { spent: newSpent });
    return await this.findOne(id, scope);
  }
}
