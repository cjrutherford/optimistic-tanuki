import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Budget } from '../../entities/budget.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import {
  CreateBudgetDto,
  UpdateBudgetDto,
} from '@optimistic-tanuki/models';
import DOMPurify from 'isomorphic-dompurify';

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

  async findAll(options?: FindManyOptions<Budget>): Promise<Budget[]> {
    return await this.budgetRepo.find(options);
  }

  async findOne(
    id: string,
    options?: FindOneOptions<Budget>
  ): Promise<Budget | null> {
    return await this.budgetRepo.findOne({
      where: { id },
      ...options,
    });
  }

  async update(id: string, updateBudgetDto: UpdateBudgetDto): Promise<Budget> {
    const budget = await this.findOne(id);
    if (!budget) {
      throw new Error(`Budget with ID ${id} not found`);
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

    await this.budgetRepo.update(id, updatedData);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.budgetRepo.delete(id);
  }

  async updateSpent(id: string, amount: number): Promise<Budget> {
    const budget = await this.findOne(id);
    if (!budget) {
      throw new Error(`Budget with ID ${id} not found`);
    }
    
    const newSpent = Number(budget.spent) + amount;
    await this.budgetRepo.update(id, { spent: newSpent });
    return await this.findOne(id);
  }
}
