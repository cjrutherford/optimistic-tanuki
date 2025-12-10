import { Module } from '@nestjs/common';
import { McpModule as NestMcpModule } from '@nestjs-mcp/server';
import { ProjectMcpService } from './project-mcp.service';
import { TaskMcpService } from './task-mcp.service';
import { RiskMcpService } from './risk-mcp.service';
import { ChangeMcpService } from './change-mcp.service';
import { JournalMcpService } from './journal-mcp.service';
import { PersonaMcpService } from './persona-mcp.service';

/**
 * MCP Module for ForgeOfWill
 * Provides Model Context Protocol tools for AI assistants to interact with
 * projects, tasks, risks, changes, journal entries, and other AI personas
 */
@Module({
  imports: [
    NestMcpModule.forRoot({
      name: 'forgeofwill-mcp-server',
      version: '1.0.0',
      description: 'MCP server for ForgeOfWill project management and AI collaboration',
    }),
  ],
  providers: [
    ProjectMcpService,
    TaskMcpService,
    RiskMcpService,
    ChangeMcpService,
    JournalMcpService,
    PersonaMcpService,
  ],
  exports: [
    ProjectMcpService,
    TaskMcpService,
    RiskMcpService,
    ChangeMcpService,
    JournalMcpService,
    PersonaMcpService,
  ],
})
export class McpToolsModule {}
