import {
  CreateProjectDto,
  QueryProjectDto,
  UpdateProjectDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import {
  ArrayContains,
  Between,
  FindOptionsWhere,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import {
  accessibleProjectWhere,
  assertFound,
  assertProjectAccess,
} from '../common/project-access.util';

@Injectable()
export class ProjectService {
  constructor(
    @Inject(getRepositoryToken(Project))
    private readonly projectRepository: Repository<Project>
  ) {}
  async create(createProjectDto: CreateProjectDto) {
    const project = this.projectRepository.create({
      ...createProjectDto,
      isPublic: createProjectDto.isPublic ?? false,
      requireHumanApproval: createProjectDto.requireHumanApproval ?? true,
      updatedBy: createProjectDto.owner,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return await this.projectRepository.save(project);
  }

  async findAll(query: QueryProjectDto, requestingUserId?: string) {
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

    const relations = ['tasks', 'risks', 'changes', 'journalEntries'];

    // Scope results to projects the caller owns or is a member of. When no
    // requesting user is supplied (trusted internal call) fall back to the
    // raw query.
    if (requestingUserId) {
      return await this.projectRepository.find({
        where: accessibleProjectWhere(where, requestingUserId),
        relations,
      });
    }

    return await this.projectRepository.find({ where, relations });
  }

  async findOne(id: string, requestingUserId?: string) {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['tasks', 'risks', 'changes', 'journalEntries'],
    });

    if (requestingUserId) {
      assertFound(project, `Project with id ${id} not found`);
      assertProjectAccess(project, requestingUserId);
    }

    return project;
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    requestingUserId?: string
  ) {
    if (requestingUserId) {
      const project = await this.projectRepository.findOne({ where: { id } });
      assertFound(project, `Project with id ${id} not found`);
      assertProjectAccess(project, requestingUserId);
    }

    return await this.projectRepository.update(id, {
      ...updateProjectDto,
      updatedAt: new Date(),
    });
  }

  async remove(id: string, requestingUserId?: string) {
    if (requestingUserId) {
      const project = await this.projectRepository.findOne({ where: { id } });
      assertFound(project, `Project with id ${id} not found`);
      assertProjectAccess(project, requestingUserId);
    }

    return await this.projectRepository.update(id, { deletedAt: new Date() });
  }
}
