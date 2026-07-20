import {
  CreateTaskTimeEntryDto,
  UpdateTaskTimeEntryDto,
  QueryTaskTimeEntryDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskTimeEntry } from '../entities/task-time-entry.entity';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { Project } from '../entities/project.entity';
import {
  assertFound,
  assertProjectAccess,
  getAccessibleProjectIds,
} from '../common/project-access.util';

@Injectable()
export class TaskTimeEntryService {
  constructor(
    @Inject(getRepositoryToken(TaskTimeEntry))
    private readonly taskTimeEntryRepository: Repository<TaskTimeEntry>,
    @Inject(getRepositoryToken(Task))
    private readonly taskRepository: Repository<Task>,
    @Inject(getRepositoryToken(Project))
    private readonly projectRepository: Repository<Project>
  ) {}

  async create(createDto: CreateTaskTimeEntryDto, requestingUserId?: string) {
    const task = await this.taskRepository.findOne({
      where: { id: createDto.taskId },
      relations: ['project'],
    });
    assertFound(task, `Task with id ${createDto.taskId} not found`);

    if (requestingUserId) {
      assertProjectAccess(task.project, requestingUserId);
    }

    // Check for active time entries and stop them (only one active timer per task)
    const activeEntries = await this.taskTimeEntryRepository.find({
      where: {
        task: { id: createDto.taskId },
        endTime: IsNull(),
        deletedAt: IsNull(),
      },
    });

    // Stop all active timers for this task
    for (const activeEntry of activeEntries) {
      const endTime = new Date();
      const elapsedSeconds = Math.floor(
        (endTime.getTime() - activeEntry.startTime.getTime()) / 1000
      );
      await this.taskTimeEntryRepository.update(activeEntry.id, {
        endTime,
        elapsedSeconds,
        updatedBy: createDto.createdBy,
        updatedAt: new Date(),
      });
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

  async findAll(query: QueryTaskTimeEntryDto, requestingUserId?: string) {
    const where: FindOptionsWhere<TaskTimeEntry> = {
      deletedAt: IsNull(),
    };

    if (query.createdBy) {
      where.createdBy = query.createdBy;
    }

    // Scope to time entries whose task belongs to a project the caller can
    // access. A client-supplied taskId is only honored within that scope.
    if (requestingUserId) {
      const accessibleProjectIds = await getAccessibleProjectIds(
        this.projectRepository,
        requestingUserId
      );
      if (accessibleProjectIds.length === 0) {
        return [];
      }
      where.task = {
        ...(query.taskId ? { id: query.taskId } : {}),
        project: { id: In(accessibleProjectIds) },
      };
    } else if (query.taskId) {
      where.task = { id: query.taskId };
    }

    return await this.taskTimeEntryRepository.find({
      where,
      relations: ['task', 'task.project'],
    });
  }

  async findOne(id: string, requestingUserId?: string) {
    const timeEntry = await this.taskTimeEntryRepository.findOne({
      where: { id },
      relations: ['task', 'task.project'],
    });
    assertFound(timeEntry, `Time entry with id ${id} not found`);

    if (requestingUserId) {
      assertProjectAccess(timeEntry.task?.project, requestingUserId);
    }

    return timeEntry;
  }

  async update(
    id: string,
    updateDto: UpdateTaskTimeEntryDto,
    requestingUserId?: string
  ) {
    const timeEntry = await this.taskTimeEntryRepository.findOne({
      where: { id },
      relations: ['task', 'task.project'],
    });
    assertFound(timeEntry, `Time entry with id ${id} not found`);

    if (requestingUserId) {
      assertProjectAccess(timeEntry.task?.project, requestingUserId);
    }

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

  async stop(id: string, updatedBy: string, requestingUserId?: string) {
    const timeEntry = await this.taskTimeEntryRepository.findOne({
      where: { id },
      relations: ['task', 'task.project'],
    });
    assertFound(timeEntry, `Time entry with id ${id} not found`);

    if (requestingUserId) {
      assertProjectAccess(timeEntry.task?.project, requestingUserId);
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

  async remove(id: string, requestingUserId?: string) {
    const timeEntry = await this.taskTimeEntryRepository.findOne({
      where: { id },
      relations: ['task', 'task.project'],
    });
    assertFound(timeEntry, `Time entry with id ${id} not found`);

    if (requestingUserId) {
      assertProjectAccess(timeEntry.task?.project, requestingUserId);
    }

    await this.taskTimeEntryRepository.update(id, { deletedAt: new Date() });
    return `Time entry #${id} soft-deleted`;
  }
}
