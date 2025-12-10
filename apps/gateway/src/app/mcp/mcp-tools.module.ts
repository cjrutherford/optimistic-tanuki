import { Module } from '@nestjs/common';
import { McpModule as NestMcpModule } from '@nestjs-mcp/server';
import { ProjectMcpService } from './project-mcp.service';
import { TaskMcpService } from './task-mcp.service';

/**
 * MCP Module for ForgeOfWill
 * Provides Model Context Protocol tools for AI assistants to interact with
 * projects, tasks, risks, changes, and journal entries
 */
@Module({
  imports: [
    NestMcpModule.forRoot({
      name: 'forgeofwill-mcp-server',
      version: '1.0.0',
      description: 'MCP server for ForgeOfWill project management',
    }),
  ],
  providers: [ProjectMcpService, TaskMcpService],
  exports: [ProjectMcpService, TaskMcpService],
})
export class McpToolsModule {}
