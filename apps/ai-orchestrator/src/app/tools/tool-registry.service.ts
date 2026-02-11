/**
 * Tool Registry Service
 *
 * Centralized tool management with intelligent caching.
 * Provides efficient tool lookup and execution with context injection.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MCPToolExecutor } from '../mcp-tool-executor';
import { ToolsService } from '../tools.service';

export const TOOL_OUTPUT_BLACKLIST = ['list_tools'];
export const TOOL_RESULT_SUMMARIES: Record<string, string> = {
  list_tools: 'Available tools retrieved',
};

export interface ToolExecutionContext {
  userId: string;
  profileId: string;
  conversationId?: string;
  timestamp: Date;
}

export function getToolResultContent(tool: string, output: unknown): string {
  if (TOOL_OUTPUT_BLACKLIST.includes(tool)) {
    return TOOL_RESULT_SUMMARIES[tool] || 'Tool executed successfully';
  }
  return typeof output === 'string' ? output : JSON.stringify(output, null, 2);
}

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private cachedTools: DynamicStructuredTool[] | null = null;
  private mcpToolsCache: Tool[] | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly toolsService: ToolsService,
    private readonly mcpExecutor: MCPToolExecutor
  ) {}

  /**
   * Get all available tools (cached)
   */
  async getTools(): Promise<DynamicStructuredTool[]> {
    if (this.shouldRefreshCache()) {
      await this.refreshTools();
    }
    return this.cachedTools || [];
  }

  /**
   * Get a specific tool by name
   */
  async getTool(name: string): Promise<DynamicStructuredTool | undefined> {
    const tools = await this.getTools();
    return tools.find((t) => t.name === name);
  }

  /**
   * Get raw MCP tools
   */
  async getMCPTools(): Promise<Tool[]> {
    if (this.shouldRefreshCache()) {
      await this.refreshTools();
    }
    return this.mcpToolsCache || [];
  }

  /**
   * Get tools suitable for delete operations (for human-in-the-loop)
   */
  async getDeleteTools(): Promise<DynamicStructuredTool[]> {
    const tools = await this.getTools();
    const deleteToolPatterns = ['delete', 'remove', 'archive'];
    return tools.filter((t) =>
      deleteToolPatterns.some((pattern) => t.name.includes(pattern))
    );
  }

  /**
   * Check if a tool requires human approval
   */
  requiresHumanApproval(toolName: string): boolean {
    const sensitiveTools = ['delete', 'remove', 'archive', 'permanent_delete'];
    return sensitiveTools.some((pattern) => toolName.includes(pattern));
  }

  /**
   * Determine if tools can be executed in parallel
   */
  canExecuteInParallel(toolNames: string[]): boolean {
    // Tools that modify the same entity type should be sequential
    const entityGroups: Record<string, string[]> = {
      project: ['create_project', 'update_project', 'delete_project'],
      task: ['create_task', 'update_task', 'delete_task'],
      risk: ['create_risk', 'update_risk', 'delete_risk'],
    };

    for (const [, group] of Object.entries(entityGroups)) {
      const toolsInGroup = toolNames.filter((t) => group.includes(t));
      if (toolsInGroup.length > 1) {
        this.logger.debug(
          `Tools ${toolsInGroup.join(', ')} should be sequential`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Group tools by execution order (parallel vs sequential)
   */
  groupToolsForExecution(toolNames: string[]): string[][] {
    if (toolNames.length <= 1) {
      return [toolNames];
    }

    if (this.canExecuteInParallel(toolNames)) {
      return [toolNames]; // All can run in parallel
    }

    // Group by entity type for sequential execution
    const groups: string[][] = [];
    const entityGroups: Record<string, string[]> = {
      project: [
        'create_project',
        'update_project',
        'delete_project',
        'list_projects',
      ],
      task: ['create_task', 'update_task', 'delete_task', 'list_tasks'],
      risk: ['create_risk', 'update_risk', 'delete_risk', 'list_risks'],
      change: [
        'create_change',
        'update_change',
        'delete_change',
        'list_changes',
      ],
      journal: ['create_journal_entry', 'list_journal_entries'],
    };

    const processed = new Set<string>();

    // Group tools by entity
    for (const [entity, group] of Object.entries(entityGroups)) {
      const entityTools = toolNames.filter(
        (t) => group.includes(t) && !processed.has(t)
      );
      if (entityTools.length > 0) {
        groups.push(entityTools);
        entityTools.forEach((t) => processed.add(t));
      }
    }

    // Add remaining tools as a separate group
    const remaining = toolNames.filter((t) => !processed.has(t));
    if (remaining.length > 0) {
      groups.push(remaining);
    }

    return groups;
  }

  /**
   * Force refresh of tool cache
   */
  async refreshTools(): Promise<void> {
    this.logger.log('Refreshing tool cache from MCP');

    try {
      this.mcpToolsCache = await this.toolsService.listTools();
      this.logger.log(`Fetched ${this.mcpToolsCache.length} MCP tools`);

      this.cachedTools = await this.buildTools();
      this.lastFetchTime = Date.now();

      this.logger.log(`Built ${this.cachedTools.length} LangChain tools`);
    } catch (error) {
      this.logger.error(`Failed to refresh tools: ${error.message}`);
      throw error;
    }
  }

  /**
   * Invalidate cache
   */
  invalidateCache(): void {
    this.logger.log('Invalidating tool cache');
    this.cachedTools = null;
    this.mcpToolsCache = null;
    this.lastFetchTime = 0;
  }

  /**
   * Check if cache needs refresh
   */
  private shouldRefreshCache(): boolean {
    if (!this.cachedTools || !this.mcpToolsCache) {
      return true;
    }
    return Date.now() - this.lastFetchTime > this.CACHE_TTL;
  }

  /**
   * Build all LangChain tools from MCP tools
   */
  private async buildTools(): Promise<DynamicStructuredTool[]> {
    if (!this.mcpToolsCache) {
      throw new Error('MCP tools not loaded');
    }

    const tools: DynamicStructuredTool[] = [];

    for (const mcpTool of this.mcpToolsCache) {
      try {
        const tool = this.createTool(mcpTool);
        if (tool) {
          tools.push(tool);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to create tool ${mcpTool.name}: ${error.message}`
        );
      }
    }

    // Add list_tools discovery tool
    const listToolsTool = this.createListToolsTool();
    tools.unshift(listToolsTool);

    // Prioritize tools
    return this.prioritizeTools(tools);
  }

  /**
   * Create a single LangChain tool from MCP tool
   */
  private createTool(mcpTool: Tool): DynamicStructuredTool | null {
    try {
      const zodSchema = this.jsonSchemaToZod(mcpTool.inputSchema);

      return new DynamicStructuredTool({
        name: mcpTool.name,
        description: mcpTool.description || `Tool: ${mcpTool.name}`,
        schema: zodSchema,
        func: async (input: Record<string, unknown>, config?: any) => {
          // Extract context from config (passed via RunnableConfig)
          const context: ToolExecutionContext = config?.metadata || {
            userId: 'unknown',
            profileId: 'unknown',
            timestamp: new Date(),
          };

          // Auto-inject user context fields
          const enrichedInput = {
            ...input,
            userId: (input.userId as string) || context.userId,
            profileId: (input.profileId as string) || context.profileId,
            createdBy: (input.createdBy as string) || context.userId,
          };

          this.logger.log(
            `Tool ${mcpTool.name} called with:`,
            JSON.stringify(enrichedInput, null, 2)
          );

          const toolCall = {
            id: `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            type: 'function' as const,
            function: {
              name: mcpTool.name,
              arguments: JSON.stringify(enrichedInput),
            },
          };

          const result = await this.mcpExecutor.executeToolCall(
            toolCall,
            context
          );

          if (result.success) {
            return getToolResultContent(mcpTool.name, result.result);
          }

          if (
            result.error?.message.includes('required property') ||
            result.error?.message.includes('validation failed')
          ) {
            return `Error: Validation failed. Check parameters and try again. Details: ${result.error?.message}`;
          }

          return `Error: ${result.error?.message || 'Unknown error'}`;
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create tool ${mcpTool.name}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Create the list_tools discovery tool
   */
  private createListToolsTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'list_tools',
      description:
        'List all available tools with their descriptions and parameters. Shows exact parameter names, types, required/optional status, and valid enum values.',
      schema: z.object({}),
      func: async () => {
        this.logger.log('LLM called list_tools for tool discovery');

        if (!this.mcpToolsCache) {
          return 'Error: Tools not loaded';
        }

        const formatTool = (tool: Tool): string => {
          const params = tool.inputSchema?.properties
            ? Object.entries(tool.inputSchema.properties)
                .map(([name, schema]: [string, any]) => {
                  const required = tool.inputSchema.required?.includes(name)
                    ? '**[REQUIRED]**'
                    : '[optional]';
                  const enumValues = schema.enum
                    ? ` (values: ${schema.enum.join(', ')})`
                    : '';
                  return `  - ${name} (${
                    schema.type || 'any'
                  })${enumValues} ${required}: ${
                    schema.description || 'No description'
                  }`;
                })
                .join('\n')
            : '  No parameters';

          return `### ${tool.name}\n${
            tool.description || 'No description'
          }\n**Parameters:**\n${params}`;
        };

        const toolList = this.mcpToolsCache.map(formatTool).join('\n\n');
        return `Available tools:\n\n${toolList}`;
      },
    });
  }

  /**
   * Prioritize tools for better LLM performance
   */
  private prioritizeTools(
    tools: DynamicStructuredTool[]
  ): DynamicStructuredTool[] {
    const priorityOrder = [
      'list_tools',
      'list_projects',
      'query_projects',
      'create_project',
      'list_tasks',
      'create_task',
      'list_risks',
      'create_risk',
      'list_changes',
      'create_change',
      'list_journal_entries',
      'create_journal_entry',
    ];

    const sorted = [...tools].sort((a, b) => {
      const indexA = priorityOrder.indexOf(a.name);
      const indexB = priorityOrder.indexOf(b.name);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return sorted;
  }

  /**
   * Convert JSON Schema to Zod schema
   */
  private jsonSchemaToZod(schema: any): z.ZodObject<any> {
    if (!schema || !schema.properties) {
      return z.object({});
    }

    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(schema.properties)) {
      const property = prop as any;
      let zodType: z.ZodTypeAny;

      if (
        property.enum &&
        Array.isArray(property.enum) &&
        property.enum.length > 0
      ) {
        zodType = z.enum(property.enum as [string, ...string[]]);
        if (property.description) {
          zodType = zodType.describe(property.description);
        }
      } else {
        switch (property.type) {
          case 'string':
            zodType = z.string();
            break;
          case 'number':
          case 'integer':
            zodType = z.number();
            break;
          case 'boolean':
            zodType = z.boolean();
            break;
          case 'array':
            zodType = z.array(z.any());
            break;
          case 'object':
            zodType = z.record(z.any());
            break;
          default:
            zodType = z.any();
        }
        if (property.description) {
          zodType = zodType.describe(property.description);
        }
      }

      const autoInjectedFields = ['userId', 'profileId', 'createdBy'];
      const isRequired =
        schema.required &&
        schema.required.includes(key) &&
        !autoInjectedFields.includes(key);

      if (!isRequired) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }
}
