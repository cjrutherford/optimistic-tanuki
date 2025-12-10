import { Injectable, Inject, Logger } from '@nestjs/common';
import { McpTool } from '@nestjs-mcp/server';
import { ClientProxy } from '@nestjs/microservices';
import { ChangeCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { CreateChangeDto, UpdateChangeDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

/**
 * MCP Tools for Change Management
 * These tools allow AI assistants to interact with changes through the Model Context Protocol
 */
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
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project whose changes to list',
        },
      },
      required: ['projectId'],
    },
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
    description: 'Create a new change request for a project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project for this change',
        },
        changeName: {
          type: 'string',
          description: 'The name of the change',
        },
        changeDescription: {
          type: 'string',
          description: 'A description of the change',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user creating the change',
        },
        changeStatus: {
          type: 'string',
          description: 'The status of the change request',
          enum: ['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'COMPLETE', 'DISCARDED'],
        },
        priority: {
          type: 'string',
          description: 'The priority of the change',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        },
        impact: {
          type: 'string',
          description: 'The impact of the change on the project',
        },
      },
      required: ['projectId', 'changeName', 'changeDescription', 'userId', 'changeStatus'],
    },
  })
  async createChange({
    projectId,
    changeName,
    changeDescription,
    userId,
    changeStatus,
    priority,
    impact,
  }: {
    projectId: string;
    changeName: string;
    changeDescription: string;
    userId: string;
    changeStatus: string;
    priority?: string;
    impact?: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Creating change "${changeName}" for project ${projectId}`);
      const changeData: CreateChangeDto = {
        projectId,
        changeName,
        changeDescription,
        createdBy: userId,
        changeStatus,
        priority: priority || 'MEDIUM',
        impact,
      };

      const change = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ChangeCommands.CREATE },
          changeData
        )
      );

      return {
        success: true,
        message: `Change "${changeName}" created successfully`,
        change,
      };
    } catch (error) {
      this.logger.error('Error creating change:', error);
      throw new Error(`Failed to create change: ${error.message}`);
    }
  }

  @McpTool({
    name: 'update_change',
    description: 'Update an existing change request',
    parameters: {
      type: 'object',
      properties: {
        changeId: {
          type: 'string',
          description: 'The ID of the change to update',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user updating the change',
        },
        changeName: {
          type: 'string',
          description: 'The new name of the change',
        },
        changeDescription: {
          type: 'string',
          description: 'The new description of the change',
        },
        changeStatus: {
          type: 'string',
          description: 'The new status of the change request',
          enum: ['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'COMPLETE', 'DISCARDED'],
        },
        priority: {
          type: 'string',
          description: 'The new priority of the change',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        },
        impact: {
          type: 'string',
          description: 'Updated impact of the change on the project',
        },
      },
      required: ['changeId', 'userId'],
    },
  })
  async updateChange({
    changeId,
    userId,
    changeName,
    changeDescription,
    changeStatus,
    priority,
    impact,
  }: {
    changeId: string;
    userId: string;
    changeName?: string;
    changeDescription?: string;
    changeStatus?: string;
    priority?: string;
    impact?: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Updating change ${changeId}`);
      const updates: Partial<UpdateChangeDto> = {
        id: changeId,
        updatedBy: userId,
      };

      if (changeName) updates.changeName = changeName;
      if (changeDescription) updates.changeDescription = changeDescription;
      if (changeStatus) updates.changeStatus = changeStatus;
      if (priority) updates.priority = priority;
      if (impact) updates.impact = impact;

      const change = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ChangeCommands.UPDATE },
          updates
        )
      );

      return {
        success: true,
        message: 'Change updated successfully',
        change,
      };
    } catch (error) {
      this.logger.error('Error updating change:', error);
      throw new Error(`Failed to update change: ${error.message}`);
    }
  }

  @McpTool({
    name: 'delete_change',
    description: 'Delete a change request',
    parameters: {
      type: 'object',
      properties: {
        changeId: {
          type: 'string',
          description: 'The ID of the change to delete',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user deleting the change',
        },
      },
      required: ['changeId', 'userId'],
    },
  })
  async deleteChange({
    changeId,
    userId,
  }: {
    changeId: string;
    userId: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Deleting change ${changeId} by user ${userId}`);
      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ChangeCommands.REMOVE },
          changeId
        )
      );

      return {
        success: true,
        message: 'Change deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting change:', error);
      throw new Error(`Failed to delete change: ${error.message}`);
    }
  }
}
