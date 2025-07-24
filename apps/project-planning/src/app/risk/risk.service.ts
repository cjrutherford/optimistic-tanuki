import { CreateRiskDto, QueryRiskDto, UpdateRiskDto } from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Risk } from '../entities/risk.entity';
import { Between, FindOptionsWhere, Like, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';

@Injectable()
export class RiskService {
  
  constructor(
    @Inject(getRepositoryToken(Risk)) private readonly riskRepository: Repository<Risk>,
    @Inject(getRepositoryToken(Project)) private readonly projectRepository: Repository<Project>,
  ) {}

  async create(createRiskDto: CreateRiskDto) {
    const project = await this.projectRepository.findOne({ where: { id: createRiskDto.projectId } });
    if (!project) {
      throw new Error(`Project with id ${createRiskDto.projectId} not found`);
    }
    const risk = this.riskRepository.create({
      ...createRiskDto,
      project, // Associate the risk with the project
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return await this.riskRepository.save(risk);
  }

  async findAll(query: QueryRiskDto) {
    const where: FindOptionsWhere<Risk> = {};
    for ( const key of ['impact', 'likelihood', 'status', 'resolution', 'createdBy', 'updatedBy'] ) {
      if (query[key]) {
        where[key] = query[key];
      }
    }
    for (const key of ['createdAt', 'updatedAt']) {
      if (query[key]) {
        where[key] = Between(...query[key] as [Date, Date]);
      }
    }
    
    for (const key of ['description', 'mitigationPlan', 'riskOwner']) {
      if (query[key]) {
        where[key] = Like(`%${query[key]}%`);
      }
    }
    if (query.projectId) {
      where.project = { id: query.projectId };
    }
    return await this.riskRepository.find({ where });
  }

  async findOne(id: string) {
    return await this.riskRepository.findOne({ where: { id } });
  }

  async update(id: string, updateRiskDto: UpdateRiskDto) {
    await this.riskRepository.update(id, updateRiskDto);
    return await this.riskRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    await this.riskRepository.update(id, { deletedAt: new Date() });
    return await this.riskRepository.findOne({ where: { id } });
  }
}
