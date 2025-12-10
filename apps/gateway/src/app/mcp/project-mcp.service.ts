import { Injectable, Inject, Logger } from '@nestjs/common';
import { McpTool } from '@nestjs-mcp/server';
import { ClientProxy } from '@nestjs/microservices';
import { ProjectCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { CreateProjectDto, UpdateProjectDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

/**
 * MCP Tools for Project Management
 * These tools allow AI assistants to interact with projects through the Model Context Protocol
 */
@Injectable()
export class ProjectMcpService {
  private readonly logger = new Logger(ProjectMcpService.name);

  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningService: ClientProxy
  ) {}

  @McpTool({
    name: 'list_projects',
    description: 'List all projects for a user',
    parameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'The ID of the user whose projects to list',
        },
      },
      required: ['userId'],
    },
  })
  async listProjects({ userId }: { userId: string }) {
    try {
      this.logger.log(`MCP Tool: Listing projects for user ${userId}`);
      const projects = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectCommands.FIND_ALL },
          { owner: userId }
        )
      );
      return {
        success: true,
        projects,
        count: projects.length,
      };
    } catch (error) {
      this.logger.error('Error listing projects:', error);
      throw new Error(`Failed to list projects: ${error.message}`);
    }
  }

  @McpTool({
    name: 'get_project',
    description: 'Get details of a specific project by ID',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project to retrieve',
        },
      },
      required: ['projectId'],
    },
  })
  async getProject({ projectId }: { projectId: string }) {
    try {
      this.logger.log(`MCP Tool: Getting project ${projectId}`);
      const project = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectCommands.FIND_ONE },
          projectId
        )
      );
      return {
        success: true,
        project,
      };
    } catch (error) {
      this.logger.error('Error getting project:', error);
      throw new Error(`Failed to get project: ${error.message}`);
    }
  }

  @McpTool({
    name: 'create_project',
    description: 'Create a new project',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the project',
        },
        description: {
          type: 'string',
          description: 'A description of the project',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user creating the project',
        },
        startDate: {
          type: 'string',
          description: 'The start date of the project (ISO 8601 format)',
        },
        status: {
          type: 'string',
          description: 'The status of the project (e.g., PLANNING, ACTIVE, COMPLETED)',
          enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
        },
        members: {
          type: 'array',
          description: 'Array of member IDs to add to the project',
          items: {
            type: 'string',
          },
        },
      },
      required: ['name', 'description', 'userId', 'status'],
    },
  })
  async createProject({
    name,
    description,
    userId,
    startDate,
    status,
    members = [],
  }: {
    name: string;
    description: string;
    userId: string;
    startDate?: string;
    status: string;
    members?: string[];
  }) {
    try {
      this.logger.log(`MCP Tool: Creating project "${name}" for user ${userId}`);
      const projectData: CreateProjectDto = {
        name,
        description,
        owner: userId,
        createdBy: userId,
        startDate: startDate ? new Date(startDate) : new Date(),
        status,
        members,
      };

      const project = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectCommands.CREATE },
          projectData
        )
      );

      return {
        success: true,
        message: `Project "${name}" created successfully`,
        project,
      };
    } catch (error) {
      this.logger.error('Error creating project:', error);
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  @McpTool({
    name: 'update_project',
    description: 'Update an existing project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project to update',
        },
        name: {
          type: 'string',
          description: 'The new name of the project',
        },
        description: {
          type: 'string',
          description: 'The new description of the project',
        },
        status: {
          type: 'string',
          description: 'The new status of the project',
          enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
        },
        userId: {
          type: 'string',
          description: 'The ID of the user updating the project',
        },
        endDate: {
          type: 'string',
          description: 'The end date of the project (ISO 8601 format)',
        },
      },
      required: ['projectId', 'userId'],
    },
  })
  async updateProject({
    projectId,
    userId,
    name,
    description,
    status,
    endDate,
  }: {
    projectId: string;
    userId: string;
    name?: string;
    description?: string;
    status?: string;
    endDate?: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Updating project ${projectId}`);
      const updates: Partial<UpdateProjectDto> = {
        id: projectId,
        updatedBy: userId,
      };

      if (name) updates.name = name;
      if (description) updates.description = description;
      if (status) updates.status = status;
      if (endDate) updates.endDate = new Date(endDate);

      const project = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectCommands.UPDATE },
          updates
        )
      );

      return {
        success: true,
        message: 'Project updated successfully',
        project,
      };
    } catch (error) {
      this.logger.error('Error updating project:', error);
      throw new Error(`Failed to update project: ${error.message}`);
    }
  }

  @McpTool({
    name: 'delete_project',
    description: 'Delete a project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project to delete',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user deleting the project',
        },
      },
      required: ['projectId', 'userId'],
    },
  })
  async deleteProject({
    projectId,
    userId,
  }: {
    projectId: string;
    userId: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Deleting project ${projectId} by user ${userId}`);
      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectCommands.REMOVE },
          projectId
        )
      );

      return {
        success: true,
        message: 'Project deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting project:', error);
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }
}
