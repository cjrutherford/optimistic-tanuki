import {
  CreateRiskDto,
  QueryRiskDto,
  UpdateRiskDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Risk } from '../entities/risk.entity';
import { Between, FindOptionsWhere, In, Like, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import {
  assertFound,
  assertProjectAccess,
  getAccessibleProjectIds,
} from '../common/project-access.util';

@Injectable()
export class RiskService {
  constructor(
    @Inject(getRepositoryToken(Risk))
    private readonly riskRepository: Repository<Risk>,
    @Inject(getRepositoryToken(Project))
    private readonly projectRepository: Repository<Project>
  ) {}

  async create(createRiskDto: CreateRiskDto, requestingUserId?: string) {
    console.log('RiskService.create received:', JSON.stringify(createRiskDto));
    const project = await this.projectRepository.findOne({
      where: { id: createRiskDto.projectId },
    });
    if (!project) {
      throw new Error(`Project with id ${createRiskDto.projectId} not found`);
    }
    if (requestingUserId) {
      assertProjectAccess(project, requestingUserId);
    }
    const riskData = {
      description: createRiskDto.description || createRiskDto.name, // Fallback to name if description is missing
      impact: createRiskDto.impact,
      likelihood: createRiskDto.likelihood,
      status: createRiskDto.status,
      riskOwner: createRiskDto.riskOwner,
      project,
      createdBy: createRiskDto.riskOwner,
      updatedBy: createRiskDto.riskOwner,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    console.log(
      'RiskService.create creating entity with:',
      JSON.stringify(riskData)
    );
    const risk = this.riskRepository.create(riskData);
    return await this.riskRepository.save(risk);
  }

  async findAll(query: QueryRiskDto, requestingUserId?: string) {
    const where: FindOptionsWhere<Risk> = {};
    for (const key of [
      'impact',
      'likelihood',
      'status',
      'resolution',
      'createdBy',
      'updatedBy',
    ]) {
      if (query[key]) {
        where[key] = query[key];
      }
    }
    for (const key of ['createdAt', 'updatedAt']) {
      if (query[key]) {
        where[key] = Between(...(query[key] as [Date, Date]));
      }
    }

    for (const key of ['description', 'mitigationPlan', 'riskOwner']) {
      if (query[key]) {
        where[key] = Like(`%${query[key]}%`);
      }
    }

    if (requestingUserId) {
      const accessibleProjectIds = await getAccessibleProjectIds(
        this.projectRepository,
        requestingUserId
      );
      if (query.projectId) {
        if (!accessibleProjectIds.includes(query.projectId)) {
          return [];
        }
        where.project = { id: query.projectId };
      } else {
        if (accessibleProjectIds.length === 0) {
          return [];
        }
        where.project = { id: In(accessibleProjectIds) };
      }
    } else if (query.projectId) {
      where.project = { id: query.projectId };
    }
    return await this.riskRepository.find({ where });
  }

  async findOne(id: string, requestingUserId?: string) {
    const risk = await this.riskRepository.findOne({
      where: { id },
      relations: ['project'],
    });
    if (requestingUserId) {
      assertFound(risk, `Risk with id ${id} not found`);
      assertProjectAccess(risk.project, requestingUserId);
    }
    return risk;
  }

  async update(
    id: string,
    updateRiskDto: UpdateRiskDto,
    requestingUserId?: string
  ) {
    if (requestingUserId) {
      const risk = await this.riskRepository.findOne({
        where: { id },
        relations: ['project'],
      });
      assertFound(risk, `Risk with id ${id} not found`);
      assertProjectAccess(risk.project, requestingUserId);
    }
    delete updateRiskDto.projectId;
    await this.riskRepository.update(id, updateRiskDto);
    return await this.riskRepository.findOne({ where: { id } });
  }

  async remove(id: string, requestingUserId?: string) {
    if (requestingUserId) {
      const risk = await this.riskRepository.findOne({
        where: { id },
        relations: ['project'],
      });
      assertFound(risk, `Risk with id ${id} not found`);
      assertProjectAccess(risk.project, requestingUserId);
    }
    await this.riskRepository.update(id, { deletedAt: new Date() });
    return await this.riskRepository.findOne({ where: { id } });
  }
}
