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
import { ToolFactory } from './tool-factory.service';
import { StreamingEvent, StreamingEventType } from './streaming-events';

const TOOL_OUTPUT_BLACKLIST = ['list_tools'];
const TOOL_RESULT_SUMMARIES: Record<string, string> = {
  list_tools: 'Available tools retrieved',
};

function getToolResultContent(tool: string, output: unknown): string {
  if (TOOL_OUTPUT_BLACKLIST.includes(tool)) {
    return TOOL_RESULT_SUMMARIES[tool] || 'Tool executed successfully';
  }
  return typeof output === 'string' ? output : JSON.stringify(output, null, 2);
}

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
    private readonly systemPromptBuilder: SystemPromptBuilder,
    private readonly toolFactory: ToolFactory
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
    return this.toolFactory.createTools({ userId, conversationId });
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

    // Detect if this is the first message in the conversation
    // First message = empty conversation history OR only system/assistant greetings
    const isFirstMessage =
      conversationHistory.length === 0 ||
      (conversationHistory.length === 1 &&
        conversationHistory[0].role !== 'user');

    // Use SystemPromptBuilder for STATIC TELOS-driven system prompts
    // CRITICAL: System prompt should NOT include conversation summary
    // Conversation context is passed as full message history below
    const { template, variables } =
      await this.systemPromptBuilder.buildSystemPrompt(
        {
          personaId: persona.id,
          profileId: profile.id,
          projectContext: projectContext || '',
        },
        {
          includeTools: !isFirstMessage, // Don't include tools on first message
          includeExamples: false,
          includeProjectContext: !!projectContext,
          isFirstMessage: isFirstMessage, // Special first message instructions
        }
      );

    const systemMessages = await template.formatMessages(variables);

    const tools = await this.createTools(profile.id, conversationId);
    const chatHistory = this.convertChatHistory(conversationHistory);

    // IMPORTANT: Full conversation history is passed as messages
    // System prompt is STATIC (persona TELOS only)
    const messages: BaseMessage[] = [
      ...systemMessages,
      ...chatHistory,
      new HumanMessage(userMessage),
    ];

    // For first message, ALWAYS use conversational model (no tool calling)
    if (isFirstMessage) {
      this.logger.log(
        'First message detected - using conversational model only (no tools)'
      );

      const response = await this.conversationalLLM.invoke(messages);

      // Extract and emit thinking tokens before filtering
      const responseText = response.content as string;
      const { thinking, filtered } =
        this.workflowControl.extractThinkingTokens(responseText);

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

      // Return conversational-only response (no tool calls)
      return {
        response: filtered,
        intermediateSteps: [],
        toolCalls: [],
      };
    }

    // For subsequent messages, detect workflow type to determine which model to use
    const toolNames = tools.map((t) => t.name);
    const workflow = await this.workflowControl.detectWorkflow(
      userMessage,
      toolNames,
      '' // No longer pass conversation summary to workflow detection
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
    const { thinking, filtered } =
      this.workflowControl.extractThinkingTokens(responseText);

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
        // Emit response start event
        if (onStreamEvent) {
          await onStreamEvent({
            type: StreamingEventType.RESPONSE_START,
            content: { mode: 'hybrid' },
            timestamp: new Date(),
          });
        }

        // Add tool results to conversation and get final response
        // Filter verbose tool outputs (like list_tools) to prevent context pollution
        const toolResultMessages = toolCalls
          .filter((tc) => !TOOL_OUTPUT_BLACKLIST.includes(tc.tool))
          .map(
            (tc) =>
              new AIMessage(
                `Tool ${tc.tool} result: ${getToolResultContent(
                  tc.tool,
                  tc.output
                )}`
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

    // No tool calls, emit response start and return conversational response
    if (onStreamEvent) {
      await onStreamEvent({
        type: StreamingEventType.RESPONSE_START,
        content: { mode: 'conversational' },
        timestamp: new Date(),
      });
    }

    return {
      response: filtered,
      intermediateSteps: [],
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Stream conversation with LLM using configured conversational model
   * Now with static TELOS-driven system prompts (conversation history passed as messages)
   */
  async *streamConversation(
    persona: PersonaTelosDto,
    profile: ProfileDto,
    conversationHistory: ChatMessage[],
    userMessage: string,
    conversationId: string
  ): AsyncGenerator<StreamingEvent> {
    // Enrich with project context if available
    const projectContext = await this.enrichWithProjectContext(
      conversationHistory,
      userMessage
    );

    // Detect if this is the first message in the conversation
    // First message = empty conversation history OR only system/assistant greetings
    const isFirstMessage =
      conversationHistory.length === 0 ||
      (conversationHistory.length === 1 &&
        conversationHistory[0].role !== 'user');

    // Use SystemPromptBuilder for STATIC TELOS-driven system prompts
    // CRITICAL: System prompt should NOT include conversation summary
    // Conversation context is passed as full message history below
    const { template, variables } =
      await this.systemPromptBuilder.buildSystemPrompt(
        {
          personaId: persona.id,
          profileId: profile.id,
          projectContext: projectContext || '',
        },
        {
          includeTools: !isFirstMessage, // Don't include tools on first message
          includeExamples: false,
          includeProjectContext: !!projectContext,
          isFirstMessage: isFirstMessage, // Special first message instructions
        }
      );

    const systemMessages = await template.formatMessages(variables);

    const tools = await this.createTools(profile.id, conversationId);
    const chatHistory = this.convertChatHistory(conversationHistory);

    // IMPORTANT: Full conversation history is passed as messages
    // System prompt is STATIC (persona TELOS only)
    const messages: BaseMessage[] = [
      ...systemMessages,
      ...chatHistory,
      new HumanMessage(userMessage),
    ];

    // For first message, ALWAYS use conversational model (no tool calling)
    if (isFirstMessage) {
      this.logger.log(
        'First message detected - streaming conversational response only (no tools)'
      );

      // Emit response start
      yield {
        type: StreamingEventType.RESPONSE_START,
        content: { mode: 'conversational' },
        timestamp: new Date(),
      };

      const stream = await this.conversationalLLM.stream(messages);
      let fullResponse = '';

      for await (const chunk of stream) {
        const content = chunk.content as string;
        fullResponse += content;

        yield {
          type: StreamingEventType.CHUNK,
          content: { text: content },
          timestamp: new Date(),
        };
      }

      // Extract and emit thinking tokens from complete response
      const { thinking, filtered } =
        this.workflowControl.extractThinkingTokens(fullResponse);

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

      // Emit final response
      yield {
        type: StreamingEventType.FINAL_RESPONSE,
        content: { text: filtered },
        timestamp: new Date(),
      };

      return;
    }

    // For subsequent messages, detect workflow type to determine which model to use
    const toolNames = tools.map((t) => t.name);
    const workflow = await this.workflowControl.detectWorkflow(
      userMessage,
      toolNames,
      '' // No longer pass conversation summary to workflow detection
    );

    // Select appropriate model based on workflow
    const selectedLLM = workflow.requiresToolCalling
      ? this.toolCallingLLM
      : this.conversationalLLM;

    // Bind tools to LLM if tool calling is required
    const llmWithTools = workflow.requiresToolCalling
      ? selectedLLM.bindTools(tools)
      : selectedLLM;

    const responseMode = workflow.requiresToolCalling
      ? workflow.requiresConversation
        ? 'hybrid'
        : 'tool_calling'
      : 'conversational';

    // Emit response start
    yield {
      type: StreamingEventType.RESPONSE_START,
      content: { mode: responseMode },
      timestamp: new Date(),
    };

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
    const { thinking, filtered } =
      this.workflowControl.extractThinkingTokens(fullResponse);

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
