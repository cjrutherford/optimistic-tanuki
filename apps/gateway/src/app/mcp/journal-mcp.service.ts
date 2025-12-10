import { Injectable, Inject, Logger } from '@nestjs/common';
import { McpTool } from '@nestjs-mcp/server';
import { ClientProxy } from '@nestjs/microservices';
import { ProjectJournalCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { CreateProjectJournalDto, UpdateProjectJournalDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';

/**
 * MCP Tools for Project Journal Management
 * These tools allow AI assistants to interact with project journal entries through the Model Context Protocol
 */
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
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project whose journal entries to list',
        },
      },
      required: ['projectId'],
    },
  })
  async listJournalEntries({ projectId }: { projectId: string }) {
    try {
      this.logger.log(`MCP Tool: Listing journal entries for project ${projectId}`);
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
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project for this journal entry',
        },
        profileId: {
          type: 'string',
          description: 'The ID of the profile creating this journal entry',
        },
        entry: {
          type: 'string',
          description: 'The content of the journal entry',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user creating the journal entry',
        },
        entryDate: {
          type: 'string',
          description: 'The date of the journal entry (ISO 8601 format)',
        },
      },
      required: ['projectId', 'profileId', 'entry', 'userId'],
    },
  })
  async createJournalEntry({
    projectId,
    profileId,
    entry,
    userId,
    entryDate,
  }: {
    projectId: string;
    profileId: string;
    entry: string;
    userId: string;
    entryDate?: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Creating journal entry for project ${projectId}`);
      const journalData: CreateProjectJournalDto = {
        projectId,
        profileId,
        entry,
        createdBy: userId,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
      };

      const journalEntry = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectJournalCommands.CREATE },
          journalData
        )
      );

      return {
        success: true,
        message: 'Journal entry created successfully',
        journalEntry,
      };
    } catch (error) {
      this.logger.error('Error creating journal entry:', error);
      throw new Error(`Failed to create journal entry: ${error.message}`);
    }
  }

  @McpTool({
    name: 'update_journal_entry',
    description: 'Update an existing journal entry',
    parameters: {
      type: 'object',
      properties: {
        entryId: {
          type: 'string',
          description: 'The ID of the journal entry to update',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user updating the journal entry',
        },
        entry: {
          type: 'string',
          description: 'The updated content of the journal entry',
        },
        entryDate: {
          type: 'string',
          description: 'The updated date of the journal entry (ISO 8601 format)',
        },
      },
      required: ['entryId', 'userId'],
    },
  })
  async updateJournalEntry({
    entryId,
    userId,
    entry,
    entryDate,
  }: {
    entryId: string;
    userId: string;
    entry?: string;
    entryDate?: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Updating journal entry ${entryId}`);
      const updates: Partial<UpdateProjectJournalDto> = {
        id: entryId,
        updatedBy: userId,
      };

      if (entry) updates.entry = entry;
      if (entryDate) updates.entryDate = new Date(entryDate);

      const journalEntry = await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectJournalCommands.UPDATE },
          updates
        )
      );

      return {
        success: true,
        message: 'Journal entry updated successfully',
        journalEntry,
      };
    } catch (error) {
      this.logger.error('Error updating journal entry:', error);
      throw new Error(`Failed to update journal entry: ${error.message}`);
    }
  }

  @McpTool({
    name: 'delete_journal_entry',
    description: 'Delete a journal entry',
    parameters: {
      type: 'object',
      properties: {
        entryId: {
          type: 'string',
          description: 'The ID of the journal entry to delete',
        },
        userId: {
          type: 'string',
          description: 'The ID of the user deleting the journal entry',
        },
      },
      required: ['entryId', 'userId'],
    },
  })
  async deleteJournalEntry({
    entryId,
    userId,
  }: {
    entryId: string;
    userId: string;
  }) {
    try {
      this.logger.log(`MCP Tool: Deleting journal entry ${entryId} by user ${userId}`);
      await firstValueFrom(
        this.projectPlanningService.send(
          { cmd: ProjectJournalCommands.REMOVE },
          entryId
        )
      );

      return {
        success: true,
        message: 'Journal entry deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting journal entry:', error);
      throw new Error(`Failed to delete journal entry: ${error.message}`);
    }
  }
}
