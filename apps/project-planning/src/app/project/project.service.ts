import {
  CreateProjectDto,
  QueryProjectDto,
  UpdateProjectDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { withoutDeletedChildren } from '../common/without-deleted-children.util';
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
    const where: FindOptionsWhere<Project> = {
      deletedAt: IsNull(),
    };

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
      where: { id, deletedAt: IsNull() },
      relations: ['tasks', 'risks', 'changes', 'journalEntries'],
    });

    if (requestingUserId) {
      assertFound(project, `Project with id ${id} not found`);
      assertProjectAccess(project, requestingUserId);
    }

    return project ? withoutDeletedChildren(project) : project;
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    requestingUserId?: string
  ) {
    if ('owner' in updateProjectDto || 'members' in updateProjectDto) {
      throw new RpcException({
        statusCode: 400,
        message: 'Project owner and members cannot be changed through update',
      });
    }

    if (requestingUserId) {
      const project = await this.projectRepository.findOne({
        where: { id, deletedAt: IsNull() },
      });
      assertFound(project, `Project with id ${id} not found`);
      assertProjectAccess(project, requestingUserId);
    }

    const update = updateProjectDto as UpdateProjectDto & {
      updatedBy?: string;
    };
    const fields = {
      ...(update.name !== undefined ? { name: update.name } : {}),
      ...(update.description !== undefined
        ? { description: update.description }
        : {}),
      ...(update.startDate !== undefined
        ? { startDate: update.startDate }
        : {}),
      ...(update.endDate !== undefined ? { endDate: update.endDate } : {}),
      ...(update.status !== undefined ? { status: update.status } : {}),
      ...(update.appScope !== undefined ? { appScope: update.appScope } : {}),
      ...(update.updatedBy !== undefined
        ? { updatedBy: update.updatedBy }
        : {}),
      updatedAt: new Date(),
    };

    const result = await this.projectRepository.update(
      { id, deletedAt: IsNull() },
      fields
    );
    assertFound(result.affected === 1, `Project with id ${id} not found`);

    const refreshedProject = await this.projectRepository.findOneBy({
      id,
      deletedAt: IsNull(),
    });
    assertFound(refreshedProject, `Project with id ${id} not found`);
    return refreshedProject;
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
