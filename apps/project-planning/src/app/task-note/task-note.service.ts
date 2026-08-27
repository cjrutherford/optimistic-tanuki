import {
  CreateTaskNoteDto,
  UpdateTaskNoteDto,
  QueryTaskNoteDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskNote } from '../entities/task-note.entity';
import {
  Between,
  FindOptionsWhere,
  In,
  IsNull,
  Like,
  Not,
  Repository,
} from 'typeorm';
import { Task } from '../entities/task.entity';
import { Project } from '../entities/project.entity';
import {
  assertFound,
  assertProjectAccess,
  getAccessibleProjectIds,
} from '../common/project-access.util';

@Injectable()
export class TaskNoteService {
  constructor(
    @Inject(getRepositoryToken(TaskNote))
    private readonly taskNoteRepository: Repository<TaskNote>,
    @Inject(getRepositoryToken(Task))
    private readonly taskRepository: Repository<Task>,
    @Inject(getRepositoryToken(Project))
    private readonly projectRepository: Repository<Project>
  ) {}

  async create(createDto: CreateTaskNoteDto, requestingUserId?: string) {
    const task = await this.taskRepository.findOne({
      where: { id: createDto.taskId },
      relations: ['project'],
    });
    assertFound(task, `Task with id ${createDto.taskId} not found`);

    if (requestingUserId) {
      assertProjectAccess(task.project, requestingUserId);
    }

    const taskNote = this.taskNoteRepository.create({
      profileId: createDto.profileId,
      task,
      content: createDto.content,
      analysis: createDto.analysis,
      updatedBy: createDto.profileId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.taskNoteRepository.save(taskNote);
  }

  async findAll(query: QueryTaskNoteDto, requestingUserId?: string) {
    const where: FindOptionsWhere<TaskNote> = {
      deletedAt: IsNull(),
    };

    if (query.profileId) {
      where.profileId = query.profileId;
    }

    if (query.updatedBy) {
      where.updatedBy = query.updatedBy;
    }

    if (query.content) {
      where.content = Like(`%${query.content}%`);
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

    // Scope to notes whose task belongs to a project the caller can access.
    // A client-supplied taskId is only honored if it falls within that scope.
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

    return await this.taskNoteRepository.find({
      where,
      relations: ['task', 'task.project'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, requestingUserId?: string) {
    const taskNote = await this.taskNoteRepository.findOne({
      where: { id },
      relations: ['task', 'task.project'],
    });
    assertFound(taskNote, `Task note with id ${id} not found`);

    if (requestingUserId) {
      assertProjectAccess(taskNote.task?.project, requestingUserId);
    }

    return taskNote;
  }

  async update(
    id: string,
    updateDto: UpdateTaskNoteDto,
    requestingUserId?: string
  ) {
    const taskNote = await this.taskNoteRepository.findOne({
      where: { id },
      relations: ['task', 'task.project'],
    });
    assertFound(taskNote, `Task note with id ${id} not found`);

    if (requestingUserId) {
      assertProjectAccess(taskNote.task?.project, requestingUserId);
    }

    const updateData: Partial<TaskNote> = {
      updatedAt: new Date(),
    };

    if (updateDto.content !== undefined) {
      updateData.content = updateDto.content;
    }

    if (updateDto.analysis !== undefined) {
      updateData.analysis = updateDto.analysis;
    }

    if (updateDto.updatedBy !== undefined) {
      updateData.updatedBy = updateDto.updatedBy;
    }

    await this.taskNoteRepository.update(id, updateData);
    return await this.taskNoteRepository.findOne({
      where: { id },
      relations: ['task'],
    });
  }

  async remove(id: string, requestingUserId?: string) {
    const taskNote = await this.taskNoteRepository.findOne({
      where: { id },
      relations: ['task', 'task.project'],
    });
    assertFound(taskNote, `Task note with id ${id} not found`);

    if (requestingUserId) {
      assertProjectAccess(taskNote.task?.project, requestingUserId);
    }

    await this.taskNoteRepository.update(id, { deletedAt: new Date() });
    return `Task note #${id} soft-deleted`;
  }
}
