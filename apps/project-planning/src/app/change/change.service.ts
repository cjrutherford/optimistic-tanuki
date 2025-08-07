import { CreateChangeDto, QueryChangeDto, UpdateChangeDto } from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Change } from '../entities/change.entity';
import { Between, FindOptionsWhere, Repository, Like } from 'typeorm';
import { Project } from '../entities/project.entity';

@Injectable()
/**
 * Service for managing changes within projects.
 */
@Injectable()
export class ChangeService {

  /**
   * Creates an instance of ChangeService.
   * @param changeRepository The repository for Change entities.
   * @param projectRepository The repository for Project entities.
   */
  constructor(
    @Inject(getRepositoryToken(Change)) private readonly changeRepository: Repository<Change>,
    @Inject(getRepositoryToken(Project)) private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Creates a new change.
   * @param createChangeDto The data for creating the change.
   * @returns A Promise that resolves to the created Change.
   * @throws Error if the associated project is not found.
   */
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

  /**
   * Finds all changes based on the provided query.
   * @param query The query criteria.
   * @returns A Promise that resolves to an array of Change entities.
   */
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

  /**
   * Finds a single change by its ID.
   * @param id The ID of the change to find.
   * @returns A Promise that resolves to the found Change entity.
   */
  async findOne(id: string) {
    return await this.changeRepository.findOne({ where: { id } });
  }

  /**
   * Updates an existing change.
   * @param id The ID of the change to update.
   * @param updateChangeDto The data for updating the change.
   * @returns A Promise that resolves to the updated Change entity.
   */
  async update(id: string, updateChangeDto: UpdateChangeDto) {
    const {
      changeStatus: status,
      projectId,
      ...updateData
    } = updateChangeDto;
    const updatedChange: Partial<Change> = {
      ...updateData,
      status, 
      updatedAt: new Date(),
      updatedBy: updateChangeDto.requestor,
    };
    await this.changeRepository.update(id, updatedChange);
    return await this.changeRepository.findOne({ where: { id } });
  }

  /**
   * Removes a change by its ID.
   * @param id The ID of the change to remove.
   * @returns A Promise that resolves when the change is removed.
   */
  async remove(id: string) {
    return await this.changeRepository.update(id, { deletedAt: new Date() });
  }
}
