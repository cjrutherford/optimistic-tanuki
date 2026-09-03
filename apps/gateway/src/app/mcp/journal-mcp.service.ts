import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProjectJournalCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  CreateProjectJournalDto,
  ENTITY_VIEWS,
  EntityView,
  UpdateProjectJournalDto,
  applyView,
  pageOf,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { ApprovalGate } from './approval-gate.service';
import { z } from 'zod';

// Define Zod schemas outside the class
export const listJournalEntriesSchema = z.object({
  projectId: z
    .string()
    .describe('The ID of the project whose journal entries to list'),
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

const createJournalEntrySchema = z.object({
  projectId: z.string().describe('The ID of the project'),
  entryDate: z.string().describe('The date of the journal entry'),
  content: z.string().describe('The content of the journal entry'),
});

const updateJournalEntrySchema = z.object({
  id: z.string().describe('The ID of the journal entry to update'),
  content: z
    .string()
    .optional()
    .describe('The updated content of the journal entry'),
});

const queryJournalEntriesSchema = z.object({
  projectId: z
    .string()
    .describe('The ID of the project to query journal entries for'),
  content: z
    .string()
    .optional()
    .describe('Filter journal entries by content (partial match)'),
  entryDate: z.string().optional().describe('Filter journal entries by date'),
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
function viewProjectjournal(
  rows: Record<string, unknown>[],
  view: EntityView,
  paging: { limit?: number; offset?: number }
): {
  count: number;
  showing: number;
  offset: number;
  more: boolean;
  entries: unknown[];
  omittedFields?: string[];
} {
  // The page is taken before the narrowing, and the count comes from pageOf
  // rather than from the rows that come back, so the total stays the total. A
  // count taken after slicing would report the page size and mean it.
  const page = pageOf(rows ?? [], paging);
  const narrowed = applyView(page.rows, 'projectJournal', view);

  return {
    count: page.count,
    showing: page.showing,
    offset: page.offset,
    more: page.more,
    entries: narrowed.rows,
    ...(narrowed.omitted ? { omittedFields: narrowed.omitted } : {}),
  };
}

@Injectable()
export class JournalMcpService {
  private readonly logger = new Logger(JournalMcpService.name);

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
    name: 'list_journal_entries',
    description: 'List all journal entries for a project',
    parameters: listJournalEntriesSchema,
  })
  async listJournalEntries(
    {
      projectId,
      view = 'brief',
      limit,
      offset,
    }: z.infer<typeof listJournalEntriesSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Listing journal entries for project ${projectId}`
      );
      const entries = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectJournalCommands.FIND_ALL },
          { projectId, requestingUserId }
        )
      );
      return {
        success: true,
        // count, showing, offset and more all come from here, before the
        // rows. Written after them they are the first thing lost when a
        // result is shortened, and the count answers every question about
        // how many there are.
        ...viewProjectjournal(entries, view, { limit, offset }),
      };
    } catch (error) {
      this.logger.error('Error listing journal entries:', error);
      throw new Error(`Failed to list journal entries: ${error.message}`);
    }
  }

  @McpTool({
    name: 'create_journal_entry',
    description: 'Create a new journal entry for a project',
    parameters: createJournalEntrySchema,
  })
  async createJournalEntry(
    params: z.infer<typeof createJournalEntrySchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Creating journal entry for project ${params.projectId}`
      );
      const journalData: CreateProjectJournalDto & {
        requestingUserId: string;
      } = {
        projectId: params.projectId,
        content: params.content,
        profileId: requestingUserId,
        requestingUserId,
      };

      const proposed = await this.gate.proposeIfGated(
        params.projectId,
        'projectJournal.create',
        journalData,
        requestingUserId,
        'A journal entry'
      );
      if (proposed) return proposed;

      const result = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectJournalCommands.CREATE },
          journalData
        )
      );
      return {
        success: true,
        result,
      };
    } catch (error) {
      this.logger.error('Error creating journal entry:', error);
      throw new Error(`Failed to create journal entry: ${error.message}`);
    }
  }

  @McpTool({
    name: 'update_journal_entry',
    description: 'Update an existing journal entry',
    parameters: updateJournalEntrySchema,
  })
  async updateJournalEntry(
    params: z.infer<typeof updateJournalEntrySchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(`MCP Tool: Updating journal entry ${params.id}`);
      const journalData: Partial<UpdateProjectJournalDto> & {
        id: string;
        updatedBy: string;
        requestingUserId: string;
      } = {
        id: params.id,
        content: params.content,
        updatedBy: requestingUserId,
        requestingUserId,
      };
      const owningProjectId = await this.gate.projectOfJournalEntry(
        params.id,
        requestingUserId
      );
      if (owningProjectId) {
        const proposed = await this.gate.proposeIfGated(
          owningProjectId,
          'projectJournal.update',
          journalData,
          requestingUserId,
          'The change to this journal entry'
        );
        if (proposed) return proposed;
      }

      const result = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectJournalCommands.UPDATE },
          journalData
        )
      );
      return {
        success: true,
        result,
      };
    } catch (error) {
      this.logger.error('Error updating journal entry:', error);
      throw new Error(`Failed to update journal entry: ${error.message}`);
    }
  }

  @McpTool({
    name: 'query_journal_entries',
    description: 'Query journal entries within a project by content or date',
    parameters: queryJournalEntriesSchema,
  })
  async queryJournalEntries(
    {
      view = 'brief',
      limit,
      offset,
      ...query
    }: z.infer<typeof queryJournalEntriesSchema>,
    _context: unknown,
    request: any
  ) {
    try {
      const requestingUserId = this.requireRequestingUserId(request);
      this.logger.log(
        `MCP Tool: Querying journal entries for project ${query.projectId}`
      );
      const entries = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectJournalCommands.FIND_ALL },
          { ...query, requestingUserId }
        )
      );
      return {
        success: true,
        // count, showing, offset and more all come from here, before the
        // rows. Written after them they are the first thing lost when a
        // result is shortened, and the count answers every question about
        // how many there are.
        ...viewProjectjournal(entries, view, { limit, offset }),
      };
    } catch (error) {
      this.logger.error('Error querying journal entries:', error);
      throw new Error(`Failed to query journal entries: ${error.message}`);
    }
  }
}
