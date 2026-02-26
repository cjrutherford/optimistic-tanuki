/**
 * Shared Tool Factory
 *
 * Centralized factory for creating LangChain DynamicStructuredTool instances
 * from MCP tools. Used by both LangChainService and LangChainAgentService.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ToolsService } from './tools.service';

export const TOOL_OUTPUT_BLACKLIST = ['list_tools'];
export const TOOL_RESULT_SUMMARIES: Record<string, string> = {
  list_tools: 'Available tools retrieved',
};

export function getToolResultContent(tool: string, output: unknown): string {
  if (TOOL_OUTPUT_BLACKLIST.includes(tool)) {
    return TOOL_RESULT_SUMMARIES[tool] || 'Tool executed successfully';
  }
  return typeof output === 'string' ? output : JSON.stringify(output, null, 2);
}

export interface ToolFactoryOptions {
  userId: string;
  conversationId?: string;
  includeListTools?: boolean;
}

@Injectable()
export class ToolFactory {
  private readonly logger = new Logger(ToolFactory.name);
  private cachedTools: DynamicStructuredTool[] | null = null;

  constructor(
    private readonly toolsService: ToolsService,
    private readonly mcpExecutor: MCPToolExecutor
  ) {}

  /**
   * Create all tools from MCP registry
   */
  async createTools(
    options: ToolFactoryOptions
  ): Promise<DynamicStructuredTool[]> {
    let mcpTools: Tool[] = [];
    try {
      mcpTools = await this.toolsService.listTools();
      this.logger.log(`Fetched ${mcpTools.length} MCP tools`);
    } catch (error) {
      this.logger.error(
        `Failed to fetch MCP tools: ${error.message}. Continuing with empty tools list.`
      );
    }

    const tools: DynamicStructuredTool[] = [];

    for (const mcpTool of mcpTools) {
      try {
        const tool = this.createMCPTool(mcpTool, options);
        if (tool) {
          tools.push(tool);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to convert tool ${mcpTool.name}: ${error.message}`
        );
      }
    }

    const listToolsTool = this.createListToolsTool(mcpTools);
    const prioritizedTools = this.prioritizeTools([listToolsTool, ...tools]);

    this.logger.log(
      `Created ${prioritizedTools.length} tools for user ${options.userId}`
    );

    return prioritizedTools as DynamicStructuredTool[];
  }

  /**
   * Create a single LangChain tool from MCP tool
   */
  createMCPTool(
    mcpTool: Tool,
    options: ToolFactoryOptions
  ): DynamicStructuredTool | null {
    try {
      const zodSchema = this.jsonSchemaToZod(mcpTool.inputSchema);

      return new DynamicStructuredTool({
        name: mcpTool.name,
        description: mcpTool.description || `Tool: ${mcpTool.name}`,
        schema: zodSchema,
        func: async (input: Record<string, unknown>) => {
          const enrichedInput = {
            ...input,
            userId: (input.userId as string) || options.userId,
            profileId: (input.profileId as string) || options.userId,
            createdBy: (input.createdBy as string) || options.userId,
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

          const context = {
            userId: options.userId,
            profileId: options.userId,
            conversationId: options.conversationId,
            timestamp: new Date(),
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
      }) as DynamicStructuredTool;
    } catch (error) {
      this.logger.error(
        `Failed to create tool ${mcpTool.name}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Create the list_tools discovery tool with minimal output
   */
  createListToolsTool(mcpTools: Tool[]): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'list_tools',
      description:
        'List all available tools with their descriptions and parameters. Shows exact parameter names, types, required/optional status, and valid enum values.',
      schema: z.object({}),
      func: async () => {
        this.logger.log('LLM called list_tools for tool discovery');

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

        const toolList = mcpTools.map(formatTool).join('\n\n');

        return `Available tools:\n\n${toolList}`;
      },
    }) as DynamicStructuredTool;
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
