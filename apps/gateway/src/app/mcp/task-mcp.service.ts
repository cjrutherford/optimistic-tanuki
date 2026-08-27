import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import { TaskCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CreateTaskDto,
  TaskPriority,
  TaskStatus,
  UpdateTaskDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';

// Define Zod schemas outside the class
export const listTasksSchema = z.object({
  projectId: z.string().describe('The ID of the project whose tasks to list'),
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
});

@Injectable()
export class TaskMcpService {
  private readonly logger = new Logger(TaskMcpService.name);

  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningService: ClientProxy
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
    { projectId }: z.infer<typeof listTasksSchema>,
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
        tasks,
        count: tasks.length,
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
        requestingUserId,
      };

      const task = await firstValueFrom(
        this.projectPlanningService.send({ cmd: TaskCommands.CREATE }, taskData)
      );

      return {
        success: true,
        message: `Task "${title}" created successfully`,
        task,
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

      const task = await firstValueFrom(
        this.projectPlanningService.send({ cmd: TaskCommands.UPDATE }, updates)
      );

      return {
        success: true,
        message: 'Task updated successfully',
        task,
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
    name: 'query_tasks',
    description: 'Query tasks within a project by title, status, or priority',
    parameters: queryTasksSchema,
  })
  async queryTasks(
    query: z.infer<typeof queryTasksSchema>,
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
        tasks,
        count: tasks.length,
      };
    } catch (error) {
      this.logger.error('Error querying tasks:', error);
      throw new Error(`Failed to query tasks: ${error.message}`);
    }
  }
}
