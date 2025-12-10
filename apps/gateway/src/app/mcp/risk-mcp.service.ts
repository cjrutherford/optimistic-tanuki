import { Injectable, Inject, Logger } from '@nestjs/common';
import { McpTool } from '@nestjs-mcp/server';
import { ClientProxy } from '@nestjs/microservices';
import { RiskCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { CreateRiskDto, UpdateRiskDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

/**
 * MCP Tools for Risk Management
 * These tools allow AI assistants to interact with risks through the Model Context Protocol
 */
@Injectable()
export class RiskMcpService {
  private readonly logger = new Logger(RiskMcpService.name);

  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningService: ClientProxy
  ) {}

  @McpTool({
    name: 'list_risks',
    description: 'List all risks for a project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project whose risks to list',
        },
      },
      required: ['projectId'],
    },
  })
  async listRisks({ projectId }: { projectId: string }) {
    try {
      this.logger.log(`MCP Tool: Listing risks for project ${projectId}`);
      const risks = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: RiskCommands.FIND_ALL },
          { projectId }
        )
      );
      return {
        success: true,
        risks,
        count: risks.length,
      };
    } catch (error) {
      this.logger.error('Error listing risks:', error);
      throw new Error(`Failed to list risks: ${error.message}`);
    }
  }

  @McpTool({
    name: 'create_risk',
    description: 'Create a new risk for a project',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project for this risk',
        },
        name: {
          type: 'string',
          description: 'The name of the risk',
        },
        description: {
          type: 'string',
          description: 'A description of the risk',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user creating the risk',
        },
        impact: {
          type: 'string',
          description: 'The impact level of the risk',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        },
        probability: {
          type: 'string',
          description: 'The probability of the risk occurring',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
        },
        status: {
          type: 'string',
          description: 'The status of the risk',
          enum: ['IDENTIFIED', 'ASSESSED', 'MITIGATED', 'CLOSED'],
        },
        mitigation: {
          type: 'string',
          description: 'Mitigation strategy for the risk',
        },
      },
      required: ['projectId', 'name', 'description', 'userId', 'impact', 'probability', 'status'],
    },
  })
  async createRisk({
    projectId,
    name,
    description,
    userId,
    impact,
    probability,
    status,
    mitigation,
  }: {
    projectId: string;
    name: string;
    description: string;
    userId: string;
    impact: string;
    probability: string;
    status: string;
    mitigation?: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Creating risk "${name}" for project ${projectId}`);
      const riskData: CreateRiskDto = {
        projectId,
        name,
        description,
        createdBy: userId,
        impact,
        probability,
        status,
        mitigation,
      };

      const risk = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: RiskCommands.CREATE },
          riskData
        )
      );

      return {
        success: true,
        message: `Risk "${name}" created successfully`,
        risk,
      };
    } catch (error) {
      this.logger.error('Error creating risk:', error);
      throw new Error(`Failed to create risk: ${error.message}`);
    }
  }

  @McpTool({
    name: 'update_risk',
    description: 'Update an existing risk',
    parameters: {
      type: 'object',
      properties: {
        riskId: {
          type: 'string',
          description: 'The ID of the risk to update',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user updating the risk',
        },
        name: {
          type: 'string',
          description: 'The new name of the risk',
        },
        description: {
          type: 'string',
          description: 'The new description of the risk',
        },
        impact: {
          type: 'string',
          description: 'The new impact level of the risk',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        },
        probability: {
          type: 'string',
          description: 'The new probability of the risk occurring',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
        },
        status: {
          type: 'string',
          description: 'The new status of the risk',
          enum: ['IDENTIFIED', 'ASSESSED', 'MITIGATED', 'CLOSED'],
        },
        mitigation: {
          type: 'string',
          description: 'Updated mitigation strategy for the risk',
        },
      },
      required: ['riskId', 'userId'],
    },
  })
  async updateRisk({
    riskId,
    userId,
    name,
    description,
    impact,
    probability,
    status,
    mitigation,
  }: {
    riskId: string;
    userId: string;
    name?: string;
    description?: string;
    impact?: string;
    probability?: string;
    status?: string;
    mitigation?: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Updating risk ${riskId}`);
      const updates: Partial<UpdateRiskDto> = {
        id: riskId,
        updatedBy: userId,
      };

      if (name) updates.name = name;
      if (description) updates.description = description;
      if (impact) updates.impact = impact;
      if (probability) updates.probability = probability;
      if (status) updates.status = status;
      if (mitigation) updates.mitigation = mitigation;

      const risk = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: RiskCommands.UPDATE },
          updates
        )
      );

      return {
        success: true,
        message: 'Risk updated successfully',
        risk,
      };
    } catch (error) {
      this.logger.error('Error updating risk:', error);
      throw new Error(`Failed to update risk: ${error.message}`);
    }
  }

  @McpTool({
    name: 'delete_risk',
    description: 'Delete a risk',
    parameters: {
      type: 'object',
      properties: {
        riskId: {
          type: 'string',
          description: 'The ID of the risk to delete',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user deleting the risk',
        },
      },
      required: ['riskId', 'userId'],
    },
  })
  async deleteRisk({
    riskId,
    userId,
  }: {
    riskId: string;
    userId: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Deleting risk ${riskId} by user ${userId}`);
      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: RiskCommands.DELETE },
          riskId
        )
      );

      return {
        success: true,
        message: 'Risk deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting risk:', error);
      throw new Error(`Failed to delete risk: ${error.message}`);
    }
  }
}
