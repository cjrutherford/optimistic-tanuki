import { CreateProjectDto, QueryProjectDto, UpdateProjectDto } from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { ArrayContains, Between, FindOptionsWhere, In, IsNull, Not, Repository } from 'typeorm';

@Injectable()
export class ProjectService {

  constructor(
    @Inject(getRepositoryToken(Project)) private readonly projectRepository: Repository<Project>,
  ) {}
  async create(createProjectDto: CreateProjectDto) {
    const project = this.projectRepository.create(createProjectDto);
    return await this.projectRepository.save(project);
  }

  async findAll(query: QueryProjectDto) {
    const where: FindOptionsWhere<Project> = {};

    if (query.name) {
      where.name = query.name;
    }
    if (query.description) {
      where.description = query.description;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.createdBy) {
      where.createdBy = query.createdBy;
    }
    if (query.updatedBy) {
      where.updatedBy = query.updatedBy;
    }
    if (query.createdAt) {
      where.createdAt = Between(...query.createdAt);
    }
    if (query.updatedAt) {
      where.updatedAt = Between(...query.updatedAt);
    }
    if (query.deleted) {
      where.deletedAt = Not(IsNull());
    }
    if (query.owner) {
      where.owner = query.owner;
    }
    if (query.members) {
      where.members = ArrayContains(query.members);
    }
    return await this.projectRepository.find({ where });
  }

  async findOne(id: string) {
    return await this.projectRepository.findOne({ where: { id } });
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    return await this.projectRepository.update(id, updateProjectDto);
  }

  async remove(id: string) {
    return await this.projectRepository.update(id, { deletedAt: new Date() });
  }
}
