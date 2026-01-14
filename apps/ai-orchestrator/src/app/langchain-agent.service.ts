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
    private readonly workflowControl: WorkflowControlService
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
   * Create agent prompt template
   */
  private createAgentPrompt(): string {
    return `You are an AI assistant helping users manage projects, tasks, risks, and more.

IMPORTANT: You are the assistant. The user is the person making requests. Do not respond as if you are the user.

# CORE OPERATING PROCEDURE (THINK-ACT LOOP)
1. **THINK**: Analyze the user's request. What information is missing? Do you need an ID?
2. **ACT**: If you need data, call a 'list_*' or 'query_*' tool. If you have data, call a 'create_*' or 'update_*' tool.
3. **OBSERVE**: Wait for the tool result.
4. **REFINE**: If the tool failed, analyze the error. Did you use the wrong ID? Wrong parameters? Retry with corrected values.

# YOUR CAPABILITIES
You have access to the following core tools (and more via 'list_tools'):
- **create_project**: Create a new project. Required: name, userId.
- **list_projects**: List all projects for a user.
- **query_projects**: Find a project by name.
- **create_task**: Add a task to a project.
- **list_tasks**: List tasks in a project.
- **create_risk**: Add a risk to a project.
- **create_change**: Create a change request.
- **list_tools**: detailed list of all available tools.

# OPERATIONAL RULES
1. **NO HALLUCINATIONS**: NEVER invent IDs. If you need a 'projectId', 'taskId', or any other ID, you MUST find it using a list or query tool first.
   - Example: To add a task to "Project Omega", first call 'query_projects' with name="Project Omega" to get its ID.
2. **TOOL DISCOVERY**: Call 'list_tools' when uncertain about available actions or parameter names.
3. **SEQUENTIAL EXECUTION**: Call ONE tool at a time. Wait for the result.
4. **CONTEXT INJECTION**: Do NOT provide 'userId', 'profileId', or 'createdBy' unless you are assigning to a DIFFERENT user. The system automatically injects the current user's ID.
5. **TOOL SELECTION**:
   - Creating a Project? Use 'create_project'.
   - Creating a Change Request? Use 'create_change'.
   - Adding a Task? Use 'create_task'.
   - Adding a Risk? Use 'create_risk'.
   - DO NOT confuse these. A "change" is a formal request, not just "changing something".

6. **ENUM VALUES**: Always use UPPERCASE for status/priority values.
   - Task Status: 'TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED'
   - Task Priority: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
   - Project Status: 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'
   - Risk Impact: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
   - Risk Likelihood: 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'IMMINENT'
   - Risk Status: 'OPEN', 'IN_PROGRESS', 'CLOSED'
   - Change Status: 'PROPOSED', 'APPROVED', 'IN_PROGRESS', 'COMPLETE', 'DISCARDED'

7. **TOOL SPECIFIC INSTRUCTIONS**:
   - 'query_projects': Use the 'name' parameter for the search term. Do NOT use 'query'.
   - 'create_risk': Ensure 'status' is one of 'OPEN', 'IN_PROGRESS', 'CLOSED'. Default to 'OPEN' if unsure.
   - 'create_task': Use this for adding work items, todos, or action items.
   - 'create_change': Use this ONLY for formal change requests or modifications to the project scope. Do NOT use for regular tasks.
   - 'list_projects': may sometimes return an empty list. if this happens, try again to ensure we don't have database consistency issues.(sometimes returns results inconsistently after new inserts.)

# ERROR HANDLING
- If a tool fails due to "Invalid parameters", check the enum values and required fields.
- If a tool fails due to "Missing ID" or "Invalid UUID", YOU LIKELY USED A FAKE ID. Stop. Call a list/query tool to find the real ID.
- if a tool fails due to ambiguity in connected id's please try to lookup the correct id using the appropriate list or query tool before retrying.

# OUTPUT FORMAT
For each function call, return a json object with function name and arguments within <function-call> and </function-call> XML tags.
Example:
<function-call>{"name": "create_project", "arguments": {"name": "My Project", "description": "Desc"}}</function-call>
`;
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
        configurable: {
          userId,
          conversationId,
        },
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

<<<<<<< HEAD
      // FALLBACK: Check for XML or raw JSON function calls if no native tool calls were found
      // This handles models like DeepSeek-R1 that prefer text output over native tool calling
      if (allToolCalls.length === 0 && typeof output === 'string') {
        let functionCall = null;
        let toolName = '';
        let toolArgs = null;

        // Strip <think> blocks first to avoid parsing reasoning artifacts
        const cleanOutput = output
          .replace(/<think>[\s\S]*?<\/think>/g, '')
          .trim();

        // Strategy 1: Look for <function-call> tags
        if (cleanOutput.includes('<function-call>')) {
          this.logger.warn(
            'No native tool calls found, but <function-call> tag detected. Attempting XML parsing.'
          );
          try {
            const regex = /<function-call>(.*?)<\/function-call>/s;
            const match = cleanOutput.match(regex);
            if (match && match[1]) {
              const jsonStr = match[1].trim();
              functionCall = JSON.parse(jsonStr);
            }
          } catch (e) {
            this.logger.error(
              `Failed to parse XML function call: ${e.message}`
            );
          }
        }
        // Strategy 2: Look for raw JSON { "name": "...", "arguments": ... }
        // Often appears after </think> tag
        else if (
          (cleanOutput.includes('"name"') &&
            cleanOutput.includes('"arguments"')) ||
          (cleanOutput.includes("'name'") &&
            cleanOutput.includes("'arguments'"))
        ) {
          this.logger.warn(
            'No native tool calls found, checking for raw JSON pattern.'
          );
          try {
            // Try to find the JSON object
            const regex = /\{[\s\S]*"name"[\s\S]*:[\s\S]*"arguments"[\s\S]*\}/s;
            const match = cleanOutput.match(regex);
            if (match) {
              functionCall = JSON.parse(match[0]);
            }
          } catch (e) {
            this.logger.debug(
              `Raw JSON parsing failed (this is expected for normal text): ${e.message}`
            );
          }
        }

        if (functionCall && functionCall.name && functionCall.arguments) {
          toolName = functionCall.name;
          let parsedArgs =
            typeof functionCall.arguments === 'string'
              ? JSON.parse(functionCall.arguments)
              : functionCall.arguments;

          // Filter out null values to avoid Zod validation errors (optional fields should be undefined, not null)
          if (parsedArgs && typeof parsedArgs === 'object') {
            parsedArgs = Object.fromEntries(
              Object.entries(parsedArgs).filter(([_, v]) => v != null)
            );
          }
          toolArgs = parsedArgs;

          this.logger.log(
            `Manually executing tool from fallback parsing: ${toolName}`,
            toolArgs
          );

          const tool = this.tools.find((t) => t.name === toolName);
          if (tool) {
            try {
              // Execute the tool manually
              const result = await tool.call(toolArgs, {
                configurable: {
                  userId,
                  conversationId,
                },
              });

              this.logger.log(`Manual tool execution result:`, result);

              // Add to toolCalls
              allToolCalls.push({
                tool: toolName,
                input: toolArgs,
                output: result,
              });

              // Report progress
              if (onProgress) {
                await onProgress({
                  type: 'tool_start',
                  content: { tool: toolName, input: toolArgs },
                });
                await onProgress({
                  type: 'tool_end',
                  content: { tool: toolName, output: result },
                });
              }
            } catch (err) {
              this.logger.error(
                `Manual tool execution failed: ${err.message}`
              );
            }
          } else {
            this.logger.warn(
              `Tool ${toolName} found in fallback but not available in agent tools.`
            );
          }
        }
      }
=======
      // Filter thinking tokens from final output
      const cleanedOutput = this.workflowControl.filterThinkingTokens(
        typeof output === 'string' ? output : JSON.stringify(output)
      );
>>>>>>> 55adcd5 (Add model configuration and workflow control services)

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
