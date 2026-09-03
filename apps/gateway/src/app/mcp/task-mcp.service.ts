import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProjectCommands,
  TaskCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  CreateTaskDto,
  ENTITY_VIEWS,
  EntityView,
  TaskPriority,
  TaskStatus,
  UpdateTaskDto,
  applyView,
  pageOf,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { ApprovalGate } from './approval-gate.service';
import { z } from 'zod';

// Define Zod schemas outside the class
export const listTasksSchema = z.object({
  projectId: z.string().describe('The ID of the project whose tasks to list'),
  view: z
    .enum(ENTITY_VIEWS)
    .optional()
    .describe(
      'How much of each row to return. "brief" is the default and carries what ' +
        'you would say out loud about it; "full" adds every field including ' +
        'timestamps and who touched it. Ask for full only when you need it.'
    ),
  limit: z
    .number()
    .optional()
    .describe(
      'How many to return. Defaults to 25 and is capped at 100. The count ' +
        'field is always the total, not how many came back.'
    ),
  offset: z
    .number()
    .optional()
    .describe('Where to start, for reading past the first page'),
});

// Define Zod schemas for parameters
const getTaskSchema = z.object({
  taskId: z.string().describe('The ID of the task to retrieve'),
});

// Correct the `CreateTaskDto` and `UpdateTaskDto` usage
const createTaskSchema = z.object({
  title: z.string().describe('Title of the task'),
  description: z.string().optional().describe('Description of the task'),
  status: z
    .nativeEnum(TaskStatus)
    .default(TaskStatus.TODO)
    .describe(
      'Status of the task. MUST be one of: TODO, IN_PROGRESS, DONE, ARCHIVED. Default: TODO'
    ),
  priority: z
    .nativeEnum(TaskPriority)
    .default(TaskPriority.MEDIUM)
    .describe(
      'Priority of the task. MUST be one of: LOW, MEDIUM_LOW, MEDIUM, MEDIUM_HIGH, HIGH. Default: MEDIUM'
    ),
  projectId: z
    .string()
    .describe(
      'ID of the related project. use the project id from list_projects or the context.'
    ),
  // Neither of these was here, so the agent could report that work was
  // unassigned or overdue and had no way to do anything about it. Those are
  // the two concerns it raises most.
  assignee: z
    .string()
    .optional()
    .describe('Profile id of the person responsible, if known'),
  dueDate: z
    .string()
    .optional()
    .describe('When the task is due, as YYYY-MM-DD'),
});

const updateTaskSchema = z.object({
  id: z.string().describe('The unique identifier of the task'),
  title: z.string().optional().describe('The new title of the task'),
  description: z
    .string()
    .optional()
    .describe('The new description of the task'),
  status: z
    .nativeEnum(TaskStatus)
    .optional()
    .describe('The new status of the task'),
  priority: z
    .nativeEnum(TaskPriority)
    .optional()
    .describe('The new priority of the task'),
  projectId: z
    .string()
    .optional()
    .describe(
      'ID of the related project. this relates to the id field of the project data type. please use the list_projects tool to get project ids.'
    ),
  assignee: z
    .string()
    .optional()
    .describe('Profile id of the person responsible'),
  dueDate: z
    .string()
    .optional()
    .describe('When the task is due, as YYYY-MM-DD'),
});

const queryTasksSchema = z.object({
  projectId: z.string().describe('The ID of the project to query tasks for'),
  title: z
    .string()
    .optional()
    .describe('Filter tasks by title (partial match)'),
  status: z
    .nativeEnum(TaskStatus)
    .optional()
    .describe('Filter tasks by status'),
  priority: z
    .nativeEnum(TaskPriority)
    .optional()
    .describe('Filter tasks by priority'),
  view: z
    .enum(ENTITY_VIEWS)
    .optional()
    .describe(
      'How much of each row to return. "brief" is the default and carries what ' +
        'you would say out loud about it; "full" adds every field including ' +
        'timestamps and who touched it. Ask for full only when you need it.'
    ),
  limit: z
    .number()
    .optional()
    .describe(
      'How many to return. Defaults to 25 and is capped at 100. The count ' +
        'field is always the total, not how many came back.'
    ),
  offset: z
    .number()
    .optional()
    .describe('Where to start, for reading past the first page'),
});

/**
 * A due date, when what the model wrote is one.
 *
 * Models put "next week" and "TBD" in date fields. The DTO takes a real Date,
 * so a phrase would fail validation at the far end and surface to the agent as
 * an unexplained error rather than as a date it should not have written.
 */
function asDueDate(value?: string): { dueDate?: Date } {
  if (!value) return {};
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? {} : { dueDate: parsed };
}

/**
 * The rows a list tool hands back, narrowed to the requested view.
 *
 * Named so the omission travels with the data: a reader that cannot tell a
 * missing field from an empty one has no way to know what to ask for next.
 */
function viewTask(
  rows: Record<string, unknown>[],
  view: EntityView,
  paging: { limit?: number; offset?: number }
): {
  count: number;
  showing: number;
  offset: number;
  more: boolean;
  tasks: unknown[];
  omittedFields?: string[];
} {
  // The page is taken before the narrowing, and the count comes from pageOf
  // rather than from the rows that come back, so the total stays the total. A
  // count taken after slicing would report the page size and mean it.
  const page = pageOf(rows ?? [], paging);
  const narrowed = applyView(page.rows, 'task', view);

  return {
    count: page.count,
    showing: page.showing,
    offset: page.offset,
    more: page.more,
    tasks: narrowed.rows,
    ...(narrowed.omitted ? { omittedFields: narrowed.omitted } : {}),
  };
}

@Injectable()
export class TaskMcpService {
  private readonly logger = new Logger(TaskMcpService.name);

  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningService: ClientProxy,
    private readonly gate: ApprovalGate
  ) {}

  /**
   * Every MCP tool call gets the raw Express request as its third argument
   * (mcp-nest invokes tools as `(args, context, rawExpressRequest)`). The
   * McpAuthGuard wired into NestMcpModule.forRoot attaches `request.user`
   * for every authenticated call, so identity must always be derived from
   * there rather than from client-supplied tool arguments.
   */
  private requireRequestingUserId(request: any): string {
    const profileId = request?.user?.profileId;
    if (!profileId) {
      throw new Error('Unauthenticated MCP call');
    }
    return profileId;
  }

  @McpTool({
    name: 'list_tasks',
    description:
      'List all tasks for a project, this is highly dependent on the project type and the project id should match the id of the project either from the list_projects tool or from an earlier tool call response such as create project.',
    parameters: listTasksSchema,
  })
  async listTasks(
    {
      projectId,
      view = 'brief',
      limit,
      offset,
    }: z.infer<typeof listTasksSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Listing tasks for project ${projectId}`);
      const tasks = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.FIND_ALL },
          { projectId, requestingUserId }
        )
      );
      return {
        success: true,
        // count, showing, offset and more all come from here, before the
        // rows. Written after them they are the first thing lost when a
        // result is shortened, and the count answers every question about
        // how many there are.
        ...viewTask(tasks, view, { limit, offset }),
      };
    } catch (error) {
      this.logger.error('Error listing tasks:', error);
      throw new Error(`Failed to list tasks: ${error.message}`);
    }
  }

  @McpTool({
    name: 'get_task',
    description:
      'Get details of a specific task by ID. id for tasks could be found via the list_tasks tool or earlier tool call responses.',
    parameters: getTaskSchema,
  })
  async getTask(
    { taskId }: z.infer<typeof getTaskSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Getting task ${taskId}`);
      const task = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.FIND_ONE },
          { id: taskId, requestingUserId }
        )
      );
      return {
        success: true,
        task,
      };
    } catch (error) {
      this.logger.error('Error getting task:', error);
      throw new Error(`Failed to get task: ${error.message}`);
    }
  }

  @McpTool({
    name: 'create_task',
    description: 'Create a new task for a project.',
    parameters: createTaskSchema,
  })
  async createTask(
    {
      title,
      description,
      status,
      priority,
      projectId,
      assignee,
      dueDate,
    }: z.infer<typeof createTaskSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Creating task "${title}" for project ${projectId}`
      );
      const taskData: CreateTaskDto & { requestingUserId: string } = {
        title,
        description: description ?? 'No description provided',
        status: status ?? TaskStatus.TODO,
        priority: priority ?? TaskPriority.MEDIUM,
        createdBy: requestingUserId,
        projectId,
        ...(assignee ? { assignee } : {}),
        ...asDueDate(dueDate),
        requestingUserId,
      };

      const proposed = await this.gate.proposeIfGated(
        projectId,
        'task.create',
        taskData,
        requestingUserId,
        `Task "${title}"`
      );
      if (proposed) return proposed;

      const task = await firstValueFrom(
        this.projectPlanningService.send({ cmd: TaskCommands.CREATE }, taskData)
      );

      return {
        success: true,
        message: `Task "${title}" created successfully`,
        task,
        awaitingApproval: false,
      };
    } catch (error) {
      this.logger.error('Error creating task:', error);
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  @McpTool({
    name: 'update_task',
    description:
      'Update an existing task. all data points are optional except for the id which is required to identify the task to update.',
    parameters: updateTaskSchema,
  })
  async updateTask(
    {
      id,
      title,
      description,
      status,
      priority,
      projectId,
      assignee,
      dueDate,
    }: z.infer<typeof updateTaskSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Updating task ${id}`);
      const updates: Partial<UpdateTaskDto> & {
        id: string;
        updatedBy: string;
        requestingUserId: string;
      } = { id, updatedBy: requestingUserId, requestingUserId };

      if (title) updates.title = title;
      if (description) updates.description = description;
      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (projectId) updates.projectId = projectId;
      if (assignee) updates.assignee = assignee;
      Object.assign(updates, asDueDate(dueDate));

      // The task's own project decides, not the one the caller happened to
      // pass. projectId is optional on this tool, and an update to a gated
      // project must not slip through because the argument was left out.
      const owningProjectId =
        projectId ?? (await this.gate.projectOfTask(id, requestingUserId));

      if (owningProjectId) {
        const proposed = await this.gate.proposeIfGated(
          owningProjectId,
          'task.update',
          updates,
          requestingUserId,
          'The change to this task'
        );
        if (proposed) return proposed;
      }

      const task = await firstValueFrom(
        this.projectPlanningService.send({ cmd: TaskCommands.UPDATE }, updates)
      );

      return {
        success: true,
        message: 'Task updated successfully',
        task,
        awaitingApproval: false,
      };
    } catch (error) {
      this.logger.error('Error updating task:', error);
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  @McpTool({
    name: 'delete_task',
    description: 'Delete a task by ID',
    parameters: z.object({
      taskId: z.string().describe('The ID of the task to delete'),
    }),
  })
  async deleteTask(
    { taskId }: { taskId: string },
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Deleting task ${taskId}`);

      // Deleting is not something a proposal can become, so on a project that
      // requires approval there is no safe version of this and it is refused.
      // Leaving it open would mean the one operation nobody can review is also
      // the only irreversible one.
      const owningProjectId = await this.gate.projectOfTask(
        taskId,
        requestingUserId
      );
      if (owningProjectId) {
        const refused = await this.gate.refuseIfGated(
          owningProjectId,
          requestingUserId,
          'deleting a task'
        );
        if (refused) return refused;
      }

      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.DELETE },
          { id: taskId, requestingUserId }
        )
      );
      return {
        success: true,
        message: 'Task deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting task:', error);
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  }

  @McpTool({
    name: 'count_tasks',
    description:
      'How many tasks a project has, broken down by status and priority. Use ' +
      'this for any question about how many, rather than listing tasks and ' +
      'counting them.',
    parameters: z.object({
      projectId: z.string().describe('The ID of the project to count'),
    }),
  })
  async countTasks(
    { projectId }: { projectId: string },
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Counting tasks for project ${projectId}`);
      const tasks = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.FIND_ALL },
          { projectId, requestingUserId }
        )
      );

      // The arithmetic happens here, once, instead of being handed to a model
      // as twenty thousand characters of JSON to do by eye. Asked how many
      // tasks a project had, it answered four, then seven. There were twelve.
      const rows: { status?: string; priority?: string }[] = tasks ?? [];
      const tally = (key: 'status' | 'priority') =>
        rows.reduce<Record<string, number>>((counts, row) => {
          const value = row[key] ?? 'UNKNOWN';
          counts[value] = (counts[value] ?? 0) + 1;
          return counts;
        }, {});

      return {
        success: true,
        total: rows.length,
        byStatus: tally('status'),
        byPriority: tally('priority'),
        unassigned: rows.filter(
          (row) => !(row as { assignee?: string }).assignee
        ).length,
      };
    } catch (error) {
      this.logger.error('Error counting tasks:', error);
      throw new Error(`Failed to count tasks: ${error.message}`);
    }
  }

  @McpTool({
    name: 'query_tasks',
    description: 'Query tasks within a project by title, status, or priority',
    parameters: queryTasksSchema,
  })
  async queryTasks(
    {
      view = 'brief',
      limit,
      offset,
      ...query
    }: z.infer<typeof queryTasksSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Querying tasks for project ${query.projectId}`
      );
      const tasks = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.FIND_ALL },
          { ...query, requestingUserId }
        )
      );
      return {
        success: true,
        // count, showing, offset and more all come from here, before the
        // rows. Written after them they are the first thing lost when a
        // result is shortened, and the count answers every question about
        // how many there are.
        ...viewTask(tasks, view, { limit, offset }),
      };
    } catch (error) {
      this.logger.error('Error querying tasks:', error);
      throw new Error(`Failed to query tasks: ${error.message}`);
    }
  }
}
