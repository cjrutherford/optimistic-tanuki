import {
  CreateProjectJournalDto,
  QueryProjectJournalDto,
  UpdateProjectJournalDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectJournal } from '../entities/project-journal.entity';
import { Between, FindOptionsWhere, In, Like, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import {
  assertFound,
  assertProjectAccess,
  getAccessibleProjectIds,
} from '../common/project-access.util';

@Injectable()
export class ProjectJournalService {
  constructor(
    @Inject(getRepositoryToken(ProjectJournal))
    private readonly projectJournalRepository: Repository<ProjectJournal>,
    @Inject(getRepositoryToken(Project))
    private readonly projectRepository: Repository<Project>
  ) {}
  async create(
    createProjectJournalDto: CreateProjectJournalDto,
    requestingUserId?: string
  ) {
    const project = await this.projectRepository.findOne({
      where: { id: createProjectJournalDto.projectId },
    });
    if (!project) {
      throw new Error(
        `Project with id ${createProjectJournalDto.projectId} not found`
      );
    }
    if (requestingUserId) {
      assertProjectAccess(project, requestingUserId);
    }
    const projectJournal = this.projectJournalRepository.create({
      ...createProjectJournalDto,
      project, // Associate the journal entry with the project
      updatedBy: createProjectJournalDto.profileId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return await this.projectJournalRepository.save(projectJournal);
  }
  async findAll(query: QueryProjectJournalDto, requestingUserId?: string) {
    const where: FindOptionsWhere<ProjectJournal> = {};
    for (const key of ['createdBy', 'updatedBy']) {
      if (query[key]) {
        where[key] = query[key];
      }
    }

    for (const key of ['createdAt', 'updatedAt']) {
      if (query[key]) {
        where[key] = Between(...(query[key] as [Date, Date]));
      }
    }
    for (const key of ['content', 'analysis']) {
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
    return await this.projectJournalRepository.find({ where });
  }

  async findOne(id: string, requestingUserId?: string) {
    const journal = await this.projectJournalRepository.findOne({
      where: { id },
      relations: ['project'],
    });
    if (requestingUserId) {
      assertFound(journal, `Journal entry with id ${id} not found`);
      assertProjectAccess(journal.project, requestingUserId);
    }
    return journal;
  }

  async update(
    id: string,
    updateProjectJournalDto: UpdateProjectJournalDto,
    requestingUserId?: string
  ) {
    if (requestingUserId) {
      const journal = await this.projectJournalRepository.findOne({
        where: { id },
        relations: ['project'],
      });
      assertFound(journal, `Journal entry with id ${id} not found`);
      assertProjectAccess(journal.project, requestingUserId);
    }
    delete updateProjectJournalDto.projectId;
    await this.projectJournalRepository.update(id, updateProjectJournalDto);
    return await this.projectJournalRepository.findOne({ where: { id } });
  }

  async remove(id: string, requestingUserId?: string) {
    if (requestingUserId) {
      const journal = await this.projectJournalRepository.findOne({
        where: { id },
        relations: ['project'],
      });
      assertFound(journal, `Journal entry with id ${id} not found`);
      assertProjectAccess(journal.project, requestingUserId);
    }
    return await this.projectJournalRepository.update(id, {
      deletedAt: new Date(),
    });
  }
}
