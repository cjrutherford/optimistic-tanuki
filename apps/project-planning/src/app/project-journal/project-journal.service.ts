import { CreateProjectJournalDto, QueryProjectJournalDto, UpdateProjectJournalDto } from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectJournal } from '../entities/project-journal.entity';
import { Between, FindOptionsWhere, Like, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';

@Injectable()
export class ProjectJournalService {
  constructor(
    @Inject(getRepositoryToken(ProjectJournal)) private readonly projectJournalRepository: Repository<ProjectJournal>,
    @Inject(getRepositoryToken(Project)) private readonly projectRepository: Repository<Project>,
  ) {}
  async create(createProjectJournalDto: CreateProjectJournalDto) {
    const project = await this.projectRepository.findOne({ where: { id: createProjectJournalDto.projectId } });
    if (!project) {
      throw new Error(`Project with id ${createProjectJournalDto.projectId} not found`);
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
  async findAll(query: QueryProjectJournalDto) {
    const where: FindOptionsWhere<ProjectJournal> = {};
    for (const key of ['createdBy', 'updatedBy']) {
      if (query[key]) {
        where[key] = query[key];
      }
    }

    for ( const key of ['createdAt', 'updatedAt']) {
      if (query[key]) {
        where[key] = Between(...query[key] as [Date, Date]);
      }
    }
    for ( const key of ['content', 'analysis']) {
      if (query[key]) {
        where[key] = Like(`%${query[key]}%`);
      }
    }
    return await this.projectJournalRepository.find({ where });
  }

  async findOne(id: string) {
    return await this.projectJournalRepository.findOne({ where: { id } });
  }

  async update(id: string, updateProjectJournalDto: UpdateProjectJournalDto) {
    await this.projectJournalRepository.update(id, updateProjectJournalDto);
    return await this.projectJournalRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    return await this.projectJournalRepository.update(id, { deletedAt: new Date() });
  }
}
