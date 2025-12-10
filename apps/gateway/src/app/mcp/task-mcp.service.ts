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
  status: z.nativeEnum(TaskStatus).describe('Status of the task'),
  priority: z.nativeEnum(TaskPriority).describe('Priority of the task'),
  createdBy: z.string().describe('User who created the task'),
  projectId: z.string().describe('ID of the related project'),
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
  createdBy: z.string().optional().describe('User who created the task'),
  projectId: z.string().optional().describe('ID of the related project'),
});

@Injectable()
export class TaskMcpService {
  private readonly logger = new Logger(TaskMcpService.name);

  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningService: ClientProxy
  ) {}

  @McpTool({
    name: 'list_tasks',
    description: 'List all tasks for a project',
    parameters: listTasksSchema,
  })
  async listTasks({ projectId }: z.infer<typeof listTasksSchema>) {
    try {
      this.logger.log(`MCP Tool: Listing tasks for project ${projectId}`);
      const tasks = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.FIND_ALL },
          { projectId }
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
    description: 'Get details of a specific task by ID',
    parameters: getTaskSchema,
  })
  async getTask({ taskId }: z.infer<typeof getTaskSchema>) {
    try {
      this.logger.log(`MCP Tool: Getting task ${taskId}`);
      const task = await firstValueFrom(
        this.projectPlanningService.send({ cmd: TaskCommands.FIND_ONE }, taskId)
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
    description: 'Create a new task for a project',
    parameters: createTaskSchema,
  })
  async createTask({
    title,
    description,
    status,
    priority,
    createdBy,
    projectId,
  }: z.infer<typeof createTaskSchema>) {
    try {
      this.logger.log(
        `MCP Tool: Creating task "${title}" for project ${projectId}`
      );
      const taskData: CreateTaskDto = {
        title,
        description,
        status,
        priority,
        createdBy,
        projectId,
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
    description: 'Update an existing task',
    parameters: updateTaskSchema,
  })
  async updateTask({
    id,
    title,
    description,
    status,
    priority,
    createdBy,
    projectId,
  }: z.infer<typeof updateTaskSchema>) {
    try {
      this.logger.log(`MCP Tool: Updating task ${id}`);
      const updates: Partial<UpdateTaskDto> = {};

      if (title) updates.title = title;
      if (description) updates.description = description;
      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (createdBy) updates.createdBy = createdBy;
      if (projectId) updates.projectId = projectId;

      const task = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.UPDATE },
          { id, ...updates }
        )
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
  async deleteTask({ taskId }: { taskId: string }) {
    try {
      this.logger.log(`MCP Tool: Deleting task ${taskId}`);
      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.REMOVE },
          { taskId }
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
}
