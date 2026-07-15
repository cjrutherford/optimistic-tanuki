import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import DOMPurify from 'isomorphic-dompurify';
import {
  CreateFinCommanderScenarioDto,
  FinCommanderScenarioAssumptionDto,
  UpdateFinCommanderScenarioDto,
} from '@optimistic-tanuki/constants';
import { FinCommanderScenarioEntity } from '../../entities';
import {
  FinanceScope,
  withScopedFindManyOptions,
  withScopedFindOneOptions,
} from './finance-scope';

@Injectable()
export class FinCommanderScenarioService {
  constructor(
    @Inject(getRepositoryToken(FinCommanderScenarioEntity))
    private readonly scenarioRepo: Repository<FinCommanderScenarioEntity>
  ) {}

  private sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  private sanitizeAssumptions(
    assumptions?: FinCommanderScenarioAssumptionDto[]
  ): FinCommanderScenarioAssumptionDto[] {
    return (assumptions ?? []).map((assumption) => ({
      id: assumption.id,
      label: this.sanitizeContent(assumption.label),
      delta: this.sanitizeContent(assumption.delta),
      impactArea: assumption.impactArea,
    }));
  }

  async create(
    createScenarioDto: CreateFinCommanderScenarioDto & { tenantId: string }
  ): Promise<FinCommanderScenarioEntity> {
    const scenario = this.scenarioRepo.create({
      ...createScenarioDto,
      name: this.sanitizeContent(createScenarioDto.name),
      summary: createScenarioDto.summary
        ? this.sanitizeContent(createScenarioDto.summary)
        : '',
      assumptions: this.sanitizeAssumptions(createScenarioDto.assumptions),
    });
    return await this.scenarioRepo.save(scenario);
  }

  async findAll(
    scope?: FinanceScope,
    options?: FindManyOptions<FinCommanderScenarioEntity>
  ): Promise<FinCommanderScenarioEntity[]> {
    return await this.scenarioRepo.find(
      withScopedFindManyOptions(scope, options)
    );
  }

  async findOne(
    id: string,
    scope?: FinanceScope,
    options?: FindOneOptions<FinCommanderScenarioEntity>
  ): Promise<FinCommanderScenarioEntity | null> {
    return await this.scenarioRepo.findOne(
      withScopedFindOneOptions(id, scope, options)
    );
  }

  async update(
    id: string,
    updateScenarioDto: UpdateFinCommanderScenarioDto,
    scope?: FinanceScope
  ): Promise<FinCommanderScenarioEntity> {
    const scenario = await this.findOne(id, scope);
    if (!scenario) {
      throw new NotFoundException(`Scenario with ID ${id} not found`);
    }

    const updatedData: Partial<FinCommanderScenarioEntity> = {};
    if (updateScenarioDto.name) {
      updatedData.name = this.sanitizeContent(updateScenarioDto.name);
    }
    if (updateScenarioDto.summary !== undefined) {
      updatedData.summary = this.sanitizeContent(updateScenarioDto.summary);
    }
    if (updateScenarioDto.assumptions !== undefined) {
      updatedData.assumptions = this.sanitizeAssumptions(
        updateScenarioDto.assumptions
      );
    }

    await this.scenarioRepo.update(id, updatedData);
    return await this.findOne(id, scope);
  }

  async remove(id: string, scope?: FinanceScope): Promise<void> {
    const scenario = await this.findOne(id, scope);
    if (!scenario) {
      throw new NotFoundException(`Scenario with ID ${id} not found`);
    }

    await this.scenarioRepo.delete(id);
  }
}
