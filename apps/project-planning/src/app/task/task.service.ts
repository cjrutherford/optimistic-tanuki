import {
  CreateTaskDto,
  QueryTaskDto,
  UpdateTaskDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../entities/task.entity';
import {
  Between,
  FindOptionsWhere,
  IsNull,
  Like,
  Not,
  Repository,
  In,
} from 'typeorm';
import { Project } from '../entities/project.entity';
import { TaskTag } from '../entities/task-tag.entity';
import {
  assertFound,
  assertProjectAccess,
  getAccessibleProjectIds,
} from '../common/project-access.util';

@Injectable()
export class TaskService {
  constructor(
    @Inject(getRepositoryToken(Task))
    private readonly taskRepository: Repository<Task>,
    @Inject(getRepositoryToken(Project))
    private readonly projectRepository: Repository<Project>,
    @Inject(getRepositoryToken(TaskTag))
    private readonly taskTagRepository: Repository<TaskTag>
  ) {}

  async create(createTaskDto: CreateTaskDto, requestingUserId?: string) {
    console.log('Creating task with DTO:', createTaskDto);
    const project = await this.projectRepository.findOne({
      where: { id: createTaskDto.projectId },
    });
    if (!project) {
      throw new Error('Project not found');
    }
    if (requestingUserId) {
      assertProjectAccess(project, requestingUserId);
    }

    let tags: TaskTag[] = [];
    if (createTaskDto.tagIds && createTaskDto.tagIds.length > 0) {
      tags = await this.taskTagRepository.find({
        where: { id: In(createTaskDto.tagIds) },
      });
    }

    const task = this.taskRepository.create({
      title: createTaskDto.title,
      description: createTaskDto.description,
      status: createTaskDto.status,
      priority: createTaskDto.priority,
      assignee: createTaskDto.assignee,
      dueDate: createTaskDto.dueDate,
      createdBy: createTaskDto.createdBy,
      project: project,
      tags: tags,
      updatedBy: createTaskDto.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return await this.taskRepository.save(task);
  }

  async findAll(query: QueryTaskDto, requestingUserId?: string) {
    const where: FindOptionsWhere<Task> = {
      deletedAt: IsNull(),
    };
    if (query.title) {
      where.title = Like(`%${query.title}%`);
    }
    if (query.description) {
      where.description = Like(`%${query.description}%`);
    }

    // Scope to projects the caller can access. If a specific project is
    // requested it must be one of them; otherwise restrict to all of them.
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

    if (query.assignee) {
      where.assignee = query.assignee;
    }

    if (query.dueDate) {
      where.dueDate = Between(...query.dueDate);
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

    const tasks = await this.taskRepository.find({
      where,
      relations: ['tags', 'timeEntries', 'project'],
      order: { createdAt: 'DESC' },
    });

    // Filter by tags if tagIds are provided
    if (query.tagIds && query.tagIds.length > 0) {
      return tasks.filter((task) =>
        task.tags?.some((tag) => query.tagIds?.includes(tag.id))
      );
    }

    return tasks;
  }

  async findOne(id: string, requestingUserId?: string) {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['tags', 'timeEntries', 'project'],
    });

    if (requestingUserId) {
      assertFound(task, `Task with id ${id} not found`);
      assertProjectAccess(task.project, requestingUserId);
    }

    return task;
  }

  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    requestingUserId?: string
  ) {
    const task = await this.taskRepository.findOne({
      where: { id: id },
      relations: ['tags', 'project'],
    });

    if (!task) {
      throw new Error('Task not found');
    }

    if (requestingUserId) {
      assertProjectAccess(task.project, requestingUserId);
    }

    // Handle tag updates
    if (updateTaskDto.tagIds !== undefined) {
      if (updateTaskDto.tagIds.length > 0) {
        task.tags = await this.taskTagRepository.find({
          where: { id: In(updateTaskDto.tagIds) },
        });
      } else {
        task.tags = [];
      }
    }

    // Update other fields
    if (updateTaskDto.title !== undefined) task.title = updateTaskDto.title;
    if (updateTaskDto.description !== undefined)
      task.description = updateTaskDto.description;
    if (updateTaskDto.status !== undefined) task.status = updateTaskDto.status;
    if (updateTaskDto.priority !== undefined)
      task.priority = updateTaskDto.priority;
    if (updateTaskDto.assignee !== undefined)
      task.assignee = updateTaskDto.assignee;
    if (updateTaskDto.dueDate !== undefined)
      task.dueDate = updateTaskDto.dueDate;
    if (updateTaskDto.updatedBy !== undefined)
      task.updatedBy = updateTaskDto.updatedBy;

    task.updatedAt = new Date();

    await this.taskRepository.save(task);
    return await this.taskRepository.findOne({
      where: { id },
      relations: ['tags', 'timeEntries', 'project'],
    });
  }

  async remove(id: string, requestingUserId?: string) {
    if (requestingUserId) {
      const task = await this.taskRepository.findOne({
        where: { id },
        relations: ['project'],
      });
      assertFound(task, `Task with id ${id} not found`);
      assertProjectAccess(task.project, requestingUserId);
    }
    return await this.taskRepository.update(id, { deletedAt: new Date() });
  }
}
