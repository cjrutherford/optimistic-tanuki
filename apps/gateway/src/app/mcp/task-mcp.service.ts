import { Injectable, Inject, Logger } from '@nestjs/common';
import { McpTool } from '@nestjs-mcp/server';
import { ClientProxy } from '@nestjs/microservices';
import { TaskCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { CreateTaskDto, UpdateTaskDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

/**
 * MCP Tools for Task Management
 * These tools allow AI assistants to interact with tasks through the Model Context Protocol
 */
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
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project whose tasks to list',
        },
      },
      required: ['projectId'],
    },
  })
  async listTasks({ projectId }: { projectId: string }) {
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
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to retrieve',
        },
      },
      required: ['taskId'],
    },
  })
  async getTask({ taskId }: { taskId: string }) {
    try {
      this.logger.log(`MCP Tool: Getting task ${taskId}`);
      const task = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.FIND_ONE },
          taskId
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
    description: 'Create a new task in a project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project for this task',
        },
        name: {
          type: 'string',
          description: 'The name of the task',
        },
        description: {
          type: 'string',
          description: 'A description of the task',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user creating the task',
        },
        status: {
          type: 'string',
          description: 'The status of the task',
          enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'ARCHIVED'],
        },
        priority: {
          type: 'string',
          description: 'The priority of the task',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        },
        assignedTo: {
          type: 'string',
          description: 'The ID of the user assigned to this task',
        },
        dueDate: {
          type: 'string',
          description: 'The due date for the task (ISO 8601 format)',
        },
      },
      required: ['projectId', 'name', 'description', 'userId', 'status'],
    },
  })
  async createTask({
    projectId,
    name,
    description,
    userId,
    status,
    priority,
    assignedTo,
    dueDate,
  }: {
    projectId: string;
    name: string;
    description: string;
    userId: string;
    status: string;
    priority?: string;
    assignedTo?: string;
    dueDate?: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Creating task "${name}" for project ${projectId}`);
      const taskData: CreateTaskDto = {
        projectId,
        name,
        description,
        createdBy: userId,
        status,
        priority: priority || 'MEDIUM',
        assignedTo,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      };

      const task = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.CREATE },
          taskData
        )
      );

      return {
        success: true,
        message: `Task "${name}" created successfully`,
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
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to update',
        },
        name: {
          type: 'string',
          description: 'The new name of the task',
        },
        description: {
          type: 'string',
          description: 'The new description of the task',
        },
        status: {
          type: 'string',
          description: 'The new status of the task',
          enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'ARCHIVED'],
        },
        priority: {
          type: 'string',
          description: 'The new priority of the task',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        },
        userId: {
          type: 'string',
          description: 'The ID of the user updating the task',
        },
        assignedTo: {
          type: 'string',
          description: 'The ID of the user assigned to this task',
        },
        dueDate: {
          type: 'string',
          description: 'The due date for the task (ISO 8601 format)',
        },
      },
      required: ['taskId', 'userId'],
    },
  })
  async updateTask({
    taskId,
    userId,
    name,
    description,
    status,
    priority,
    assignedTo,
    dueDate,
  }: {
    taskId: string;
    userId: string;
    name?: string;
    description?: string;
    status?: string;
    priority?: string;
    assignedTo?: string;
    dueDate?: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Updating task ${taskId}`);
      const updates: Partial<UpdateTaskDto> = {
        id: taskId,
        updatedBy: userId,
      };

      if (name) updates.name = name;
      if (description) updates.description = description;
      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (assignedTo) updates.assignedTo = assignedTo;
      if (dueDate) updates.dueDate = new Date(dueDate);

      const task = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.UPDATE },
          updates
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
    description: 'Delete a task',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to delete',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user deleting the task',
        },
      },
      required: ['taskId', 'userId'],
    },
  })
  async deleteTask({
    taskId,
    userId,
  }: {
    taskId: string;
    userId: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Deleting task ${taskId} by user ${userId}`);
      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: TaskCommands.DELETE },
          taskId
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
