/**
 * LangChain Agent Service
 * 
 * Uses LangChain agents for streamlined tool execution
 * Provides automatic tool selection and multi-step reasoning
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
// Agent imports - currently not used, direct tool execution via LangChain instead
// import { AgentExecutor } from '@langchain/langgraph/prebuilt';
// import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { BaseMessage } from '@langchain/core/messages';
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

  constructor(
    private readonly toolsService: ToolsService,
    private readonly mcpExecutor: MCPToolExecutor,
    private readonly config: ConfigService
  ) {
    const ollama = this.config.get<{ host: string; port: number }>('ollama');
    this.llm = new ChatOllama({
      model: 'qwen3-coder',
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
    return ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an AI assistant helping users manage projects, tasks, risks, and more.

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
4. MULTI-STEP WORKFLOWS: For tasks/risks/changes, query projects first to get projectId
5. USER CONTEXT: Always use the provided userId/profileId from context

# RESPONSE STYLE
- Be concise and helpful
- Explain what you're doing before calling tools
- Report results clearly after tool execution
- If a tool fails, explain why and suggest alternatives

Current user: {userId}`,
      ],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);
  }

  /**
   * Initialize the agent executor with tools
   */
  async initializeAgent(
    userId: string,
    conversationId: string
  ): Promise<void> {
    try {
      // Get MCP tools and convert to LangChain format
      const tools = await this.createTools(userId, conversationId);

      // Create agent prompt
      const prompt = this.createAgentPrompt();

      // Create tool-calling agent
      const agent = await createToolCallingAgent({
        llm: this.llm,
        tools,
        prompt,
      });

      // Create agent executor
      this.agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: true, // Enable logging
        maxIterations: 10, // Prevent infinite loops
        returnIntermediateSteps: true, // Capture tool call details
      });

      this.logger.log(
        `Initialized agent with ${tools.length} tools for user ${userId}`
      );
    } catch (error) {
      this.logger.error(`Failed to initialize agent: ${error.message}`);
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
            const enrichedInput = {
              ...input,
              userId: input.userId || userId,
              profileId: input.profileId || userId,
              createdBy: input.createdBy || userId,
            };

            this.logger.log(
              `Agent calling tool: ${mcpTool.name} with params:`,
              JSON.stringify(enrichedInput, null, 2)
            );

            try {
              // Create ToolCall object matching the expected format
              const toolCall: any = {
                id: `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                type: 'function' as const,
                function: {
                  name: mcpTool.name,
                  arguments: JSON.stringify(enrichedInput),
                },
              };

              const context: any = {
                userId,
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
                    return `  - ${name} ${required}: ${schema.description || schema.type}`;
                  })
                  .join('\n')
              : '  No parameters';

            return `${t.name}: ${t.description || 'No description'}\n${params}`;
          });

          return `Available tools:\n\n${toolsList.join('\n\n')}`;
        },
      })
    );

    this.logger.log(`Created ${tools.length} LangChain tools (including list_tools)`);
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
   * Execute the agent with a user message
   */
  async executeAgent(
    input: string,
    chatHistory: BaseMessage[],
    userId: string
  ): Promise<AgentExecutionResult> {
    if (!this.agentExecutor) {
      throw new Error('Agent not initialized. Call initializeAgent first.');
    }

    try {
      this.logger.log(`Executing agent for user ${userId}`);
      
      const result = await this.agentExecutor.invoke({
        input,
        chat_history: chatHistory,
        userId,
      });

      // Extract tool calls from intermediate steps
      const toolCalls = (result.intermediateSteps || []).map((step: any) => ({
        tool: step.action?.tool || 'unknown',
        input: step.action?.toolInput || {},
        output: step.observation || '',
      }));

      return {
        output: result.output || '',
        intermediateSteps: (result.intermediateSteps || []).map((step: any) => ({
          action: step.action?.tool || 'unknown',
          observation: step.observation || '',
        })),
        toolCalls,
      };
    } catch (error) {
      this.logger.error(`Agent execution failed: ${error.message}`);
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
    this.agentExecutor = null;
    this.logger.log('Agent reset');
  }
}
