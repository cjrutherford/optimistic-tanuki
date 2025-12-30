/**
 * LangChain Agent Service
 *
 * Uses LangChain agents for streamlined tool execution
 * Provides automatic tool selection and multi-step reasoning
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ToolsService } from './tools.service';
import { z } from 'zod';

export interface AgentExecutionResult {
  output: string;
  intermediateSteps: Array<{
    action: string;
    observation: string;
  }>;
  toolCalls: Array<{
    tool: string;
    input: unknown;
    output: unknown;
  }>;
}

@Injectable()
export class LangChainAgentService {
  private readonly logger = new Logger(LangChainAgentService.name);
  private llm: ChatOllama;
  private initialized = false;
  private tools: DynamicStructuredTool[] = [];
  private agent: any = null; // CompiledStateGraph from createReactAgent

  constructor(
    private readonly toolsService: ToolsService,
    private readonly mcpExecutor: MCPToolExecutor,
    private readonly config: ConfigService
  ) {
    const ollama = this.config.get<{ host: string; port: number }>('ollama');
    this.llm = new ChatOllama({
      model: 'qwen3',
      baseUrl:
        ollama.host && ollama.port
          ? `http://${ollama.host}:${ollama.port}`
          : 'http://prompt-proxy:11434',
      temperature: 0.7,
    });
  }

  /**
   * Create agent prompt template
   */
  private createAgentPrompt(): ChatPromptTemplate {
    const systemPrompt = `You are an AI assistant helping users manage projects, tasks, risks, and more.

# YOUR CAPABILITIES
You have access to tools that allow you to:
- Query and create projects
- Query, create, and update tasks
- Create risks and change requests
- Manage journal entries
- Discover available tools

# OPERATIONAL RULES
1. TOOL DISCOVERY: Call 'list_tools' when uncertain about available actions
2. ID VALIDATION: NEVER fabricate UUIDs - always query first to get real IDs
3. SEQUENTIAL EXECUTION: Call ONE tool at a time, wait for result before next tool
`;

    return ChatPromptTemplate.fromMessages([
      { role: 'system', content: systemPrompt } as any,
    ]);
  }
  /**
   * Initialize the agent for a given user/conversation.
   * This prepares LangChain tools and compiles the agent graph.
   */
  async initializeAgent(userId: string, conversationId: string): Promise<void> {
    if (this.initialized) return;
    try {
      this.logger.log(`Initializing agent for user ${userId}`);
      // Build tools for this user/context
      this.tools = await this.createTools(userId, conversationId);

      // Create the React-style agent from LangGraph prebuilt helper
      this.agent = createReactAgent({
        llm: this.llm,
        tools: this.tools,
      });

      this.initialized = true;
      this.logger.log(
        `Initialized agent with ${this.tools.length} tools for user ${userId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize agent: ${error?.message || error}`
      );
      throw error;
    }
  }

  /**
   * Create LangChain tools from MCP tools
   */
  private async createTools(
    userId: string,
    conversationId: string
  ): Promise<DynamicStructuredTool[]> {
    const mcpTools = await this.toolsService.listTools();
    const tools: DynamicStructuredTool[] = [];

    for (const mcpTool of mcpTools) {
      try {
        // Convert JSON Schema to Zod schema
        const zodSchema = this.jsonSchemaToZod(mcpTool.inputSchema);

        // Create LangChain tool
        const tool = new DynamicStructuredTool({
          name: mcpTool.name,
          description: mcpTool.description || `Tool: ${mcpTool.name}`,
          schema: zodSchema,
          func: async (input: Record<string, unknown>) => {
            // Inject userId/profileId into parameters
            // Ensure profileId is mapped from userId if not present
            const enrichedInput = {
              ...input,
              userId: (input.userId as string) || userId,
              profileId:
                (input.profileId as string) ||
                (input.userId as string) ||
                userId,
              createdBy: (input.createdBy as string) || userId,
            };

            this.logger.log(
              `Agent calling tool: ${mcpTool.name} with params:`,
              JSON.stringify(enrichedInput, null, 2)
            );

            try {
              // Create ToolCall object matching the expected format
              const toolCall: any = {
                id: `call_${Date.now()}_${Math.random()
                  .toString(36)
                  .substring(7)}`,
                type: 'function' as const,
                function: {
                  name: mcpTool.name,
                  arguments: JSON.stringify(enrichedInput),
                },
              };

              const context: any = {
                userId,
                profileId: userId,
                conversationId,
                timestamp: new Date(),
              };

              const result = await this.mcpExecutor.executeToolCall(
                toolCall,
                context
              );

              return JSON.stringify(result.result || result, null, 2);
            } catch (error) {
              this.logger.error(
                `Tool ${mcpTool.name} execution failed: ${error.message}`
              );

              // Return a structured error message to the agent so it can retry
              if (
                error.message.includes('required property') ||
                error.message.includes('validation failed')
              ) {
                return `Error: Validation failed or missing required parameter. Please check the tool definition using 'list_tools' and try again with the correct parameters. Details: ${error.message}`;
              }

              return `Error executing ${mcpTool.name}: ${error.message}`;
            }
          },
        });

        tools.push(tool);
      } catch (error) {
        this.logger.warn(
          `Failed to convert tool ${mcpTool.name}: ${error.message}`
        );
      }
    }

    // Add list_tools for dynamic discovery
    tools.push(
      new DynamicStructuredTool({
        name: 'list_tools',
        description:
          'List all available tools with their descriptions and parameters',
        schema: z.object({}),
        func: async () => {
          const toolsList = mcpTools.map((t) => {
            const params = t.inputSchema?.properties
              ? Object.entries(t.inputSchema.properties)
                  .map(([name, schema]: [string, any]) => {
                    const required = t.inputSchema.required?.includes(name)
                      ? '(required)'
                      : '(optional)';
                    return `  - ${name} ${required}: ${
                      schema.description || schema.type
                    }`;
                  })
                  .join('\n')
              : '  No parameters';

            return `${t.name}: ${t.description || 'No description'}\n${params}`;
          });

          return `Available tools:\n\n${toolsList.join('\n\n')}`;
        },
      })
    );

    this.logger.log(
      `Created ${tools.length} LangChain tools (including list_tools)`
    );
    return tools;
  }

  /**
   * Convert JSON Schema to Zod schema (simplified)
   */
  private jsonSchemaToZod(schema: any): z.ZodObject<any> {
    if (!schema || !schema.properties) {
      return z.object({});
    }

    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(schema.properties)) {
      const property = prop as any;
      let zodType: z.ZodTypeAny;

      switch (property.type) {
        case 'string':
          zodType = z.string();
          if (property.description) {
            zodType = zodType.describe(property.description);
          }
          break;
        case 'number':
        case 'integer':
          zodType = z.number();
          if (property.description) {
            zodType = zodType.describe(property.description);
          }
          break;
        case 'boolean':
          zodType = z.boolean();
          if (property.description) {
            zodType = zodType.describe(property.description);
          }
          break;
        case 'array':
          zodType = z.array(z.any());
          if (property.description) {
            zodType = zodType.describe(property.description);
          }
          break;
        case 'object':
          zodType = z.record(z.any());
          if (property.description) {
            zodType = zodType.describe(property.description);
          }
          break;
        default:
          zodType = z.any();
      }

      // Handle required vs optional
      if (!schema.required || !schema.required.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  /**
   * Execute agent for multi-step reasoning
   */
  async executeAgent(
    input: string,
    chatHistory: BaseMessage[],
    userId: string,
    conversationSummary?: string,
    conversationId?: string,
    onProgress?: (data: {
      type: 'tool_start' | 'tool_end' | 'log';
      content: any;
    }) => Promise<void> | void
  ): Promise<AgentExecutionResult> {
    if (!this.initialized || !this.agent) {
      throw new Error('Agent not initialized. Call initializeAgent first.');
    }

    try {
      this.logger.log(`Executing agent for user ${userId}`);
      if (onProgress)
        await onProgress({
          type: 'log',
          content: `Starting agent execution for user ${userId}`,
        });

      // Build messages including LangGraph-provided context so agent sees the same state.
      const systemPrompt = this.createAgentPrompt();
      const summaryMsg = conversationSummary
        ? [
            {
              role: 'system',
              content: `Conversation Summary: ${conversationSummary}`,
            },
          ]
        : [];
      const convIdMsg = conversationId
        ? [{ role: 'system', content: `Conversation ID: ${conversationId}` }]
        : [];

      const inputs = {
        messages: [
          { role: 'system', content: systemPrompt } as any,
          ...summaryMsg,
          ...convIdMsg,
          ...chatHistory,
          { role: 'user', content: input },
        ],
      };

      // Use stream to get intermediate steps
      const stream = await this.agent.stream(inputs, {
        streamMode: 'values',
      });

      let finalState: any;
      const toolCalls: Array<{
        tool: string;
        input: unknown;
        output: unknown;
      }> = [];

      for await (const chunk of stream) {
        this.logger.debug(
          'Agent stream chunk:',
          JSON.stringify(chunk, null, 2)
        );
        finalState = chunk;
        const messages = chunk.messages || [];
        const lastMessage = messages[messages.length - 1];

        if (lastMessage) {
          // Check for tool calls
          if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            for (const toolCall of lastMessage.tool_calls) {
              this.logger.log(`Agent detected tool call: ${toolCall.name}`);
              if (onProgress) {
                await onProgress({
                  type: 'tool_start',
                  content: { tool: toolCall.name, input: toolCall.args },
                });
              }
            }
          }

          // Check for tool outputs (ToolMessage)
          if (lastMessage._getType() === 'tool') {
            this.logger.log(
              `Agent received tool output for: ${lastMessage.name}`
            );
            // We might need to match this with the previous tool call, but for now just report it
            if (onProgress) {
              await onProgress({
                type: 'tool_end',
                content: {
                  tool: lastMessage.name,
                  output: lastMessage.content,
                },
              });
            }

            // Store for result
            toolCalls.push({
              tool: lastMessage.name || 'unknown',
              input: {}, // We'd need to look back to find input, skipping for now or we can track it
              output: lastMessage.content,
            });
          }
        }
      }

      // Extract final response
      const messages = finalState?.messages || [];
      const lastMessage = messages[messages.length - 1];
      const output = lastMessage?.content || '';

      if (!output && toolCalls.length === 0) {
        const msg =
          'Agent execution completed but produced no output and no tool calls. The model may have failed to respond or encountered an internal error.';
        this.logger.warn(msg);
        if (onProgress) await onProgress({ type: 'log', content: msg });
        throw new Error(msg);
      }

      // Re-scan messages for complete tool call history to ensure we have everything
      // (The stream loop above catches them in real-time, this ensures the final result object is complete)
      const allToolCalls: Array<{
        tool: string;
        input: unknown;
        output: unknown;
      }> = [];

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const toolCall of msg.tool_calls) {
            const toolOutputMsg = messages.find(
              (m: any) => m.tool_call_id === toolCall.id
            );

            allToolCalls.push({
              tool: toolCall.name || 'unknown',
              input: toolCall.args || {},
              output: toolOutputMsg ? toolOutputMsg.content : '',
            });
          }
        }
      }

      return {
        output: typeof output === 'string' ? output : JSON.stringify(output),
        intermediateSteps: messages.map((msg: any) => ({
          action: msg.tool_calls?.[0]?.name || 'response',
          observation: msg.content || '',
        })),
        toolCalls: allToolCalls,
      };
    } catch (error) {
      this.logger.error(`Agent execution failed: ${error.message}`);
      if (onProgress)
        onProgress({
          type: 'log',
          content: `Agent execution failed: ${error.message}`,
        });
      throw error;
    }
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset agent (for new conversation or context change)
   */
  reset(): void {
    this.agent = null;
    this.initialized = false;
    this.logger.log('Agent reset');
  }
}
