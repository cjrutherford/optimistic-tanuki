/**
 * LangChain Service for AI Orchestration
 *
 * Uses centralized prompt templates and emits thinking tokens
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  ChatMessage,
  PersonaTelosDto,
  ProfileDto,
  ToolResult,
} from '@optimistic-tanuki/models';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ToolsService } from './tools.service';
import { ConfigService } from '@nestjs/config';
import { ModelInitializerService } from './model-initializer.service';
import { WorkflowControlService } from './workflow-control.service';
import { SystemPromptBuilder } from './system-prompt-builder.service';
import {
  StreamingEvent,
  StreamingEventType,
} from './streaming-events';

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);
  private conversationalLLM: ChatOllama;
  private toolCallingLLM: ChatOllama;

  constructor(
    private readonly toolsService: ToolsService,
    private readonly mcpExecutor: MCPToolExecutor,
    private readonly config: ConfigService,
    private readonly modelInitializer: ModelInitializerService,
    private readonly workflowControl: WorkflowControlService,
    private readonly systemPromptBuilder: SystemPromptBuilder
  ) {
    this.initializeModels();
  }

  /**
   * Initialize models based on configuration
   */
  private initializeModels(): void {
    const ollama = this.config.get<{ host: string; port: number }>('ollama');
    const baseUrl =
      ollama?.host && ollama?.port
        ? `http://${ollama.host}:${ollama.port}`
        : 'http://prompt-proxy:11434';

    // Initialize conversational model
    const conversationalConfig =
      this.modelInitializer.getModelConfig('conversational');
    if (conversationalConfig) {
      this.conversationalLLM = new ChatOllama({
        model: conversationalConfig.name,
        baseUrl,
        temperature: conversationalConfig.temperature,
      });
      this.logger.log(
        `Initialized conversational model: ${conversationalConfig.name}`
      );
    } else {
      // Fallback to default
      this.conversationalLLM = new ChatOllama({
        model: 'bjoernb/deepseek-r1-8b',
        baseUrl,
        temperature: 0.7,
      });
      this.logger.warn('Using default conversational model');
    }

    // Initialize tool calling model
    const toolCallingConfig =
      this.modelInitializer.getModelConfig('tool_calling');
    if (toolCallingConfig) {
      this.toolCallingLLM = new ChatOllama({
        model: toolCallingConfig.name,
        baseUrl,
        temperature: toolCallingConfig.temperature,
      });
      this.logger.log(
        `Initialized tool calling model: ${toolCallingConfig.name}`
      );
    } else {
      // Fallback to same as conversational
      this.toolCallingLLM = this.conversationalLLM;
      this.logger.warn('Using conversational model for tool calling');
    }
  }

  /**
   * Get available MCP resources for context building
   */
  private async getAvailableResources(): Promise<string> {
    try {
      const resources = await this.toolsService.listResources();
      if (!resources || resources.length === 0) {
        return 'No additional resources available.';
      }

      const resourceList = resources
        .map((r) => `- ${r.uri}: ${r.description || r.name}`)
        .join('\n');

      return `Available MCP Resources:\n${resourceList}`;
    } catch (error) {
      this.logger.warn('Failed to fetch MCP resources:', error);
      return 'Resources unavailable at this time.';
    }
  }

  /**
   * Get project context if projectId is mentioned in conversation
   */
  private async enrichWithProjectContext(
    conversationHistory: ChatMessage[],
    userMessage: string
  ): Promise<string> {
    try {
      // Check if conversation mentions a projectId
      const allText =
        conversationHistory.map((m) => m.content).join(' ') + ' ' + userMessage;
      const projectIdMatch =
        allText.match(/project[:\s]+([a-f0-9-]{36})/i) ||
        allText.match(/projectId[:\s"']+([a-f0-9-]{36})/i);

      if (projectIdMatch && projectIdMatch[1]) {
        const projectId = projectIdMatch[1];
        this.logger.log(`Detected projectId ${projectId}, fetching context...`);

        const context = await this.toolsService.getResource(
          `project://${projectId}/context`
        );
        if (
          context &&
          Array.isArray(context._meta?.contents) &&
          context._meta.contents.length > 0
        ) {
          const content = context._meta.contents[0];
          if (content.text) {
            return `\n\n# PROJECT CONTEXT\n${content.text}`;
          }
        }
      }
    } catch (error) {
      this.logger.debug(
        'No project context enrichment needed or error:',
        error
      );
    }

    return '';
  }

  private async createTools(
    userId: string,
    conversationId: string
  ): Promise<any[]> {
    const mcpTools = await this.toolsService.listTools();

    // Create MCP tools with smart parameter enrichment
    const tools = mcpTools.map((tool) => {
      const schema = this.convertToZodSchema(tool.inputSchema);
      return new DynamicStructuredTool({
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        schema,
        func: async (input: any) => {
          // Smart parameter enrichment based on tool requirements
          const enrichedInput = { ...input };

          // Auto-inject userId if not provided and tool expects it
          if (!enrichedInput.userId && tool.inputSchema?.properties?.userId) {
            enrichedInput.userId = userId;
          }

          // Auto-inject createdBy if not provided and tool expects it
          if (
            !enrichedInput.createdBy &&
            tool.inputSchema?.properties?.createdBy
          ) {
            enrichedInput.createdBy = userId;
          }

          // Auto-inject owner if not provided and tool expects it
          if (!enrichedInput.owner && tool.inputSchema?.properties?.owner) {
            enrichedInput.owner = userId;
          }

          // Always include profileId for context (backwards compatibility)
          enrichedInput.profileId = userId;

          this.logger.debug(
            `Executing ${tool.name} with enriched parameters:`,
            Object.keys(enrichedInput)
          );

          const toolCall = {
            id: `lc_${Date.now()}`,
            type: 'function' as const,
            function: {
              name: tool.name,
              arguments: JSON.stringify(enrichedInput),
            },
          };
          const result: ToolResult = await this.mcpExecutor.executeToolCall(
            toolCall,
            { userId, profileId: userId, conversationId }
          );
          if (result.success) {
            return typeof result.result === 'string'
              ? result.result
              : JSON.stringify(result.result);
          }
          throw new Error(result.error?.message || 'Tool failed');
        },
      }) as any;
    });

    // Add list_tools as a LangChain tool so LLM can discover available tools
    const listToolsTool = new DynamicStructuredTool({
      name: 'list_tools',
      description:
        'List all available tools with their descriptions and parameters. Call this when you need to discover what actions you can perform.',
      schema: z.object({}), // No parameters needed
      func: async () => {
        this.logger.log('LLM called list_tools to discover available actions');

        // Group tools by category for better organization
        const projectTools: any[] = [];
        const taskTools: any[] = [];
        const riskTools: any[] = [];
        const changeTools: any[] = [];
        const otherTools: any[] = [];

        mcpTools.forEach((tool) => {
          if (tool.name.includes('project')) projectTools.push(tool);
          else if (tool.name.includes('task')) taskTools.push(tool);
          else if (tool.name.includes('risk')) riskTools.push(tool);
          else if (tool.name.includes('change')) changeTools.push(tool);
          else otherTools.push(tool);
        });

        const formatToolCategory = (tools: any[], category: string) => {
          if (tools.length === 0) return '';
          const formatted = tools
            .map((tool) => {
              const params = tool.inputSchema?.properties || {};
              const required = tool.inputSchema?.required || [];

              const paramList = Object.entries(params)
                .map(([name, schema]: [string, any]) => {
                  const isRequired = required.includes(name);
                  const typeInfo = schema.type || 'any';
                  const description = schema.description || '';
                  const enumValues = schema.enum
                    ? ` (values: ${schema.enum.join(', ')})`
                    : '';
                  return `  - ${name} (${typeInfo})${enumValues}${
                    isRequired ? ' **[REQUIRED]**' : ' [optional]'
                  }: ${description}`;
                })
                .join('\n');

              return `### ${tool.name}
${tool.description || 'No description'}
**Parameters:**
${paramList || '  (none)'}`;
            })
            .join('\n\n');
          return `## ${category}\n\n${formatted}`;
        };

        const sections = [
          formatToolCategory(projectTools, 'PROJECT MANAGEMENT'),
          formatToolCategory(taskTools, 'TASK MANAGEMENT'),
          formatToolCategory(riskTools, 'RISK MANAGEMENT'),
          formatToolCategory(changeTools, 'CHANGE MANAGEMENT'),
          formatToolCategory(otherTools, 'OTHER TOOLS'),
        ].filter(Boolean);

        return `# AVAILABLE TOOLS

${sections.join('\n\n')}

## CRITICAL REMINDERS
- **userId/createdBy**: Auto-injected as current user (${userId}) if not provided
- **projectId/taskId/riskId**: MUST be obtained from list/query calls - NEVER fabricate
- **status/priority**: Use EXACT enum values shown above
- **Parameter names**: Use EXACTLY as shown - no variations allowed

Always verify parameter names match tool schemas before calling!`;
      },
    }) as any;

    // Return all tools including list_tools
    return [listToolsTool, ...tools] as any[];
  }

  private convertToZodSchema(jsonSchema: any): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};
    if (jsonSchema.properties) {
      for (const [key, prop] of Object.entries(
        jsonSchema.properties as Record<string, any>
      )) {
        let zodType: z.ZodTypeAny = z.any();
        if (prop.type === 'string') zodType = z.string();
        else if (prop.type === 'number' || prop.type === 'integer')
          zodType = z.number();
        else if (prop.type === 'boolean') zodType = z.boolean();
        else if (prop.type === 'array') zodType = z.array(z.any());
        else if (prop.type === 'object') zodType = z.object({}).passthrough();

        if (prop.description) zodType = zodType.describe(prop.description);
        if (!jsonSchema.required || !jsonSchema.required.includes(key))
          zodType = zodType.optional();
        shape[key] = zodType;
      }
    }
    return z.object(shape);
  }

  private convertChatHistory(messages: ChatMessage[]): BaseMessage[] {
    return messages.map((msg) => {
      const isUser =
        msg.role === 'user' ||
        (msg.type === 'chat' && msg.senderId !== msg.recipientId?.[0]);
      if (isUser) return new HumanMessage(msg.content);
      if (msg.role === 'assistant') return new AIMessage(msg.content);
      return new SystemMessage(msg.content);
    });
  }

  async executeConversation(
    persona: PersonaTelosDto,
    profile: ProfileDto,
    conversationHistory: ChatMessage[],
    userMessage: string,
    conversationSummary: string,
    conversationId: string,
    onStreamEvent?: (event: StreamingEvent) => void | Promise<void>
  ): Promise<{
    response: string;
    intermediateSteps: any[];
    toolCalls?: Array<{ tool: string; input: unknown; output: unknown }>;
  }> {
    // Enrich with project context if available
    const projectContext = await this.enrichWithProjectContext(
      conversationHistory,
      userMessage
    );

    // Use SystemPromptBuilder for TELOS-driven system prompts
    const { template, variables } = await this.systemPromptBuilder.buildSystemPrompt(
      {
        personaId: persona.id,
        profileId: profile.id,
        conversationSummary: conversationSummary,
        projectContext: projectContext || '',
      },
      {
        includeTools: true,
        includeExamples: false,
        includeProjectContext: !!projectContext,
      }
    );
    
    const systemMessages = await template.formatMessages(variables);

    const tools = await this.createTools(profile.id, conversationId);
    const chatHistory = this.convertChatHistory(conversationHistory);

    const messages: BaseMessage[] = [
      ...systemMessages,
      ...chatHistory,
      new HumanMessage(userMessage),
    ];

    // Detect workflow type to determine which model to use
    const toolNames = tools.map((t) => t.name);
    const workflow = await this.workflowControl.detectWorkflow(
      userMessage,
      toolNames,
      conversationSummary
    );

    this.logger.log(
      `Workflow detected: ${workflow.type} (confidence: ${workflow.confidence})`
    );

    // Select appropriate model based on workflow
    const selectedLLM = workflow.requiresToolCalling
      ? this.toolCallingLLM
      : this.conversationalLLM;

    // Bind tools to LLM if tool calling is required
    const llmWithTools = workflow.requiresToolCalling
      ? selectedLLM.bindTools(tools)
      : selectedLLM;

    const toolsMessage = workflow.requiresToolCalling 
      ? `with ${tools.length} tools bound to LLM` 
      : 'with LLM (no tools)';
    this.logger.log(`Executing conversation ${toolsMessage}`);

    const response = await llmWithTools.invoke(messages);

    // Extract and emit thinking tokens before filtering
    const responseText = response.content as string;
    const { thinking, filtered } = this.workflowControl.extractThinkingTokens(responseText);
    
    if (thinking.length > 0 && onStreamEvent) {
      for (const thinkingText of thinking) {
        await onStreamEvent({
          type: StreamingEventType.THINKING,
          content: {
            text: thinkingText,
            raw: responseText,
          },
          timestamp: new Date(),
        });
      }
    }

    // Check if response contains tool calls
    const toolCallsToExecute: any[] = (response as any).tool_calls || [];
    const toolCalls: Array<{ tool: string; input: unknown; output: unknown }> =
      [];

    if (toolCallsToExecute.length > 0) {
      this.logger.log(`LLM requested ${toolCallsToExecute.length} tool calls`);

      // Execute each tool call
      for (const toolCall of toolCallsToExecute) {
        this.logger.log(`Executing tool: ${toolCall.name}`);

        // Emit tool start event
        if (onStreamEvent) {
          await onStreamEvent({
            type: StreamingEventType.TOOL_START,
            content: {
              tool: toolCall.name,
              input: toolCall.args,
            },
            timestamp: new Date(),
          });
        }

        try {
          // Convert to OpenAI format for MCP executor
          const openAIToolCall = {
            id: toolCall.id || `call_${Date.now()}`,
            type: 'function' as const,
            function: {
              name: toolCall.name,
              arguments:
                typeof toolCall.args === 'string'
                  ? toolCall.args
                  : JSON.stringify(toolCall.args),
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

          toolCalls.push({
            tool: toolCall.name,
            input: toolCall.args,
            output: result.result || result,
          });

          // Emit tool end event
          if (onStreamEvent) {
            await onStreamEvent({
              type: StreamingEventType.TOOL_END,
              content: {
                tool: toolCall.name,
                output: result.result || result,
                success: true,
              },
              timestamp: new Date(),
            });
          }

          this.logger.log(`Tool ${toolCall.name} executed successfully`);
        } catch (error) {
          this.logger.error(`Tool ${toolCall.name} execution failed:`, error);
          
          toolCalls.push({
            tool: toolCall.name,
            input: toolCall.args,
            output: { error: error.message },
          });

          // Emit error event
          if (onStreamEvent) {
            await onStreamEvent({
              type: StreamingEventType.ERROR,
              content: {
                message: `Tool ${toolCall.name} failed: ${error.message}`,
                details: error,
              },
              timestamp: new Date(),
            });
          }
        }
      }

      // If tools were called, get final response from LLM with tool results
      if (toolCalls.length > 0) {
        // Add tool results to conversation and get final response
        const toolResultMessages = toolCalls.map(
          (tc) =>
            new AIMessage(
              `Tool ${tc.tool} result: ${JSON.stringify(tc.output)}`
            )
        );

        const finalMessages = [...messages, response, ...toolResultMessages];
        const finalResponse = await llmWithTools.invoke(finalMessages);

        // Extract thinking tokens from final response
        const finalResponseText = finalResponse.content as string;
        const { thinking: finalThinking, filtered: cleanedResponse } =
          this.workflowControl.extractThinkingTokens(finalResponseText);

        // Emit final thinking tokens if any
        if (finalThinking.length > 0 && onStreamEvent) {
          for (const thinkingText of finalThinking) {
            await onStreamEvent({
              type: StreamingEventType.THINKING,
              content: {
                text: thinkingText,
                raw: finalResponseText,
              },
              timestamp: new Date(),
            });
          }
        }

        return {
          response: cleanedResponse,
          intermediateSteps: [],
          toolCalls,
        };
      }
    }

    // No tool calls, just return the response with filtered thinking tokens
    return {
      response: filtered,
      intermediateSteps: [],
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  async *streamConversation(
    persona: PersonaTelosDto,
    profile: ProfileDto,
    conversationHistory: ChatMessage[],
    userMessage: string,
    conversationSummary: string,
    conversationId: string
  ): AsyncGenerator<StreamingEvent> {
    // Enrich with project context if available
    const projectContext = await this.enrichWithProjectContext(
      conversationHistory,
      userMessage
    );

    // Use SystemPromptBuilder for TELOS-driven system prompts
    const { template, variables } = await this.systemPromptBuilder.buildSystemPrompt(
      {
        personaId: persona.id,
        profileId: profile.id,
        conversationSummary: conversationSummary,
        projectContext: projectContext || '',
      },
      {
        includeTools: true,
        includeExamples: false,
        includeProjectContext: !!projectContext,
      }
    );
    
    const systemMessages = await template.formatMessages(variables);

    const tools = await this.createTools(profile.id, conversationId);
    const chatHistory = this.convertChatHistory(conversationHistory);

    const messages: BaseMessage[] = [
      ...systemMessages,
      ...chatHistory,
      new HumanMessage(userMessage),
    ];

    // Detect workflow type to determine which model to use
    const toolNames = tools.map((t) => t.name);
    const workflow = await this.workflowControl.detectWorkflow(
      userMessage,
      toolNames,
      conversationSummary
    );

    // Select appropriate model based on workflow
    const selectedLLM = workflow.requiresToolCalling
      ? this.toolCallingLLM
      : this.conversationalLLM;

    // Bind tools to LLM if tool calling is required
    const llmWithTools = workflow.requiresToolCalling
      ? selectedLLM.bindTools(tools)
      : selectedLLM;

    const toolsMessage = workflow.requiresToolCalling
      ? `with ${tools.length} tools bound to LLM`
      : 'with LLM (no tools)';
    this.logger.log(`Streaming conversation ${toolsMessage}`);

    const stream = await llmWithTools.stream(messages);
    let fullResponse = '';

    // Stream chunks in real-time
    for await (const chunk of stream) {
      if (chunk.content) {
        const contentStr =
          typeof chunk.content === 'string'
            ? chunk.content
            : JSON.stringify(chunk.content);
        fullResponse += contentStr;

        // Yield each chunk immediately for real-time updates
        yield {
          type: StreamingEventType.CHUNK,
          content: contentStr,
          timestamp: new Date(),
        };
      }
    }

    // Extract and emit thinking tokens before final response
    const { thinking, filtered } = this.workflowControl.extractThinkingTokens(fullResponse);
    
    if (thinking.length > 0) {
      for (const thinkingText of thinking) {
        yield {
          type: StreamingEventType.THINKING,
          content: {
            text: thinkingText,
            raw: fullResponse,
          },
          timestamp: new Date(),
        };
      }
    }

    // Final yield with complete response (filtered for thinking tokens)
    yield {
      type: StreamingEventType.FINAL_RESPONSE,
      content: {
        text: filtered,
      },
      timestamp: new Date(),
    };
  }
}
