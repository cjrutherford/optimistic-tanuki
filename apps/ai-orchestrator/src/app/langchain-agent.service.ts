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
import { ModelInitializerService } from './model-initializer.service';
import { WorkflowControlService } from './workflow-control.service';
import { StreamingEventType } from './streaming-events';
import { SystemPromptBuilder } from './system-prompt-builder.service';
import { PersonaTelosDto, ProfileDto } from '@optimistic-tanuki/models';

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
    private readonly config: ConfigService,
    private readonly modelInitializer: ModelInitializerService,
    private readonly workflowControl: WorkflowControlService,
    private readonly systemPromptBuilder: SystemPromptBuilder
  ) {
    this.initializeAgentModel();
  }

  /**
   * Initialize the agent model
   */
  private initializeAgentModel(): void {
    const modelConfig = this.modelInitializer.getModelConfig('tool_calling');
    const ollama = this.config.get<{ host: string; port: number }>('ollama');
    const baseUrl =
      ollama?.host && ollama?.port
        ? `http://${ollama.host}:${ollama.port}`
        : 'http://prompt-proxy:11434';

    if (modelConfig) {
      this.llm = new ChatOllama({
        model: modelConfig.name,
        baseUrl,
        temperature: modelConfig.temperature,
      });
      this.logger.log(`Initialized agent with model: ${modelConfig.name}`);
    } else {
      this.llm = new ChatOllama({
        model: 'bjoernb/deepseek-r1-8b',
        baseUrl,
        temperature: 0.7,
      });
      this.logger.warn('Using default model for agent');
    }
  }

  /**
   * Initialize the agent for a given user/conversation.
   * This prepares LangChain tools and compiles the agent graph.
   */
  async initializeAgent(userId: string, conversationId: string): Promise<void> {
    if (this.initialized) return;
    try {
      this.logger.log(`Initializing agent (first time setup)`);
      // Build tools (context-agnostic at creation time)
      this.tools = await this.createTools();

      this.logger.log(
        `Tools passed to agent: ${this.tools.map((t) => t.name).join(', ')}`
      );

      // Create the React-style agent from LangGraph prebuilt helper
      this.agent = createReactAgent({
        llm: this.llm,
        tools: this.tools,
      });

      this.initialized = true;
      this.logger.log(`Initialized agent with ${this.tools.length} tools`);
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
  private async createTools(): Promise<DynamicStructuredTool[]> {
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
          func: async (input: Record<string, unknown>, runManager, config) => {
            const userId = config?.configurable?.userId;
            const conversationId = config?.configurable?.conversationId;

            if (!userId) {
              throw new Error('User ID not found in tool config');
            }

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
        this.logger.log(`Successfully added tool: ${mcpTool.name}`);
      } catch (error) {
        this.logger.warn(
          `Failed to convert tool ${mcpTool.name}: ${error.message}`
        );
      }
    }

    // Define list_tools as a standalone variable first
    const listToolsTool = new DynamicStructuredTool({
      name: 'list_tools',
      description:
        'List all available tools with their descriptions and parameters. Shows exact parameter names, types, required/optional status, and valid enum values.',
      schema: z.object({}),
      func: async () => {
        const toolsList = mcpTools.map((t) => {
          const params = t.inputSchema?.properties
            ? Object.entries(t.inputSchema.properties)
              .map(([name, schema]: [string, any]) => {
                const required = t.inputSchema.required?.includes(name)
                  ? '**[REQUIRED]**'
                  : '[optional]';

                // Extract type info
                const typeInfo = schema.type || 'any';

                // Extract and display enum values if present
                const enumValues = schema.enum
                  ? ` (values: ${schema.enum.join(', ')})`
                  : '';

                const description = schema.description || 'No description';

                return `  - ${name} (${typeInfo})${enumValues} ${required}: ${description}`;
              })
              .join('\n')
            : '  No parameters';

          return `### ${t.name}\n${t.description || 'No description'}\n**Parameters:**\n${params}`;
        });

        return `Available tools:\n\n${toolsList.join('\n\n')}`;
      },
    });

    // Return only prioritized tools to keep context small and focused
    const prioritizedTools = [
      'create_project',
      'list_projects',
      'query_projects',
      'create_task',
      'create_risk',
      'create_change',
      'list_tools',
    ];

    // Filter tools to only include prioritized ones
    const filteredTools = [listToolsTool, ...tools].filter((t) =>
      prioritizedTools.includes(t.name)
    );

    const sortedTools = filteredTools.sort((a, b) => {
      const indexA = prioritizedTools.indexOf(a.name);
      const indexB = prioritizedTools.indexOf(b.name);
      return indexA - indexB;
    });

    this.logger.log(
      `Created ${sortedTools.length} focused LangChain tools: ${sortedTools
        .map((t) => t.name)
        .join(', ')}`
    );
    return sortedTools as any[];
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

      // Handle enums FIRST - they have higher specificity than base types
      if (property.enum && Array.isArray(property.enum) && property.enum.length > 0) {
        zodType = z.enum(property.enum as [string, ...string[]]);
        if (property.description) {
          zodType = zodType.describe(property.description);
        }
      } else {
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
      }

      // Handle required vs optional
      // Automatically make context fields optional as they are injected
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

  /**
   * Execute agent for multi-step reasoning
   * Uses SystemPromptBuilder for consistent TELOS-driven prompts
   */
  async executeAgent(
    input: string,
    chatHistory: BaseMessage[],
    profile: ProfileDto,
    persona: PersonaTelosDto,
    conversationId?: string,
    onProgress?: (data: {
      type: 'tool_start' | 'tool_end' | 'log' | 'thinking';
      content: any;
    }) => Promise<void> | void
  ): Promise<AgentExecutionResult> {
    if (!this.initialized || !this.agent) {
      throw new Error('Agent not initialized. Call initializeAgent first.');
    }

    try {
      this.logger.log(`Executing agent for user ${profile.id}`);
      if (onProgress)
        await onProgress({
          type: 'log',
          content: `Starting agent execution for user ${profile.id}`,
        });

      // Build system prompt using the centralized builder
      // This ensures we get the "OPERATIONAL PROTOCOLS" and anti-regurgitation instructions
      const { template, variables } = await this.systemPromptBuilder.buildSystemPrompt(
        {
          personaId: persona.id,
          profileId: profile.id,
          // We could extract projectId from chatHistory/input if we had that logic here,
          // but for now we rely on the builder's defaults or basic profile context.
        },
        {
          includeTools: true, // Agent always needs tools
          includeExamples: false, // Keep it leaner for agent
          // Agent mode specific flags could be added to builder if needed
        }
      );

      const systemMessages = await template.formatMessages(variables);
      // systemMessages is an array of BaseMessage (usually 1 SystemMessage)
      const systemContent = systemMessages[0].content;

      const convIdMsg = conversationId
        ? [{ role: 'system', content: `Conversation ID: ${conversationId}` }]
        : [];

      const inputs = {
        messages: [
          { role: 'system', content: systemContent } as any,
          ...convIdMsg,
          ...chatHistory,
          { role: 'user', content: input },
        ],
      };

      // Use stream to get intermediate steps
      const stream = await this.agent.stream(inputs, {
        streamMode: 'values',
        configurable: {
          userId: profile.id,
          conversationId,
        },
        recursionLimit: 15, // Prevent infinite loops
      });

      let finalState: any;
      const toolCalls: Array<{
        tool: string;
        input: unknown;
        output: unknown;
      }> = [];

      this.logger.log('Starting agent stream loop...');
      for await (const chunk of stream) {
        this.logger.debug(
          'Agent stream chunk received'
        );
        finalState = chunk;
        const messages = chunk.messages || [];
        const lastMessage = messages[messages.length - 1];

        if (lastMessage) {
          // Check for thinking tokens in content
          if (lastMessage.content && typeof lastMessage.content === 'string') {
            const { thinking } = this.workflowControl.extractThinkingTokens(lastMessage.content);
            if (thinking.length > 0 && onProgress) {
              for (const thinkingText of thinking) {
                // We might emit duplicates if the stream yields partial updates, 
                // but 'values' mode usually yields per-node. 
                // A simple deduplication or just emitting is fine for now as the UI handles it.
                // For a more robust solution, we'd track emitted tokens.
                // Assuming per-node yield, we typically get the full message once.
                await onProgress({
                  type: StreamingEventType.THINKING as any, // Cast to avoid type issues if onProgress signature isn't updated in this file yet
                  content: { text: thinkingText, raw: lastMessage.content },
                });
              }
            }
          }

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

      const hasToolCalls = (lastMessage as any)?.tool_calls?.length > 0;

      if (!output && toolCalls.length === 0 && !hasToolCalls) {
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

      // Filter thinking tokens from final output
      const cleanedOutput = this.workflowControl.filterThinkingTokens(
        typeof output === 'string' ? output : JSON.stringify(output)
      );

      // FALLBACK: If no native tool calls, check for manual JSON tool call in the text
      // This supports models that output JSON text instead of native tool calls (e.g. DeepSeek via prompt instructions)
      if (allToolCalls.length === 0) {
        const manualToolCall = this.parseJsonToolCall(cleanedOutput);
        if (manualToolCall) {
          this.logger.log(`Detected manual JSON tool call: ${manualToolCall.name}`);

          if (onProgress) {
            await onProgress({
              type: 'tool_start',
              content: { tool: manualToolCall.name, input: manualToolCall.arguments },
            });
          }

          try {
            // Convert to OpenAI format for executor
            const openAIToolCall = {
              id: `manual_${Date.now()}`,
              type: 'function' as const,
              function: {
                name: manualToolCall.name,
                arguments: JSON.stringify(manualToolCall.arguments),
              },
            };

            const context = {
              userId: profile.id,
              profileId: profile.id,
              conversationId,
              timestamp: new Date(),
            };

            const result = await this.mcpExecutor.executeToolCall(
              openAIToolCall,
              context
            );

            // Add to tool calls list
            allToolCalls.push({
              tool: manualToolCall.name,
              input: manualToolCall.arguments,
              output: result.result || result,
            });

            if (onProgress) {
              await onProgress({
                type: 'tool_end',
                content: {
                  tool: manualToolCall.name,
                  output: result.result || result,
                },
              });
            }

            // Update output to reflect the action taken
            // We could optionally feed this back to the model, but for now just returning the result 
            // mimics the success path.
            return {
              output: `I've executed the ${manualToolCall.name} tool. Result: ${JSON.stringify(result.result)}`,
              intermediateSteps: messages.map((msg: any) => ({
                action: msg.tool_calls?.[0]?.name || 'response',
                observation: msg.content || '',
              })),
              toolCalls: allToolCalls,
            };

          } catch (err) {
            this.logger.error(`Manual tool execution failed: ${err.message}`);
            if (onProgress) {
              await onProgress({
                type: 'log',
                content: `Manual tool execution failed: ${err.message}`,
              });
            }
          }
        }
      }

      return {
        output: cleanedOutput,
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
   * Parse JSON tool call from text
   * Looks for { "name": "...", "arguments": { ... } } structure
   */
  private parseJsonToolCall(text: string): { name: string; arguments: any } | null {
    try {
      // Find JSON object
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      // Check if it has the expected structure
      if (parsed.name && (parsed.arguments || parsed.parameters)) {
        return {
          name: parsed.name,
          arguments: parsed.arguments || parsed.parameters || {},
        };
      }
      return null;
    } catch (e) {
      return null;
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