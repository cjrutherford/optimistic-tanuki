import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import { ChangeCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';

// Define Zod schemas outside the class
export const listChangesSchema = z.object({
  projectId: z.string().describe('The ID of the project whose changes to list'),
});

export const createChangeSchema = z.object({
  projectId: z.string().describe('The ID of the project for this change'),
  changeName: z.string().describe('The name of the change'),
  changeDescription: z.string().describe('A description of the change'),
  userId: z.string().describe('The ID of the user creating the change'),
  changeStatus: z
    .enum(['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'COMPLETE', 'DISCARDED'])
    .describe('The status of the change request'),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .optional()
    .describe('The priority of the change'),
  impact: z
    .string()
    .optional()
    .describe('The impact of the change on the project'),
});

export const updateChangeSchema = z.object({
  changeId: z.string().describe('The ID of the change to update'),
  userId: z.string().describe('The ID of the user updating the change'),
  changeName: z.string().optional().describe('The new name of the change'),
  changeDescription: z
    .string()
    .optional()
    .describe('The new description of the change'),
  changeStatus: z
    .enum(['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'COMPLETE', 'DISCARDED'])
    .optional()
    .describe('The new status of the change request'),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .optional()
    .describe('The new priority of the change'),
  impact: z
    .string()
    .optional()
    .describe('Updated impact of the change on the project'),
});

export const deleteChangeSchema = z.object({
  changeId: z.string().describe('The ID of the change to delete'),
});

@Injectable()
export class ChangeMcpService {
  private readonly logger = new Logger(ChangeMcpService.name);

  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningService: ClientProxy
  ) {}

  @McpTool({
    name: 'list_changes',
    description: 'List all changes for a project',
    parameters: listChangesSchema,
  })
  async listChanges({ projectId }: { projectId: string }) {
    try {
      this.logger.log(`MCP Tool: Listing changes for project ${projectId}`);
      const changes = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ChangeCommands.FIND_ALL },
          { projectId }
        )
      );
      return {
        success: true,
        changes,
        count: changes.length,
      };
    } catch (error) {
      this.logger.error('Error listing changes:', error);
      throw new Error(`Failed to list changes: ${error.message}`);
    }
  }

  @McpTool({
    name: 'create_change',
    description: 'Create a new change for a project',
    parameters: createChangeSchema,
  })
  async createChange(params: z.infer<typeof createChangeSchema>) {
    try {
      this.logger.log(
        `MCP Tool: Creating change for project ${params.projectId}`
      );
      const result = await firstValueFrom(
        this.projectPlanningService.send({ cmd: ChangeCommands.CREATE }, params)
      );
      return {
        success: true,
        result,
      };
    } catch (error) {
      this.logger.error('Error creating change:', error);
      throw new Error(`Failed to create change: ${error.message}`);
    }
  }

  @McpTool({
    name: 'update_change',
    description: 'Update an existing change',
    parameters: updateChangeSchema,
  })
  async updateChange(params: z.infer<typeof updateChangeSchema>) {
    try {
      this.logger.log(`MCP Tool: Updating change ${params.changeId}`);
      const result = await firstValueFrom(
        this.projectPlanningService.send({ cmd: ChangeCommands.UPDATE }, params)
      );
      return {
        success: true,
        result,
      };
    } catch (error) {
      this.logger.error('Error updating change:', error);
      throw new Error(`Failed to update change: ${error.message}`);
    }
  }

  @McpTool({
    name: 'delete_change',
    description: 'Delete a change',
    parameters: deleteChangeSchema,
  })
  async deleteChange({ changeId }: { changeId: string }) {
    try {
      this.logger.log(`MCP Tool: Deleting change ${changeId}`);
      const result = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ChangeCommands.DELETE },
          { changeId }
        )
      );
      return {
        success: true,
        result,
      };
    } catch (error) {
      this.logger.error('Error deleting change:', error);
      throw new Error(`Failed to delete change: ${error.message}`);
    }
  }
}
