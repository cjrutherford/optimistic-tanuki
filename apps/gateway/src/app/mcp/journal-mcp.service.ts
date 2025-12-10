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

@Injectable()
export class JournalMcpService {
  private readonly logger = new Logger(JournalMcpService.name);

  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningService: ClientProxy
  ) {}

  @McpTool({
    name: 'list_journal_entries',
    description: 'List all journal entries for a project',
    parameters: listJournalEntriesSchema,
  })
  async listJournalEntries({
    projectId,
  }: z.infer<typeof listJournalEntriesSchema>) {
    try {
      this.logger.log(
        `MCP Tool: Listing journal entries for project ${projectId}`
      );
      const entries = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectJournalCommands.FIND_ALL },
          { projectId }
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
    parameters: z.object({
      projectId: z.string().describe('The ID of the project'),
      userId: z.string().describe('The ID of the user creating the entry'),
      entryDate: z.string().describe('The date of the journal entry'),
      content: z.string().describe('The content of the journal entry'),
    }),
  })
  async createJournalEntry(params: CreateProjectJournalDto) {
    try {
      this.logger.log(
        `MCP Tool: Creating journal entry for project ${params.projectId}`
      );
      const result = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectJournalCommands.CREATE },
          params
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
    parameters: z.object({
      id: z.string().describe('The ID of the journal entry to update'),
      userId: z.string().describe('The ID of the user updating the entry'),
      content: z
        .string()
        .optional()
        .describe('The updated content of the journal entry'),
    }),
  })
  async updateJournalEntry(params: UpdateProjectJournalDto) {
    try {
      this.logger.log(`MCP Tool: Updating journal entry ${params.id}`);
      const result = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectJournalCommands.UPDATE },
          params
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
}
