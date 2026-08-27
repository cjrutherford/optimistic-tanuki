import { Injectable, Inject, Logger } from '@nestjs/common';
import { Tool as McpTool } from '@rekog/mcp-nest';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProjectJournalCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  CreateProjectJournalDto,
  UpdateProjectJournalDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';

// Define Zod schemas outside the class
export const listJournalEntriesSchema = z.object({
  projectId: z
    .string()
    .describe('The ID of the project whose journal entries to list'),
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
});

@Injectable()
export class JournalMcpService {
  private readonly logger = new Logger(JournalMcpService.name);

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
    name: 'list_journal_entries',
    description: 'List all journal entries for a project',
    parameters: listJournalEntriesSchema,
  })
  async listJournalEntries(
    { projectId }: z.infer<typeof listJournalEntriesSchema>,
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
        entries,
        count: entries.length,
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
    query: z.infer<typeof queryJournalEntriesSchema>,
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
        entries,
        count: entries.length,
      };
    } catch (error) {
      this.logger.error('Error querying journal entries:', error);
      throw new Error(`Failed to query journal entries: ${error.message}`);
    }
  }
}
