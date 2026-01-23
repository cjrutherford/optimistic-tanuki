import {
  CreateTaskTimeEntryDto,
  UpdateTaskTimeEntryDto,
  QueryTaskTimeEntryDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskTimeEntry } from '../entities/task-time-entry.entity';
import { Repository, FindOptionsWhere, IsNull } from 'typeorm';
import { Task } from '../entities/task.entity';

@Injectable()
export class TaskTimeEntryService {
  constructor(
    @Inject(getRepositoryToken(TaskTimeEntry))
    private readonly taskTimeEntryRepository: Repository<TaskTimeEntry>,
    @Inject(getRepositoryToken(Task))
    private readonly taskRepository: Repository<Task>
  ) {}

  async create(createDto: CreateTaskTimeEntryDto) {
    const task = await this.taskRepository.findOne({
      where: { id: createDto.taskId },
    });
    if (!task) {
      throw new Error('Task not found');
    }

    const timeEntry = this.taskTimeEntryRepository.create({
      task,
      description: createDto.description,
      startTime: new Date(),
      createdBy: createDto.createdBy,
      updatedBy: createDto.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.taskTimeEntryRepository.save(timeEntry);
  }

  async findAll(query: QueryTaskTimeEntryDto) {
    const where: FindOptionsWhere<TaskTimeEntry> = {
      deletedAt: IsNull(),
    };

    if (query.taskId) {
      where.task = { id: query.taskId };
    }

    if (query.createdBy) {
      where.createdBy = query.createdBy;
    }

    return await this.taskTimeEntryRepository.find({
      where,
      relations: ['task'],
    });
  }

  async findOne(id: string) {
    return await this.taskTimeEntryRepository.findOne({
      where: { id },
      relations: ['task'],
    });
  }

  async update(id: string, updateDto: UpdateTaskTimeEntryDto) {
    const updateData: Partial<TaskTimeEntry> = {
      updatedAt: new Date(),
    };

    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description;
    }

    if (updateDto.endTime !== undefined) {
      updateData.endTime = updateDto.endTime;
    }

    if (updateDto.elapsedSeconds !== undefined) {
      updateData.elapsedSeconds = updateDto.elapsedSeconds;
    }

    if (updateDto.updatedBy !== undefined) {
      updateData.updatedBy = updateDto.updatedBy;
    }

    await this.taskTimeEntryRepository.update(id, updateData);
    return await this.taskTimeEntryRepository.findOne({
      where: { id },
      relations: ['task'],
    });
  }

  async stop(id: string, updatedBy: string) {
    const timeEntry = await this.taskTimeEntryRepository.findOne({
      where: { id },
    });

    if (!timeEntry) {
      throw new Error('Time entry not found');
    }

    const endTime = new Date();
    const elapsedSeconds = Math.floor(
      (endTime.getTime() - timeEntry.startTime.getTime()) / 1000
    );

    await this.taskTimeEntryRepository.update(id, {
      endTime,
      elapsedSeconds,
      updatedBy,
      updatedAt: new Date(),
    });

    return await this.taskTimeEntryRepository.findOne({
      where: { id },
      relations: ['task'],
    });
  }

  async remove(id: string) {
    await this.taskTimeEntryRepository.update(id, { deletedAt: new Date() });
    return `Time entry #${id} soft-deleted`;
  }
}
