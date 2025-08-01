import { CreateChangeDto, QueryChangeDto, UpdateChangeDto } from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Change } from '../entities/change.entity';
import { Between, FindOptionsWhere, Repository, Like } from 'typeorm';
import { Project } from '../entities/project.entity';

@Injectable()
export class ChangeService {

  constructor(
    @Inject(getRepositoryToken(Change)) private readonly changeRepository: Repository<Change>,
    @Inject(getRepositoryToken(Project)) private readonly projectRepository: Repository<Project>,
  ) {}

  async create(createChangeDto: CreateChangeDto) {
    const project = await this.projectRepository.findOne({ where: { id: createChangeDto.projectId } });
    if (!project) {
      throw new Error(`Project with id ${createChangeDto.projectId} not found`);
    }
    const change = this.changeRepository.create({
      ...createChangeDto,
      project, // Associate the change with the project
      updatedBy: createChangeDto.requestor,
      approver: createChangeDto.requestor,
      createdBy: createChangeDto.requestor,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return await this.changeRepository.save(change);
  }

  async findAll(query: QueryChangeDto) {
    const where: FindOptionsWhere<Change> = {};
    for (const key of ['createdBy', 'updatedBy', 'requestor', 'approver', 'changeType', 'changeDate']) {
      if (query[key]) {
        where[key] = query[key];
      }
    }
    for (const key of ['createdAt', 'updatedAt']) {
      if (query[key]) {
        where[key] = Between(...query[key] as [Date, Date])
      }
    }
    if (query.projectId) {
      where.project = { id: query.projectId }; // Assuming project is a relation
    }
    if (query.changeDescription) {
      where.changeDescription = Like(`%${query.changeDescription}%`);
    }
    return await this.changeRepository.find({ where });
  }

  async findOne(id: string) {
    return await this.changeRepository.findOne({ where: { id } });
  }

  async update(id: string, updateChangeDto: UpdateChangeDto) {
    await this.changeRepository.update(id, updateChangeDto);
    return await this.changeRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    return await this.changeRepository.update(id, { deletedAt: new Date() });
  }
}
