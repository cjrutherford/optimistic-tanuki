import {
  CreateTaskNoteDto,
  UpdateTaskNoteDto,
  QueryTaskNoteDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskNote } from '../entities/task-note.entity';
import {
  Repository,
  FindOptionsWhere,
  IsNull,
  Like,
  Not,
  Between,
} from 'typeorm';
import { Task } from '../entities/task.entity';

@Injectable()
export class TaskNoteService {
  constructor(
    @Inject(getRepositoryToken(TaskNote))
    private readonly taskNoteRepository: Repository<TaskNote>,
    @Inject(getRepositoryToken(Task))
    private readonly taskRepository: Repository<Task>
  ) {}

  async create(createDto: CreateTaskNoteDto) {
    const task = await this.taskRepository.findOne({
      where: { id: createDto.taskId },
    });
    if (!task) {
      throw new Error('Task not found');
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

  async findAll(query: QueryTaskNoteDto) {
    const where: FindOptionsWhere<TaskNote> = {
      deletedAt: IsNull(),
    };

    if (query.taskId) {
      where.task = { id: query.taskId };
    }

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

    return await this.taskNoteRepository.find({
      where,
      relations: ['task'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    return await this.taskNoteRepository.findOne({
      where: { id },
      relations: ['task'],
    });
  }

  async update(id: string, updateDto: UpdateTaskNoteDto) {
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

  async remove(id: string) {
    await this.taskNoteRepository.update(id, { deletedAt: new Date() });
    return `Task note #${id} soft-deleted`;
  }
}
