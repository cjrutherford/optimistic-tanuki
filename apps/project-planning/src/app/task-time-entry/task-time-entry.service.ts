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

/**
 * Seconds between the two ends of an entry.
 *
 * Never negative. A clock that went backwards, or an end time typed before the
 * start, should record nothing rather than a negative duration that quietly
 * subtracts from somebody's total.
 */
export function elapsedBetween(startTime: Date, endTime: Date): number {
  const seconds = Math.floor(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
  );
  return Math.max(0, seconds);
}

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
      await this.taskTimeEntryRepository.update(activeEntry.id, {
        endTime,
        elapsedSeconds: elapsedBetween(activeEntry.startTime, endTime),
        updatedBy: createDto.createdBy,
        updatedAt: new Date(),
      });
    }

    const timeEntry = this.taskTimeEntryRepository.create({
      task,
      description: createDto.description,
      // Now unless the caller is recording work that already happened. It
      // used to be required and then overwritten, so a caller had to send a
      // value that did nothing.
      startTime: createDto.startTime ?? new Date(),
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
        project: {
          id: query.projectId
            ? // Still intersected with what the caller may see: a project id
              // in the query narrows the scope and never widens it.
              In(accessibleProjectIds.filter((id) => id === query.projectId))
            : In(accessibleProjectIds),
        },
      };
    } else if (query.taskId || query.projectId) {
      where.task = {
        ...(query.taskId ? { id: query.taskId } : {}),
        ...(query.projectId ? { project: { id: query.projectId } } : {}),
      };
    }

    return await this.taskTimeEntryRepository.find({
      where,
      relations: ['task', 'task.project'],
    });
  }

  async findOne(id: string, requestingUserId?: string) {
    const timeEntry = await this.taskTimeEntryRepository.findOne({
      // findAll excludes deleted entries and this did not, so a removed entry
      // was still readable, editable and stoppable by id.
      where: { id, deletedAt: IsNull() },
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
      // Stopping through update is how the app stops a timer, and it sent
      // only an end time, so every finished entry recorded zero seconds. The
      // duration is derived here from the two ends of the entry, which is the
      // only place both are known and the only figure worth trusting.
      updateData.endTime = updateDto.endTime;
      updateData.elapsedSeconds = elapsedBetween(
        timeEntry.startTime,
        updateDto.endTime
      );
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

    if (timeEntry.endTime) {
      // Already stopped. Recomputing from start to now would stretch the entry
      // every time somebody pressed the button again, which is a silent way to
      // inflate a timesheet.
      return timeEntry;
    }

    const endTime = new Date();

    await this.taskTimeEntryRepository.update(id, {
      endTime,
      elapsedSeconds: elapsedBetween(timeEntry.startTime, endTime),
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
