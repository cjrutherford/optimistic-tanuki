import {
  CreateChangeDto,
  QueryChangeDto,
  UpdateChangeDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Change } from '../entities/change.entity';
import { Between, FindOptionsWhere, In, Repository, Like } from 'typeorm';
import { Project } from '../entities/project.entity';
import {
  assertFound,
  assertProjectAccess,
  getAccessibleProjectIds,
} from '../common/project-access.util';

@Injectable()
export class ChangeService {
  constructor(
    @Inject(getRepositoryToken(Change))
    private readonly changeRepository: Repository<Change>,
    @Inject(getRepositoryToken(Project))
    private readonly projectRepository: Repository<Project>
  ) {}

  async create(createChangeDto: CreateChangeDto, requestingUserId?: string) {
    const project = await this.projectRepository.findOne({
      where: { id: createChangeDto.projectId },
    });
    if (!project) {
      throw new Error(`Project with id ${createChangeDto.projectId} not found`);
    }
    if (requestingUserId) {
      assertProjectAccess(project, requestingUserId);
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

  async findAll(query: QueryChangeDto, requestingUserId?: string) {
    const where: FindOptionsWhere<Change> = {};
    for (const key of [
      'createdBy',
      'updatedBy',
      'requestor',
      'approver',
      'changeType',
      'changeDate',
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
      where.project = { id: query.projectId }; // Assuming project is a relation
    }
    if (query.changeDescription) {
      where.changeDescription = Like(`%${query.changeDescription}%`);
    }
    return await this.changeRepository.find({ where });
  }

  async findOne(id: string, requestingUserId?: string) {
    const change = await this.changeRepository.findOne({
      where: { id },
      relations: ['project'],
    });
    if (requestingUserId) {
      assertFound(change, `Change with id ${id} not found`);
      assertProjectAccess(change.project, requestingUserId);
    }
    return change;
  }

  async update(
    id: string,
    updateChangeDto: UpdateChangeDto,
    requestingUserId?: string
  ) {
    if (requestingUserId) {
      const existing = await this.changeRepository.findOne({
        where: { id },
        relations: ['project'],
      });
      assertFound(existing, `Change with id ${id} not found`);
      assertProjectAccess(existing.project, requestingUserId);
    }
    const { changeStatus: status, projectId, ...updateData } = updateChangeDto;
    const updatedChange: Partial<Change> = {
      ...updateData,
      status,
      updatedAt: new Date(),
      updatedBy: updateChangeDto.requestor,
    };
    await this.changeRepository.update(id, updatedChange);
    return await this.changeRepository.findOne({ where: { id } });
  }

  async remove(id: string, requestingUserId?: string) {
    if (requestingUserId) {
      const change = await this.changeRepository.findOne({
        where: { id },
        relations: ['project'],
      });
      assertFound(change, `Change with id ${id} not found`);
      assertProjectAccess(change.project, requestingUserId);
    }
    return await this.changeRepository.update(id, { deletedAt: new Date() });
  }
}
