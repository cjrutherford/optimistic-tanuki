import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import { ChangeCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  ChangeStatus,
  Changetype,
  CreateChangeDto,
  ENTITY_VIEWS,
  EntityView,
  applyView,
  pageOf,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { ApprovalGate } from './approval-gate.service';
import { z } from 'zod';

// Define Zod schemas outside the class
export const listChangesSchema = z.object({
  projectId: z.string().describe('The ID of the project whose changes to list'),
  view: z
    .enum(ENTITY_VIEWS)
    .optional()
    .describe(
      'How much of each row to return. "brief" is the default and carries what ' +
        'you would say out loud about it; "full" adds every field including ' +
        'timestamps and who touched it. Ask for full only when you need it.'
    ),
  limit: z
    .number()
    .optional()
    .describe(
      'How many to return. Defaults to 25 and is capped at 100. The count ' +
        'field is always the total, not how many came back.'
    ),
  offset: z
    .number()
    .optional()
    .describe('Where to start, for reading past the first page'),
});

export const createChangeSchema = z.object({
  projectId: z.string().describe('The ID of the project for this change'),
  changeName: z.string().describe('The name of the change'),
  changeDescription: z.string().describe('A description of the change'),
  changeStatus: z
    .nativeEnum(ChangeStatus)
    .optional()
    .describe(
      'The status of the change request. MUST be one of: PENDING, RESEARCHING, DISCUSSING, DESIGNING, PENDING_APPROVAL, IMPLEMENTING, COMPLETE, DISCARDED. Default is PENDING'
    ),
  changeType: z
    .nativeEnum(Changetype)
    .optional()
    .describe('The type of change. Default is MODIFICATION'),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .optional()
    .describe('The priority of the change. Defualt is MEDIUM'),
  impact: z
    .string()
    .optional()
    .describe('The impact of the change on the project'),
  likliehood: z
    .enum([
      'UNLIKELY',
      'POSSIBLE',
      'LIKELY',
      'VERY_LIKELY',
      'IMMINENT',
      'ALMOST_CERTAIN',
      'CERTAIN',
      'NOT_APPLICABLE',
      'UNKNOWN',
    ])
    .optional()
    .describe(
      'The likelihood of the change occurring. Default is NOT_APPLICABLE'
    ),
});

export const updateChangeSchema = z.object({
  changeId: z.string().describe('The ID of the change to update'),
  changeName: z.string().optional().describe('The new name of the change'),
  changeDescription: z
    .string()
    .optional()
    .describe('The new description of the change'),
  changeStatus: z
    .enum(['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'COMPLETE', 'DISCARDED'])
    .optional()
    .describe('The new status of the change request. Default is PROPOSED'),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .optional()
    .describe('The new priority of the change. Default is MEDIUM'),
  liklihood: z
    .enum([
      'UNLIKELY',
      'POSSIBLE',
      'LIKELY',
      'VERY_LIKELY',
      'IMMINENT',
      'ALMOST_CERTAIN',
      'CERTAIN',
      'NOT_APPLICABLE',
      'UNKNOWN',
    ])
    .optional()
    .describe(
      'The new likelihood of the change occurring. Default is NOT_APPLICABLE'
    ),
  impact: z
    .string()
    .optional()
    .describe('Updated impact of the change on the project'),
});

export const deleteChangeSchema = z.object({
  changeId: z.string().describe('The ID of the change to delete'),
});

const queryChangesSchema = z.object({
  projectId: z.string().describe('The ID of the project to query changes for'),
  changeName: z
    .string()
    .optional()
    .describe('Filter changes by name (partial match)'),
  changeStatus: z
    .enum(['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'COMPLETE', 'DISCARDED'])
    .optional()
    .describe('Filter changes by status'),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .optional()
    .describe('Filter changes by priority'),
  view: z
    .enum(ENTITY_VIEWS)
    .optional()
    .describe(
      'How much of each row to return. "brief" is the default and carries what ' +
        'you would say out loud about it; "full" adds every field including ' +
        'timestamps and who touched it. Ask for full only when you need it.'
    ),
  limit: z
    .number()
    .optional()
    .describe(
      'How many to return. Defaults to 25 and is capped at 100. The count ' +
        'field is always the total, not how many came back.'
    ),
  offset: z
    .number()
    .optional()
    .describe('Where to start, for reading past the first page'),
});

/**
 * The rows a list tool hands back, narrowed to the requested view.
 *
 * Named so the omission travels with the data: a reader that cannot tell a
 * missing field from an empty one has no way to know what to ask for next.
 */
function viewChange(
  rows: Record<string, unknown>[],
  view: EntityView,
  paging: { limit?: number; offset?: number }
): {
  count: number;
  showing: number;
  offset: number;
  more: boolean;
  changes: unknown[];
  omittedFields?: string[];
} {
  // The page is taken before the narrowing, and the count comes from pageOf
  // rather than from the rows that come back, so the total stays the total. A
  // count taken after slicing would report the page size and mean it.
  const page = pageOf(rows ?? [], paging);
  const narrowed = applyView(page.rows, 'change', view);

  return {
    count: page.count,
    showing: page.showing,
    offset: page.offset,
    more: page.more,
    changes: narrowed.rows,
    ...(narrowed.omitted ? { omittedFields: narrowed.omitted } : {}),
  };
}

@Injectable()
export class ChangeMcpService {
  private readonly logger = new Logger(ChangeMcpService.name);

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
    name: 'list_changes',
    description: 'List all changes for a project',
    parameters: listChangesSchema,
  })
  async listChanges(
    {
      projectId,
      view = 'brief',
      limit,
      offset,
    }: {
      projectId: string;
      view?: EntityView;
      limit?: number;
      offset?: number;
    },
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Listing changes for project ${projectId}`);
      const changes = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ChangeCommands.FIND_ALL },
          { projectId, requestingUserId }
        )
      );
      return {
        success: true,
        // count, showing, offset and more all come from here, before the
        // rows. Written after them they are the first thing lost when a
        // result is shortened, and the count answers every question about
        // how many there are.
        ...viewChange(changes, view, { limit, offset }),
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
  async createChange(
    params: z.infer<typeof createChangeSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Creating change for project ${params.projectId}`
      );
      const changeData: CreateChangeDto & { requestingUserId: string } = {
        projectId: params.projectId,
        changeType: params.changeType || Changetype.MODIFICATION,
        changeDescription: `${params.changeName}: ${params.changeDescription}`,
        changeStatus: params.changeStatus || ChangeStatus.PENDING,
        changeDate: new Date(),
        requestor: requestingUserId,
        approver: requestingUserId,
        requestingUserId,
      };

      const proposed = await this.gate.proposeIfGated(
        params.projectId,
        'change.create',
        changeData,
        requestingUserId,
        `Change "${params.changeName}"`
      );
      if (proposed) return proposed;

      const result = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ChangeCommands.CREATE },
          changeData
        )
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
  async updateChange(
    params: z.infer<typeof updateChangeSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Updating change ${params.changeId}`);
      const { changeId, ...rest } = params;
      const updates = {
        id: changeId,
        ...rest,
        updatedBy: requestingUserId,
        requestingUserId,
      };

      const owningProjectId = await this.gate.projectOfChange(
        changeId,
        requestingUserId
      );
      if (owningProjectId) {
        const proposed = await this.gate.proposeIfGated(
          owningProjectId,
          'change.update',
          updates,
          requestingUserId,
          'The change to this change record'
        );
        if (proposed) return proposed;
      }

      const result = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ChangeCommands.UPDATE },
          updates
        )
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
  async deleteChange(
    { changeId }: { changeId: string },
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Deleting change ${changeId}`);

      const owningProjectId = await this.gate.projectOfChange(
        changeId,
        requestingUserId
      );
      if (owningProjectId) {
        const refused = await this.gate.refuseIfGated(
          owningProjectId,
          requestingUserId,
          'deleting a change record'
        );
        if (refused) return refused;
      }

      const result = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ChangeCommands.REMOVE },
          { id: changeId, requestingUserId }
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

  @McpTool({
    name: 'query_changes',
    description: 'Query changes within a project by name, status, or priority',
    parameters: queryChangesSchema,
  })
  async queryChanges(
    {
      view = 'brief',
      limit,
      offset,
      ...query
    }: z.infer<typeof queryChangesSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Querying changes for project ${query.projectId}`
      );
      const changes = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ChangeCommands.FIND_ALL },
          { ...query, requestingUserId }
        )
      );
      return {
        success: true,
        // count, showing, offset and more all come from here, before the
        // rows. Written after them they are the first thing lost when a
        // result is shortened, and the count answers every question about
        // how many there are.
        ...viewChange(changes, view, { limit, offset }),
      };
    } catch (error) {
      this.logger.error('Error querying changes:', error);
      throw new Error(`Failed to query changes: ${error.message}`);
    }
  }
}
