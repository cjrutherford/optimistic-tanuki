import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import { ProjectCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import { CreateProjectDto, UpdateProjectDto } from '@optimistic-tanuki/models';

// Define Zod schemas for parameters
const getProjectSchema = z.object({
  projectId: z.string().describe('The ID of the project to retrieve'),
});

const createProjectSchema = z.object({
  name: z.string().describe('The name of the project'),
  description: z.string().describe('A description of the project'),
  userId: z.string().describe('The ID of the user creating the project'),
  startDate: z
    .string()
    .optional()
    .describe('The start date of the project (ISO 8601 format)'),
  status: z
    .enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
    .describe('The status of the project'),
  members: z
    .array(z.string())
    .optional()
    .describe('Array of member IDs to add to the project'),
});

const updateProjectSchema = z.object({
  projectId: z.string().describe('The ID of the project to update'),
  userId: z.string().describe('The ID of the user updating the project'),
  name: z.string().optional().describe('The new name of the project'),
  description: z
    .string()
    .optional()
    .describe('The new description of the project'),
  status: z
    .enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
    .optional()
    .describe('The new status of the project'),
  endDate: z
    .string()
    .optional()
    .describe('The end date of the project (ISO 8601 format)'),
});

const deleteProjectSchema = z.object({
  projectId: z.string().describe('The ID of the project to delete'),
});

// Define Zod schemas outside the class
export const listProjectsSchema = z.object({
  userId: z.string().describe('The ID of the user whose projects to list'),
});

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
    parameters: listProjectsSchema,
  })
  async listProjects({ userId }: z.infer<typeof listProjectsSchema>) {
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
    parameters: getProjectSchema,
  })
  async getProject({ projectId }: z.infer<typeof getProjectSchema>) {
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
    parameters: createProjectSchema,
  })
  async createProject({
    name,
    description,
    userId,
    startDate,
    status,
    members = [],
  }: z.infer<typeof createProjectSchema>) {
    try {
      this.logger.log(
        `MCP Tool: Creating project "${name}" for user ${userId}`
      );
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
    parameters: updateProjectSchema,
  })
  async updateProject({
    projectId,
    userId,
    name,
    description,
    status,
    endDate,
  }: z.infer<typeof updateProjectSchema>) {
    try {
      this.logger.log(`MCP Tool: Updating project ${projectId}`);
      const updates: Partial<UpdateProjectDto> = {
        id: projectId,
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
    parameters: deleteProjectSchema,
  })
  async deleteProject({ projectId }: z.infer<typeof deleteProjectSchema>) {
    try {
      this.logger.log(`MCP Tool: Deleting project ${projectId}`);
      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectCommands.REMOVE },
          { projectId }
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
