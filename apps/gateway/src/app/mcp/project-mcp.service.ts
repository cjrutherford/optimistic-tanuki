import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool, Resource } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProjectCommands,
  ServiceTokens,
  TaskCommands,
  RiskCommands,
  ChangeCommands,
  ProjectJournalCommands,
} from '@optimistic-tanuki/constants';
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
  startDate: z
    .string()
    .optional()
    .describe(
      'The start date of the project (ISO 8601 format) if not provided, defaults to now'
    ),
  status: z
    .enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
    .describe('The status of the project. DEFAULT IS "PLANNING"'),
  members: z
    .array(z.string())
    .optional()
    .describe(
      'Array of member IDs to add to the project. The authenticated user is added automatically.'
    ),
});

const updateProjectSchema = z.object({
  projectId: z.string().describe('The ID of the project to update'),
  name: z.string().optional().describe('The new name of the project'),
  description: z
    .string()
    .optional()
    .describe('The new description of the project'),
  status: z
    .enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
    .optional()
    .describe('The status of the project. '),
  endDate: z
    .string()
    .optional()
    .describe(
      'The end date of the project (ISO 8601 format), if moving to completed status, default to now.'
    ),
});

const deleteProjectSchema = z.object({
  projectId: z.string().describe('The ID of the project to delete'),
});

// Define Zod schemas outside the class
export const listProjectsSchema = z.object({});

@Injectable()
export class ProjectMcpService {
  private readonly logger = new Logger(ProjectMcpService.name);

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
    name: 'list_projects',
    description: 'List all projects for the authenticated user',
    parameters: listProjectsSchema,
  })
  async listProjects(
    _args: z.infer<typeof listProjectsSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Listing projects for user ${requestingUserId}`
      );
      const projects = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectCommands.FIND_ALL },
          { requestingUserId }
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
  async getProject(
    { projectId }: z.infer<typeof getProjectSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Getting project ${projectId}`);
      const project = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectCommands.FIND_ONE },
          { id: projectId, requestingUserId }
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

  @Resource({
    uri: 'project://{projectId}/context',
    name: 'Project Context',
    mimeType: 'application/json',
    description:
      'Get the full context of a project including tasks, risks, changes, and journal entries',
  })
  async getProjectContext(
    params: { projectId: string },
    _context: unknown,
    request: any
  ) {
    try {
      const { projectId } = params;
      // @Resource handlers are invoked with an ADAPTED request whose `.raw`
      // is the underlying Express request that the McpAuthGuard attached
      // `user` to. Fall back to `request.user` for safety.
      const user = request?.raw?.user ?? request?.user;
      const requestingUserId = user?.profileId;
      if (!requestingUserId) {
        throw new Error('Unauthenticated MCP call');
      }

      this.logger.log(`MCP Resource: Getting context for project ${projectId}`);

      const [project, tasks, risks, changes, journalEntries] =
        await Promise.all([
          firstValueFrom(
            this.projectPlanningService.send(
              { cmd: ProjectCommands.FIND_ONE },
              { id: projectId, requestingUserId }
            )
          ),
          firstValueFrom(
            this.projectPlanningService.send(
              { cmd: TaskCommands.FIND_ALL },
              { projectId, requestingUserId }
            )
          ).catch((err) => {
            this.logger.warn(`Failed to fetch tasks for ${projectId}`, err);
            return [];
          }),
          firstValueFrom(
            this.projectPlanningService.send(
              { cmd: RiskCommands.FIND_ALL },
              { projectId, requestingUserId }
            )
          ).catch((err) => {
            this.logger.warn(`Failed to fetch risks for ${projectId}`, err);
            return [];
          }),
          firstValueFrom(
            this.projectPlanningService.send(
              { cmd: ChangeCommands.FIND_ALL },
              { projectId, requestingUserId }
            )
          ).catch((err) => {
            this.logger.warn(`Failed to fetch changes for ${projectId}`, err);
            return [];
          }),
          firstValueFrom(
            this.projectPlanningService.send(
              { cmd: ProjectJournalCommands.FIND_ALL },
              { projectId, requestingUserId }
            )
          ).catch((err) => {
            this.logger.warn(
              `Failed to fetch journal entries for ${projectId}`,
              err
            );
            return [];
          }),
        ]);

      return {
        text: JSON.stringify(
          {
            project,
            tasks,
            risks,
            changes,
            journalEntries,
          },
          null,
          2
        ),
      };
    } catch (error) {
      this.logger.error('Error getting project context:', error);
      throw new Error(`Failed to get project context: ${error.message}`);
    }
  }

  @McpTool({
    name: 'create_project',
    description: 'Create a new project',
    parameters: createProjectSchema,
  })
  async createProject(
    {
      name,
      description,
      startDate,
      status,
      members = [],
    }: z.infer<typeof createProjectSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Creating project "${name}" for user ${requestingUserId}`
      );
      const projectData: CreateProjectDto & { requestingUserId: string } = {
        name,
        description,
        owner: requestingUserId,
        createdBy: requestingUserId,
        startDate: startDate ? new Date(startDate) : new Date(),
        status,
        members,
        requestingUserId,
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
  async updateProject(
    {
      projectId,
      name,
      description,
      status,
      endDate,
    }: z.infer<typeof updateProjectSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Updating project ${projectId}`);
      const updates: Partial<UpdateProjectDto> & {
        id: string;
        updatedBy: string;
        requestingUserId: string;
      } = {
        id: projectId,
        updatedBy: requestingUserId,
        requestingUserId,
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
  async deleteProject(
    { projectId }: z.infer<typeof deleteProjectSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Deleting project ${projectId}`);
      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectCommands.REMOVE },
          { id: projectId, requestingUserId }
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

  @McpTool({
    name: 'query_projects',
    description: 'Query projects by name',
    parameters: z.object({
      name: z.string().describe('The name of the project to query'),
    }),
  })
  async queryProjects(
    query: { name: string },
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Querying projects with name ${query.name}`);
      const projects = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectCommands.FIND_ALL },
          { ...query, requestingUserId }
        )
      );
      return {
        success: true,
        projects,
        count: projects.length,
      };
    } catch (error) {
      this.logger.error('Error querying projects:', error);
      throw new Error(`Failed to query projects: ${error.message}`);
    }
  }
}
