import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import DOMPurify from 'isomorphic-dompurify';
import {
  CreateFinCommanderPlanDto,
  UpdateFinCommanderPlanDto,
} from '@optimistic-tanuki/constants';
import { FinCommanderPlanEntity } from '../../entities';
import {
  FinanceScope,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

@Injectable()
export class FinCommanderPlanService {
  constructor(
    @Inject(getRepositoryToken(FinCommanderPlanEntity))
    private readonly planRepo: Repository<FinCommanderPlanEntity>
  ) {}

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  async create(
    createPlanDto: CreateFinCommanderPlanDto & { tenantId: string }
  ): Promise<FinCommanderPlanEntity> {
    const plan = this.planRepo.create({
      ...createPlanDto,
      name: this.sanitizeContent(createPlanDto.name),
      description: createPlanDto.description
        ? this.sanitizeContent(createPlanDto.description)
        : null,
    });
    return await this.planRepo.save(plan);
  }

  async findAll(
    scope?: FinanceScope,
    options?: FindManyOptions<FinCommanderPlanEntity>
  ): Promise<FinCommanderPlanEntity[]> {
    return await this.planRepo.find(withScopedFindManyOptions(scope, options));
  }

  async findOne(
    id: string,
    scope?: FinanceScope,
    options?: FindOneOptions<FinCommanderPlanEntity>
  ): Promise<FinCommanderPlanEntity | null> {
    return await this.planRepo.findOne(
      withScopedFindOneOptions(id, scope, options)
    );
  }

  async update(
    id: string,
    updatePlanDto: UpdateFinCommanderPlanDto,
    scope?: FinanceScope
  ): Promise<FinCommanderPlanEntity> {
    const plan = await this.findOne(id, scope);
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    const updatedData: Partial<FinCommanderPlanEntity> = {};
    if (updatePlanDto.name) {
      updatedData.name = this.sanitizeContent(updatePlanDto.name);
    }
    if (updatePlanDto.description !== undefined) {
      updatedData.description = updatePlanDto.description
        ? this.sanitizeContent(updatePlanDto.description)
        : null;
    }
    if (updatePlanDto.defaultWorkspace) {
      updatedData.defaultWorkspace = updatePlanDto.defaultWorkspace;
    }

    await this.planRepo.update(id, updatedData);
    return await this.findOne(id, scope);
  }

  async remove(id: string, scope?: FinanceScope): Promise<void> {
    const plan = await this.findOne(id, scope);
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    await this.planRepo.delete(id);
  }
}
