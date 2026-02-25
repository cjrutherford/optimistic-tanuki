/**
 * Conversation Service
 *
 * Main service for orchestrating conversations using LangGraph.
 * Provides streaming and non-streaming execution.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import {
  PersonaTelosDto,
  ProfileDto,
  ChatMessage,
} from '@optimistic-tanuki/models';
import { ModelManager, ModelType } from '../models/model-manager.service';
import { ToolRegistry } from '../tools/tool-registry.service';
import { IntentAnalyzer } from '../intent/intent-analyzer.service';
import { DataTracker } from '../data/data-tracker.service';
import { SystemPromptBuilder } from '../system-prompt-builder.service';
import { StreamingEvent, StreamingEventType } from '../streaming-events';

export interface ConversationOptions {
  conversationId: string;
  enableStreaming?: boolean;
  enableHumanApproval?: boolean;
  maxIterations?: number;
}

export interface ConversationResult {
  response: string;
  toolCalls?: Array<{
    tool: string;
    input: unknown;
    output: unknown;
  }>;
  metadata?: {
    intent?: string;
    domain?: string;
    confidence?: number;
  };
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly modelManager: ModelManager,
    private readonly toolRegistry: ToolRegistry,
    private readonly intentAnalyzer: IntentAnalyzer,
    private readonly dataTracker: DataTracker,
    private readonly promptBuilder: SystemPromptBuilder
  ) {}

  /**
   * Execute a conversation turn
   */
  async execute(
    message: string,
    history: ChatMessage[],
    persona: PersonaTelosDto,
    profile: ProfileDto,
    options: ConversationOptions
  ): Promise<ConversationResult> {
    const startTime = Date.now();
    this.logger.log(`Executing conversation for ${profile.id}`);

    try {
      // Step 1: Analyze intent
      const tools = await this.toolRegistry.getTools();
      const toolNames = tools.map((t) => t.name);

      const intent = await this.intentAnalyzer.analyzeIntent(
        message,
        this.convertToBaseMessages(history),
        toolNames
      );

      this.logger.debug(
        `Intent: ${intent.type} (${intent.domain}), confidence: ${intent.confidence}`
      );

      // Step 2: Extract data points
      const dataPoints = await this.intentAnalyzer.extractDataPoints(
        message,
        this.convertToBaseMessages(history)
      );

      // Step 3: Track extracted data
      await this.dataTracker.trackExtractedData(
        options.conversationId,
        dataPoints,
        'USER_INPUT'
      );

      // Step 4: Build system prompt with context
      const { template, variables } =
        await this.promptBuilder.buildSystemPrompt(
          {
            personaId: persona.id,
            profileId: profile.id,
          },
          {
            includeTools: intent.type === 'ACTION',
            includeProfileTelos: true,
          }
        );

      const systemMessages = await template.formatMessages(variables);

      // Step 5: Build messages array
      const messages: BaseMessage[] = [
        ...systemMessages,
        ...this.convertToBaseMessages(history),
        new HumanMessage(message),
      ];

      // Step 6: Call LLM with tools if needed
      let response: string;
      let toolCalls: Array<{ tool: string; input: unknown; output: unknown }> =
        [];

      if (intent.type === 'ACTION' && intent.suggestedTools.length > 0) {
        // Use tool-enabled model
        const model = this.modelManager.getModelWithTools(
          ModelType.TOOL_CALLING,
          tools
        );
        const result = await model.invoke(messages);

        response = result.content as string;

        // Process tool calls
        const toolCallsFromResponse = (result as any).tool_calls || [];

        if (toolCallsFromResponse.length > 0) {
          toolCalls = await this.executeToolCalls(
            toolCallsFromResponse,
            profile.id,
            options.conversationId,
            options.enableHumanApproval
          );

          // Get final response with tool results
          const finalResponse = await this.getFinalResponse(
            messages,
            result,
            toolCalls,
            persona,
            profile
          );
          response = finalResponse;
        }
      } else {
        // Use conversational model
        const model = this.modelManager.getModel(ModelType.CONVERSATIONAL);
        const result = await model.invoke(messages);
        response = result.content as string;
      }

      // Step 7: Update context
      await this.dataTracker.updateMetadata(options.conversationId, {
        lastAction: intent.actionType,
        currentDomain: intent.domain,
        messageCount: history.length + 1,
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Conversation completed in ${duration}ms`);

      return {
        response,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        metadata: {
          intent: intent.type,
          domain: intent.domain,
          confidence: intent.confidence,
        },
      };
    } catch (error) {
      this.logger.error(`Conversation execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stream a conversation turn
   */
  async *stream(
    message: string,
    history: ChatMessage[],
    persona: PersonaTelosDto,
    profile: ProfileDto,
    options: ConversationOptions
  ): AsyncGenerator<StreamingEvent> {
    this.logger.log(`Streaming conversation for ${profile.id}`);

    try {
      // Emit start event
      yield {
        type: StreamingEventType.RESPONSE_START,
        content: { mode: 'streaming' },
        timestamp: new Date(),
      };

      // Analyze intent
      const tools = await this.toolRegistry.getTools();
      const toolNames = tools.map((t) => t.name);

      const intent = await this.intentAnalyzer.analyzeIntent(
        message,
        this.convertToBaseMessages(history),
        toolNames
      );

      // Build prompt
      const { template, variables } =
        await this.promptBuilder.buildSystemPrompt(
          {
            personaId: persona.id,
            profileId: profile.id,
          },
          {
            includeTools: intent.type === 'ACTION',
            includeProfileTelos: true,
          }
        );

      const systemMessages = await template.formatMessages(variables);
      const messages: BaseMessage[] = [
        ...systemMessages,
        ...this.convertToBaseMessages(history),
        new HumanMessage(message),
      ];

      // Stream response
      const model = this.modelManager.getModel(ModelType.CONVERSATIONAL);
      const stream = await model.stream(messages);

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

      // Emit final response
      yield {
        type: StreamingEventType.FINAL_RESPONSE,
        content: { text: fullResponse },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Streaming failed: ${error.message}`);

      yield {
        type: StreamingEventType.ERROR,
        content: { message: error.message },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Execute tool calls
   */
  private async executeToolCalls(
    toolCalls: any[],
    userId: string,
    conversationId: string,
    enableHumanApproval = false
  ): Promise<Array<{ tool: string; input: unknown; output: unknown }>> {
    const results: Array<{ tool: string; input: unknown; output: unknown }> =
      [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.name;
      const toolInput = toolCall.args || {};

      // Check if human approval is needed
      if (
        enableHumanApproval &&
        this.toolRegistry.requiresHumanApproval(toolName)
      ) {
        this.logger.log(`Tool ${toolName} requires human approval`);
        // In a real implementation, this would pause and wait for approval
        // For now, we skip it
        continue;
      }

      // Track tool call
      await this.dataTracker.trackToolCall(
        conversationId,
        toolName,
        toolInput,
        null,
        false
      );

      results.push({
        tool: toolName,
        input: toolInput,
        output: { status: 'executed' },
      });
    }

    return results;
  }

  /**
   * Get final response after tool execution
   */
  private async getFinalResponse(
    messages: BaseMessage[],
    llmResponse: any,
    toolResults: Array<{ tool: string; input: unknown; output: unknown }>,
    persona: PersonaTelosDto,
    profile: ProfileDto
  ): Promise<string> {
    // Add tool results to messages
    const messagesWithResults = [
      ...messages,
      llmResponse,
      ...toolResults.map(
        (tr) =>
          new AIMessage(`Tool ${tr.tool} result: ${JSON.stringify(tr.output)}`)
      ),
    ];

    // Get final response
    const model = this.modelManager.getModel(ModelType.CONVERSATIONAL);
    const result = await model.invoke(messagesWithResults);

    return result.content as string;
  }

  /**
   * Convert ChatMessage array to BaseMessage array
   */
  private convertToBaseMessages(messages: ChatMessage[]): BaseMessage[] {
    return messages.map((msg) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      }
      return new AIMessage(msg.content);
    });
  }

  /**
   * Clear conversation data
   */
  async clearConversation(conversationId: string): Promise<void> {
    await this.dataTracker.clearConversation(conversationId);
    this.logger.log(`Cleared conversation ${conversationId}`);
  }
}
