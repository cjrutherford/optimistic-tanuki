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
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ToolsService } from './tools.service';
import { z } from 'zod';
import { ModelInitializerService } from './model-initializer.service';
import { WorkflowControlService } from './workflow-control.service';
import { StreamingEvent, StreamingEventType } from './streaming-events';
import { SystemPromptBuilder } from './system-prompt-builder.service';
import { ToolFactory } from './tool-factory.service';
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
    private readonly systemPromptBuilder: SystemPromptBuilder,
    private readonly toolFactory: ToolFactory
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
    this.logger.log('Creating tools via ToolFactory...');
    try {
      const tools = await this.toolFactory.createTools({
        userId: '',
        conversationId: undefined,
      });
      this.logger.log(`ToolFactory returned ${tools.length} tools`);
      return tools;
    } catch (error) {
      this.logger.error(`ToolFactory.createTools failed: ${error.message}`);
      return [];
    }
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
    onProgress?: (data: StreamingEvent) => Promise<void> | void
  ): Promise<AgentExecutionResult> {
    if (!this.initialized || !this.agent) {
      throw new Error('Agent not initialized. Call initializeAgent first.');
    }

    const emitEvent = async (type: StreamingEventType, content: any) => {
      if (onProgress) {
        try {
          await onProgress({
            type,
            content,
            timestamp: new Date(),
          });
        } catch (err) {
          this.logger.warn(`Progress callback error: ${err.message}`);
        }
      }
    };

    const emitToolStart = async (toolName: string, input: unknown) => {
      await emitEvent(StreamingEventType.TOOL_START, { tool: toolName, input });
    };

    const emitToolEnd = async (toolName: string, output: unknown) => {
      await emitEvent(StreamingEventType.TOOL_END, {
        tool: toolName,
        output,
        success: true,
      });
    };

    const emitThinking = async (text: string, raw: string) => {
      await emitEvent(StreamingEventType.THINKING, { text, raw });
    };

    try {
      this.logger.log(`Executing agent for user ${profile.id}`);
      this.logger.log(`LLM available: ${!!this.llm}`);

      // Quick health check - test LLM connection
      try {
        this.logger.log('Testing LLM connection...');
        const testResult = await this.llm.invoke([new HumanMessage('hi')]);
        this.logger.log(`LLM test successful`);
      } catch (llmError) {
        this.logger.error(
          `LLM test failed: ${llmError.message}. Continuing anyway...`
        );
      }

      await emitEvent(
        StreamingEventType.MESSAGE,
        `Starting agent execution for user ${profile.id}`
      );

      this.logger.log(`Building system prompt for persona: ${persona.name}`);
      // Build system prompt using the centralized builder
      // This ensures we get the "OPERATIONAL PROTOCOLS" and anti-regurgitation instructions
      const { template, variables } =
        await this.systemPromptBuilder.buildSystemPrompt(
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
      // Emit response start - in agent mode, this indicates the agent is processing
      await emitEvent(StreamingEventType.RESPONSE_START, {
        mode: 'tool_calling',
      });

      this.logger.log('Calling agent.stream()...');
      const stream = await this.agent.stream(inputs, {
        streamMode: ['values', 'messages'],
        configurable: {
          userId: profile.id,
          conversationId,
        },
        recursionLimit: 15, // Prevent infinite loops
      });
      this.logger.log('Agent stream created, starting iteration...');

      let finalState: any;
      const toolCalls: Array<{
        tool: string;
        input: unknown;
        output: unknown;
      }> = [];

      this.logger.log('Starting agent stream loop...');
      for await (const chunk of stream) {
        this.logger.debug('Agent stream chunk received');
        finalState = chunk;
        const messages = chunk.messages || [];
        const lastMessage = messages[messages.length - 1];

        if (lastMessage) {
          if (lastMessage.content && typeof lastMessage.content === 'string') {
            const { thinking } = this.workflowControl.extractThinkingTokens(
              lastMessage.content
            );
            if (thinking.length > 0) {
              for (const thinkingText of thinking) {
                await emitThinking(thinkingText, lastMessage.content);
              }
            }
          }

          // Check for tool calls
          if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            for (const toolCall of lastMessage.tool_calls) {
              this.logger.log(`Agent detected tool call: ${toolCall.name}`);
              await emitToolStart(toolCall.name, toolCall.args);
            }
          }

          // Check for tool outputs (ToolMessage)
          if (lastMessage._getType() === 'tool') {
            this.logger.log(
              `Agent received tool output for: ${lastMessage.name}`
            );
            await emitToolEnd(lastMessage.name, lastMessage.content);

            // Store for result
            toolCalls.push({
              tool: lastMessage.name || 'unknown',
              input: {}, // We'd need to look back to find input, skipping for now or we can track it
              output: lastMessage.content,
            });
          }
        }
      }

      this.logger.log('Agent stream loop complete');

      // Extract final response
      const messages = finalState?.messages || [];
      const lastMessage = messages[messages.length - 1];
      const output = lastMessage?.content || '';
      this.logger.log(`Extracted output: ${output?.substring(0, 100)}...`);

      const hasToolCalls = (lastMessage as any)?.tool_calls?.length > 0;

      if (!output && toolCalls.length === 0 && !hasToolCalls) {
        const msg =
          'Agent execution completed but produced no output and no tool calls. The model may have failed to respond or encountered an internal error.';
        this.logger.warn(msg);
        await emitEvent(StreamingEventType.MESSAGE, msg);
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

      if (allToolCalls.length === 0) {
        const manualToolCall = this.parseJsonToolCall(cleanedOutput);
        if (manualToolCall) {
          this.logger.log(
            `Detected manual JSON tool call: ${manualToolCall.name}`
          );

          await emitToolStart(manualToolCall.name, manualToolCall.arguments);

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

            await emitToolEnd(manualToolCall.name, result.result || result);

            // Update output to reflect the action taken
            return {
              output: `I've executed the ${
                manualToolCall.name
              } tool. Result: ${JSON.stringify(result.result)}`,
              intermediateSteps: messages.map((msg: any) => ({
                action: msg.tool_calls?.[0]?.name || 'response',
                observation: msg.content || '',
              })),
              toolCalls: allToolCalls,
            };
          } catch (err) {
            this.logger.error(`Manual tool execution failed: ${err.message}`);
            await emitEvent(
              StreamingEventType.MESSAGE,
              `Manual tool execution failed: ${err.message}`
            );
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
      await emitEvent(
        StreamingEventType.MESSAGE,
        `Agent execution failed: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Parse JSON tool call from text
   * Looks for { "name": "...", "arguments": { ... } } structure
   */
  private parseJsonToolCall(
    text: string
  ): { name: string; arguments: any } | null {
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
