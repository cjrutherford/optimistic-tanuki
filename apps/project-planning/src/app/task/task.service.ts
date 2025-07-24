import { CreateTaskDto, QueryTaskDto, UpdateTaskDto } from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../entities/task.entity';
import { Between, FindOptionsWhere, IsNull, Like, Not, Repository } from 'typeorm';
import { Project } from '../entities/project.entity';

@Injectable()
export class TaskService {

  constructor(
    @Inject(getRepositoryToken(Task)) private readonly taskRepository: Repository<Task>,
    @Inject(getRepositoryToken(Project)) private readonly projectRepository: Repository<Project>,
  ) {}

  async create(createTaskDto: CreateTaskDto) {
    const project = await this.projectRepository.findOne({ where: { id: createTaskDto.projectId } });
    if (!project) {
      throw new Error('Project not found');
    }
    const task = this.taskRepository.create({
      ...createTaskDto,
      project: project,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return await this.taskRepository.save(task);
  }

  async findAll(query: QueryTaskDto) {
    const where: FindOptionsWhere<Task> = {};
    if (query.title) {
      where.title = Like(`%${query.title}%`);
    }
    if (query.description) {
      where.description = Like(`%${query.description}%`);
    }

    if(query.projectId) {
      where.project = {
        id: query.projectId,
      };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.priority) {
      where.priority = query.priority;
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
    return await this.taskRepository.find({ where });
  }

  async findOne(id: string) {
    return await this.taskRepository.findOne({ where: { id } });
  }

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    await this.taskRepository.update(id, updateTaskDto);
    return await this.taskRepository.findOne({ where: { id } });
  }

  async remove(id: string) {
    return await this.taskRepository.update(id, { deletedAt: new Date() });
  }
}
