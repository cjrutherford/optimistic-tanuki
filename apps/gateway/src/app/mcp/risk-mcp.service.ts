import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import { RiskCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CreateRiskDto,
  RiskImpact,
  RiskLikelihood,
  RiskStatus,
  UpdateRiskDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';

// Define Zod schemas outside the class
export const listRisksSchema = z.object({
  projectId: z.string().describe('The ID of the project whose risks to list'),
});

// Define Zod schemas for parameters
const createRiskSchema = z.object({
  projectId: z.string().describe('The ID of the project for this risk'),
  name: z.string().describe('The name of the risk'),
  description: z.string().optional().describe('A description of the risk'),
  userId: z.string().describe('The ID of the user creating the risk'),
  impact: z
    .nativeEnum(RiskImpact)
    .optional()
    .describe('The impact level of the risk (default: LOW)'),
  likelihood: z
    .nativeEnum(RiskLikelihood)
    .optional()
    .describe('The likelihood of the risk (default: UNLIKELY)'),
  status: z
    .nativeEnum(RiskStatus)
    .optional()
    .describe('The status of the risk (default: OPEN)'),
});

const updateRiskSchema = z.object({
  riskId: z.string().describe('The ID of the risk to update'),
  name: z.string().optional().describe('The new name of the risk'),
  description: z
    .string()
    .optional()
    .describe('The new description of the risk'),
  impact: z
    .nativeEnum(RiskImpact)
    .optional()
    .describe('The new impact level of the risk'),
  likelihood: z
    .nativeEnum(RiskLikelihood)
    .optional()
    .describe('The new likelihood of the risk'),
  status: z
    .nativeEnum(RiskStatus)
    .optional()
    .describe('The new status of the risk'),
});

const queryRisksSchema = z.object({
  projectId: z.string().describe('The ID of the project to query risks for'),
  name: z.string().optional().describe('Filter risks by name (partial match)'),
  impact: z
    .nativeEnum(RiskImpact)
    .optional()
    .describe('Filter risks by impact'),
  likelihood: z
    .nativeEnum(RiskLikelihood)
    .optional()
    .describe('Filter risks by likelihood'),
  status: z
    .nativeEnum(RiskStatus)
    .optional()
    .describe('Filter risks by status'),
});

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
    parameters: listRisksSchema,
  })
  async listRisks({ projectId }: z.infer<typeof listRisksSchema>) {
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
    parameters: createRiskSchema,
  })
  async createRisk({
    projectId,
    name,
    description,
    userId,
    impact,
    likelihood,
    status,
  }: z.infer<typeof createRiskSchema>) {
    try {
      this.logger.log(
        `MCP Tool: Creating risk "${name}" for project ${projectId}`
      );
      const riskData: CreateRiskDto = {
        projectId,
        name,
        description,
        riskOwner: userId, // Changed from createdBy to riskOwner
        impact: impact || RiskImpact.LOW,
        likelihood: likelihood || RiskLikelihood.UNLIKELY,
        status: status || RiskStatus.OPEN,
      };

      const risk = await firstValueFrom(
        this.projectPlanningService.send({ cmd: RiskCommands.CREATE }, riskData)
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
    parameters: updateRiskSchema,
  })
  async updateRisk({
    riskId,
    name,
    description,
    impact,
    likelihood,
    status,
  }: z.infer<typeof updateRiskSchema>) {
    try {
      this.logger.log(`MCP Tool: Updating risk ${riskId}`);
      const updates: Partial<UpdateRiskDto> = {};

      if (name) updates.name = name;
      if (description) updates.description = description;
      if (impact) updates.impact = impact;
      if (likelihood) updates.likelihood = likelihood;
      if (status) updates.status = status;

      const risk = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: RiskCommands.UPDATE },
          { riskId, ...updates }
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
    parameters: z.object({
      riskId: z.string().describe('The ID of the risk to delete'),
    }),
  })
  async deleteRisk({ riskId }: { riskId: string }) {
    try {
      this.logger.log(`MCP Tool: Deleting risk ${riskId}`);
      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: RiskCommands.REMOVE },
          { riskId }
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

  @McpTool({
    name: 'query_risks',
    description:
      'Query risks within a project by name, impact, likelihood, or status',
    parameters: queryRisksSchema,
  })
  async queryRisks(query: z.infer<typeof queryRisksSchema>) {
    try {
      this.logger.log(
        `MCP Tool: Querying risks for project ${query.projectId}`
      );
      const risks = await firstValueFrom(
        this.projectPlanningService.send({ cmd: RiskCommands.FIND_ALL }, query)
      );
      return {
        success: true,
        risks,
        count: risks.length,
      };
    } catch (error) {
      this.logger.error('Error querying risks:', error);
      throw new Error(`Failed to query risks: ${error.message}`);
    }
  }
}
