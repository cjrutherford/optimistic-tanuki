import {
  QueryAnalyticsDto,
  TaskAnalyticsDto,
  ProjectAnalyticsDto,
  TagAnalyticsDto,
} from '@optimistic-tanuki/models';

import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between, In, IsNull } from 'typeorm';
import { Task } from '../entities/task.entity';
import { TaskTimeEntry } from '../entities/task-time-entry.entity';
import { TaskTag } from '../entities/task-tag.entity';
import { Project } from '../entities/project.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(getRepositoryToken(Task))
    private readonly taskRepository: Repository<Task>,
    @Inject(getRepositoryToken(TaskTimeEntry))
    private readonly taskTimeEntryRepository: Repository<TaskTimeEntry>,
    @Inject(getRepositoryToken(TaskTag))
    private readonly taskTagRepository: Repository<TaskTag>,
    @Inject(getRepositoryToken(Project))
    private readonly projectRepository: Repository<Project>
  ) {}

  async getTaskAnalytics(query: QueryAnalyticsDto): Promise<TaskAnalyticsDto[]> {
    const whereConditions: any = {
      deletedAt: IsNull(),
    };

    if (query.taskIds && query.taskIds.length > 0) {
      whereConditions.id = In(query.taskIds);
    }

    if (query.projectId) {
      whereConditions.project = { id: query.projectId };
    }

    const tasks = await this.taskRepository.find({
      where: whereConditions,
      relations: ['tags', 'timeEntries'],
    });

    const analytics: TaskAnalyticsDto[] = [];

    for (const task of tasks) {
      const timeEntryWhere: any = {
        task: { id: task.id },
        deletedAt: IsNull(),
      };

      if (query.startDate || query.endDate) {
        if (query.startDate && query.endDate) {
          timeEntryWhere.startTime = Between(query.startDate, query.endDate);
        } else if (query.startDate) {
          // Start date only
          timeEntryWhere.startTime = Between(query.startDate, new Date());
        }
      }

      if (query.userId) {
        timeEntryWhere.createdBy = query.userId;
      }

      const timeEntries = await this.taskTimeEntryRepository.find({
        where: timeEntryWhere,
      });

      // Filter by tags if specified
      if (query.tagIds && query.tagIds.length > 0) {
        const hasMatchingTag = task.tags?.some((tag) =>
          query.tagIds?.includes(tag.id)
        );
        if (!hasMatchingTag) continue;
      }

      const totalTimeSeconds = timeEntries.reduce(
        (sum, entry) => sum + (entry.elapsedSeconds || 0),
        0
      );

      analytics.push({
        taskId: task.id,
        taskTitle: task.title,
        totalTimeSeconds,
        entryCount: timeEntries.length,
        tags: task.tags?.map((tag) => tag.name) || [],
      });
    }

    return analytics;
  }

  async getProjectAnalytics(query: QueryAnalyticsDto): Promise<ProjectAnalyticsDto> {
    if (!query.projectId) {
      throw new Error('Project ID is required for project analytics');
    }

    const project = await this.projectRepository.findOne({
      where: { id: query.projectId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const taskAnalytics = await this.getTaskAnalytics(query);

    const totalTimeSeconds = taskAnalytics.reduce(
      (sum, task) => sum + task.totalTimeSeconds,
      0
    );

    return {
      projectId: project.id,
      projectName: project.name,
      totalTimeSeconds,
      taskCount: taskAnalytics.length,
      tasks: taskAnalytics,
    };
  }

  async getTagAnalytics(query: QueryAnalyticsDto): Promise<TagAnalyticsDto[]> {
    const whereConditions: any = {
      deletedAt: IsNull(),
    };

    if (query.tagIds && query.tagIds.length > 0) {
      whereConditions.id = In(query.tagIds);
    }

    const tags = await this.taskTagRepository.find({
      where: whereConditions,
      relations: ['tasks', 'tasks.timeEntries'],
    });

    const analytics: TagAnalyticsDto[] = [];

    for (const tag of tags) {
      let totalTimeSeconds = 0;
      let taskCount = 0;

      for (const task of tag.tasks || []) {
        if (task.deletedAt) continue;

        // Apply project filter if specified
        if (query.projectId) {
          const taskWithProject = await this.taskRepository.findOne({
            where: { id: task.id },
            relations: ['project'],
          });
          if (taskWithProject?.project?.id !== query.projectId) continue;
        }

        const timeEntryWhere: any = {
          task: { id: task.id },
          deletedAt: IsNull(),
        };

        if (query.startDate || query.endDate) {
          if (query.startDate && query.endDate) {
            timeEntryWhere.startTime = Between(query.startDate, query.endDate);
          } else if (query.startDate) {
            timeEntryWhere.startTime = Between(query.startDate, new Date());
          }
        }

        if (query.userId) {
          timeEntryWhere.createdBy = query.userId;
        }

        const timeEntries = await this.taskTimeEntryRepository.find({
          where: timeEntryWhere,
        });

        totalTimeSeconds += timeEntries.reduce(
          (sum, entry) => sum + (entry.elapsedSeconds || 0),
          0
        );
        taskCount++;
      }

      analytics.push({
        tagId: tag.id,
        tagName: tag.name,
        totalTimeSeconds,
        taskCount,
      });
    }

    return analytics;
  }
}
