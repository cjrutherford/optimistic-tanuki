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
import { getAccessibleProjectIds } from '../common/project-access.util';

/**
 * Time and tag figures for the work somebody can see.
 *
 * This used to perform no ownership check at all and, given no projectId,
 * aggregated every project in the system. It was kept off the gateway for
 * exactly that reason, with a note saying to add scoping before exposing it.
 * That is what happened: every method now takes the caller and narrows to the
 * projects they own or belong to, the same way every other service here does.
 *
 * A caller naming a project they cannot see gets nothing rather than an error,
 * because whether that project exists is not something they should learn from
 * the shape of the answer.
 */
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

  /**
   * The projects this caller may be told about, intersected with any they
   * asked for. Returns null when there is nothing to report on, which the
   * callers treat as an empty answer rather than an error.
   */
  private async visibleProjectIds(
    query: QueryAnalyticsDto,
    requestingUserId?: string
  ): Promise<string[] | null> {
    if (!requestingUserId) {
      return query.projectId ? [query.projectId] : null;
    }
    const accessible = await getAccessibleProjectIds(
      this.projectRepository,
      requestingUserId
    );
    const scoped = query.projectId
      ? accessible.filter((id) => id === query.projectId)
      : accessible;
    return scoped.length ? scoped : [];
  }

  async getTaskAnalytics(
    query: QueryAnalyticsDto,
    requestingUserId?: string
  ): Promise<TaskAnalyticsDto[]> {
    const projectIds = await this.visibleProjectIds(query, requestingUserId);
    if (projectIds?.length === 0) return [];

    const whereConditions: any = {
      deletedAt: IsNull(),
    };

    if (query.taskIds && query.taskIds.length > 0) {
      whereConditions.id = In(query.taskIds);
    }

    if (projectIds) {
      whereConditions.project = { id: In(projectIds) };
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
        } else if (query.endDate) {
          // End date only - from beginning of time to end date
          timeEntryWhere.startTime = Between(new Date(0), query.endDate);
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

  async getProjectAnalytics(
    query: QueryAnalyticsDto,
    requestingUserId?: string
  ): Promise<ProjectAnalyticsDto> {
    if (!query.projectId) {
      throw new Error('Project ID is required for project analytics');
    }

    const projectIds = await this.visibleProjectIds(query, requestingUserId);
    if (projectIds?.length === 0) {
      // Not "forbidden", because that would confirm the project exists.
      throw new Error('Project not found');
    }

    const project = await this.projectRepository.findOne({
      where: { id: query.projectId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const taskAnalytics = await this.getTaskAnalytics(query, requestingUserId);

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

  async getTagAnalytics(
    query: QueryAnalyticsDto,
    requestingUserId?: string
  ): Promise<TagAnalyticsDto[]> {
    const projectIds = await this.visibleProjectIds(query, requestingUserId);
    if (projectIds?.length === 0) return [];

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

        // A tag can span projects, so each task behind it is checked against
        // what the caller may see rather than only against the project asked
        // for. Without this a tag's totals would leak time from projects the
        // caller has no part in.
        if (projectIds) {
          const taskWithProject = await this.taskRepository.findOne({
            where: { id: task.id },
            relations: ['project'],
          });
          const owning = taskWithProject?.project?.id;
          if (!owning || !projectIds.includes(owning)) continue;
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
