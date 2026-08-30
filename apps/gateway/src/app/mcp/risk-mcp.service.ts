import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import { RiskCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CreateRiskDto,
  ENTITY_VIEWS,
  EntityView,
  RiskImpact,
  RiskLikelihood,
  RiskStatus,
  UpdateRiskDto,
  applyView,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { ApprovalGate } from './approval-gate.service';
import { z } from 'zod';

// Define Zod schemas outside the class
export const listRisksSchema = z.object({
  projectId: z.string().describe('The ID of the project whose risks to list'),
  view: z
    .enum(ENTITY_VIEWS)
    .optional()
    .describe(
      'How much of each row to return. "brief" is the default and carries what ' +
        'you would say out loud about it; "full" adds every field including ' +
        'timestamps and who touched it. Ask for full only when you need it.'
    ),
});

// Define Zod schemas for parameters
const createRiskSchema = z.object({
  projectId: z.string().describe('The ID of the project for this risk'),
  name: z.string().describe('The name of the risk'),
  description: z.string().optional().describe('A description of the risk'),
  impact: z
    .nativeEnum(RiskImpact)
    .optional()
    .describe(
      'The impact level of the risk. MUST be one of: LOW, MEDIUM, HIGH. Default: LOW'
    ),
  likelihood: z
    .nativeEnum(RiskLikelihood)
    .optional()
    .describe(
      'The likelihood of the risk. MUST be one of: UNLIKELY, POSSIBLE, LIKELY, IMMINENT, ALMOST_CERTAIN, CERTAIN, NOT_APPLICABLE, UNKNOWN. Default: UNLIKELY'
    ),
  status: z
    .nativeEnum(RiskStatus)
    .optional()
    .describe(
      'The status of the risk. MUST be one of: OPEN, IN_PROGRESS, CLOSED. Default: OPEN'
    ),
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
  view: z
    .enum(ENTITY_VIEWS)
    .optional()
    .describe(
      'How much of each row to return. "brief" is the default and carries what ' +
        'you would say out loud about it; "full" adds every field including ' +
        'timestamps and who touched it. Ask for full only when you need it.'
    ),
});

/**
 * The rows a list tool hands back, narrowed to the requested view.
 *
 * Named so the omission travels with the data: a reader that cannot tell a
 * missing field from an empty one has no way to know what to ask for next.
 */
function viewRisk(
  rows: Record<string, unknown>[],
  view: EntityView
): { risks: unknown[]; omittedFields?: string[] } {
  const narrowed = applyView(rows ?? [], 'risk', view);
  return narrowed.omitted
    ? { risks: narrowed.rows, omittedFields: narrowed.omitted }
    : { risks: narrowed.rows };
}

@Injectable()
export class RiskMcpService {
  private readonly logger = new Logger(RiskMcpService.name);

  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningService: ClientProxy,
    private readonly gate: ApprovalGate
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
    name: 'list_risks',
    description: 'List all risks for a project',
    parameters: listRisksSchema,
  })
  async listRisks(
    { projectId, view = 'brief' }: z.infer<typeof listRisksSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Listing risks for project ${projectId}`);
      const risks = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: RiskCommands.FIND_ALL },
          { projectId, requestingUserId }
        )
      );
      return {
        success: true,
        // Before the list, not after it. Written last, the
        // count is the first thing lost when a result has to
        // be shortened, and it is the answer to every question
        // about how many there are.
        count: risks.length,
        // Narrowed unless the caller asked for everything. A whole row per
        // item is what made a list too long to read and too long to keep.
        ...viewRisk(risks, view),
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
  async createRisk(
    {
      projectId,
      name,
      description,
      impact,
      likelihood,
      status,
    }: z.infer<typeof createRiskSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Creating risk "${name}" for project ${projectId}`
      );
      const riskData: CreateRiskDto & { requestingUserId: string } = {
        projectId,
        name,
        description: description ? `${name}: ${description}` : name,
        riskOwner: requestingUserId, // Changed from createdBy to riskOwner
        impact: impact || RiskImpact.LOW,
        likelihood: likelihood || RiskLikelihood.UNLIKELY,
        status: status || RiskStatus.OPEN,
        requestingUserId,
      };
      this.logger.log(
        `RiskMcpService sending riskData: ${JSON.stringify(riskData)}`
      );

      const proposed = await this.gate.proposeIfGated(
        projectId,
        'risk.create',
        riskData,
        requestingUserId,
        `Risk "${name}"`
      );
      if (proposed) return proposed;

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
  async updateRisk(
    {
      riskId,
      name,
      description,
      impact,
      likelihood,
      status,
    }: z.infer<typeof updateRiskSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Updating risk ${riskId}`);
      const updates: Partial<UpdateRiskDto> & {
        id: string;
        updatedBy: string;
        requestingUserId: string;
      } = { id: riskId, updatedBy: requestingUserId, requestingUserId };

      if (name) updates.name = name;
      if (description) updates.description = description;
      if (impact) updates.impact = impact;
      if (likelihood) updates.likelihood = likelihood;
      if (status) updates.status = status;

      const owningProjectId = await this.gate.projectOfRisk(
        riskId,
        requestingUserId
      );
      if (owningProjectId) {
        const proposed = await this.gate.proposeIfGated(
          owningProjectId,
          'risk.update',
          updates,
          requestingUserId,
          'The change to this risk'
        );
        if (proposed) return proposed;
      }

      const risk = await firstValueFrom(
        this.projectPlanningService.send({ cmd: RiskCommands.UPDATE }, updates)
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
  async deleteRisk(
    { riskId }: { riskId: string },
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Deleting risk ${riskId}`);

      const owningProjectId = await this.gate.projectOfRisk(
        riskId,
        requestingUserId
      );
      if (owningProjectId) {
        const refused = await this.gate.refuseIfGated(
          owningProjectId,
          requestingUserId,
          'deleting a risk'
        );
        if (refused) return refused;
      }

      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: RiskCommands.REMOVE },
          { id: riskId, requestingUserId }
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
  async queryRisks(
    { view = 'brief', ...query }: z.infer<typeof queryRisksSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Querying risks for project ${query.projectId}`
      );
      const risks = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: RiskCommands.FIND_ALL },
          { ...query, requestingUserId }
        )
      );
      return {
        success: true,
        // Before the list, not after it. Written last, the
        // count is the first thing lost when a result has to
        // be shortened, and it is the answer to every question
        // about how many there are.
        count: risks.length,
        // Narrowed unless the caller asked for everything. A whole row per
        // item is what made a list too long to read and too long to keep.
        ...viewRisk(risks, view),
      };
    } catch (error) {
      this.logger.error('Error querying risks:', error);
      throw new Error(`Failed to query risks: ${error.message}`);
    }
  }
}
