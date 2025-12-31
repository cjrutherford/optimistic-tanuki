/**
 * LangGraph Service for State Management
 *
 * Manages conversation state using LangGraph
 * Handles context building, tool execution tracking, and state persistence
 */

import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';

import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import {
  ChatMessage,
  ProfileDto,
  PersonaTelosDto,
} from '@optimistic-tanuki/models';
import { ContextStorageService } from './context-storage.service';
import { LangChainService } from './langchain.service';
import { LangChainAgentService } from './langchain-agent.service';

/**
 * Conversation state managed by LangGraph.
 *
 * Build lazily at runtime to avoid import-time invocation of `Annotation`
 * that can fail in some test/module interop shapes. We still use the
 * langgraph types for compile-time safety but resolve the runtime value
 * when needed.
 */
function getConversationState() {
  // Resolve runtime Annotation export (support function export or object-with-Root)
  const AnnotationRuntime = Annotation;

  return AnnotationRuntime.Root({
    // Core conversation data
    messages: AnnotationRuntime<BaseMessage[]>({
      reducer: (x, y) => x.concat(y), // Append new messages
      default: () => [],
    }),

    // Original ChatMessage[] for full history context
    chatHistory: AnnotationRuntime<ChatMessage[]>({
      reducer: (x, y) => x.concat(y), // Append new messages
      default: () => [],
    }),

    // User context
    profileId: AnnotationRuntime<string>({
      reducer: (x, y) => y ?? x,
      default: () => '',
    }),

    // Conversation summary
    summary: AnnotationRuntime<string>({
      reducer: (x, y) => y ?? x,
      default: () => '',
    }),

    // Active projects being discussed
    activeProjects: AnnotationRuntime<string[]>({
      reducer: (x, y) => Array.from(new Set([...x, ...y])),
      default: () => [],
    }),

    // Recent topics
    recentTopics: AnnotationRuntime<string[]>({
      reducer: (x, y) => {
        const combined = [...x, ...y];
        // Keep only last 10 unique topics
        return Array.from(new Set(combined)).slice(-10);
      },
      default: () => [],
    }),

    // Tool call tracking
    toolCallsCount: AnnotationRuntime<number>({
      reducer: (x, y) => x + y,
      default: () => 0,
    }),

    // Last tool called
    lastToolCalled: AnnotationRuntime<string | null>({
      reducer: (x, y) => y ?? x,
      default: () => null,
    }),

    // Current iteration (for max iterations check)
    iteration: AnnotationRuntime<number>({
      reducer: (x, y) => x + 1,
      default: () => 0,
    }),

    // Whether conversation should continue
    shouldContinue: AnnotationRuntime<boolean>({
      reducer: (x, y) => y ?? x,
      default: () => true,
    }),

    // Additional metadata
    metadata: AnnotationRuntime<Record<string, unknown>>({
      reducer: (x, y) => ({ ...x, ...y }),
      default: () => ({}),
    }),
  });
}

// Derive the runtime ConversationState type from the factory when needed
type ConversationStateType = ReturnType<typeof getConversationState> extends {
  State: infer S;
}
  ? S
  : any;

@Injectable()
export class LangGraphService {
  private readonly logger = new Logger(LangGraphService.name);
  private graph: ReturnType<typeof this.buildGraph>;

  constructor(
    private readonly contextStorage: ContextStorageService,
    private readonly langchain: LangChainService,
    private readonly agent: LangChainAgentService
  ) {
    this.graph = this.buildGraph();
  }

  /**
   * Normalize message content to a string for safe processing.
   * Some callers may supply `content` as an array of segments, an object,
   * or a plain string. Ensure we always return a string so callers can
   * safely call string methods without risking `.every is not a function`.
   */
  private normalizeContent(content: unknown): string {
    if (content == null) return '';
    if (Array.isArray(content)) {
      try {
        return content.map((c) => (c == null ? '' : String(c))).join(' ');
      } catch (e) {
        return String(content);
      }
    }
    if (typeof content === 'object') {
      try {
        return JSON.stringify(content);
      } catch (e) {
        return String(content);
      }
    }
    return String(content);
  }

  /**
   * Build the conversation state graph
   */
  private buildGraph() {
    const workflow = new StateGraph(getConversationState());

    // Define nodes
    workflow.addNode('loadContext', this.loadContextNode.bind(this));
    workflow.addNode('processMessage', this.processMessageNode.bind(this));
    workflow.addNode('extractTopics', this.extractTopicsNode.bind(this));
    workflow.addNode('updateSummary', this.updateSummaryNode.bind(this));
    workflow.addNode('saveContext', this.saveContextNode.bind(this));

    // Define edges - using type assertions for string node names
    (workflow as any).addEdge(START, 'loadContext');
    (workflow as any).addEdge('loadContext', 'processMessage');
    (workflow as any).addEdge('processMessage', 'extractTopics');
    (workflow as any).addEdge('extractTopics', 'updateSummary');
    (workflow as any).addEdge('updateSummary', 'saveContext');
    (workflow as any).addEdge('saveContext', END);

    return workflow.compile();
  }

  /**
   * Node: Load existing context from storage
   */
  private async loadContextNode(
    state: ConversationStateType
  ): Promise<Partial<ConversationStateType>> {
    try {
      const context = await this.contextStorage.getContext(state.profileId);

      if (context) {
        this.logger.debug(`Loaded context for profile ${state.profileId}`);
        return {
          summary: context.summary,
          recentTopics: context.recentTopics,
          activeProjects: context.activeProjects,
          metadata: context.metadata || {},
        };
      }

      this.logger.debug(`No existing context for profile ${state.profileId}`);
      return {};
    } catch (error) {
      this.logger.error(`Error loading context: ${error.message}`);
      return {};
    }
  }

  /**
   * Node: Process the message (placeholder for LLM interaction)
   */
  private async processMessageNode(
    state: ConversationStateType
  ): Promise<Partial<ConversationStateType>> {
    // This is handled by the main service
    // Just increment iteration
    return {
      iteration: 1,
    };
  }

  /**
   * Node: Extract topics from recent messages
   */
  private async extractTopicsNode(
    state: ConversationStateType
  ): Promise<Partial<ConversationStateType>> {
    try {
      const lastMessages = state.messages.slice(-3); // Last 3 messages
      const topics: string[] = [];

      for (const message of lastMessages) {
        const content = this.normalizeContent(message.content).toLowerCase();

        // Extract project mentions
        if (content.includes('project')) {
          topics.push('projects');
        }

        // Extract task mentions
        if (content.includes('task')) {
          topics.push('tasks');
        }

        // Extract risk mentions
        if (content.includes('risk')) {
          topics.push('risks');
        }

        // Extract change mentions
        if (content.includes('change')) {
          topics.push('changes');
        }

        // Extract journal mentions
        if (content.includes('journal') || content.includes('note')) {
          topics.push('journal');
        }
      }

      return {
        recentTopics: topics,
      };
    } catch (error) {
      this.logger.error(`Error extracting topics: ${error.message}`);
      return {};
    }
  }

  /**
   * Node: Update conversation summary
   */
  private async updateSummaryNode(
    state: ConversationStateType
  ): Promise<Partial<ConversationStateType>> {
    try {
      // Simple summary: last user message + topics
      const lastMessage = state.messages[state.messages.length - 1];
      const summary = `Last discussed: ${this.normalizeContent(
        lastMessage?.content
      ).slice(0, 100)}... Topics: ${state.recentTopics.join(', ')}`;

      return {
        summary,
      };
    } catch (error) {
      this.logger.error(`Error updating summary: ${error.message}`);
      return {};
    }
  }

  /**
   * Node: Save context to storage
   */
  private async saveContextNode(
    state: ConversationStateType
  ): Promise<Partial<ConversationStateType>> {
    try {
      await this.contextStorage.storeContext(state.profileId, {
        summary: state.summary,
        recentTopics: state.recentTopics,
        activeProjects: state.activeProjects,
        messageCount: state.messages.length,
        metadata: state.metadata,
      });

      this.logger.debug(`Saved context for profile ${state.profileId}`);
      return {};
    } catch (error) {
      this.logger.error(`Error saving context: ${error.message}`);
      return {};
    }
  }

  /**
   * Execute the conversation graph
   */
  async executeConversation(
    profileId: string,
    messages: BaseMessage[],
    chatHistory: ChatMessage[],
    existingSummary: string,
    persona: PersonaTelosDto,
    profile: ProfileDto,
    conversationId: string,
    useAgent = false,
    onProgress?: (data: any) => Promise<void> | void
  ): Promise<{
    response: string;
    topics?: string[];
    toolCalls?: Array<{ tool: string; input: unknown; output: unknown }>;
  }> {
    const initialState: Partial<ConversationStateType> = {
      profileId,
      messages,
      chatHistory,
      summary: existingSummary || '',
      iteration: 0,
    };

    try {
      // Execute state graph
      const result = await this.graph.invoke(initialState);

      // Execute LLM (with or without agent)
      let llmResponse: string;
      let toolCalls: Array<{ tool: string; input: unknown; output: unknown }> =
        [];

      if (useAgent && this.agent && this.agent.isInitialized()) {
        this.logger.log('Using Agent for multi-step execution');

        // Get the last user message
        const lastMessage = messages[messages.length - 1];
        const userInput = this.normalizeContent(lastMessage?.content);

        // Execute agent
        // Pass LangGraph-enriched summary and conversationId so agent has canonical context
        const agentResult = await this.agent.executeAgent(
          userInput,
          messages.slice(0, -1), // Chat history without current message
          profileId,
          result.summary,
          conversationId,
          onProgress
        );

        llmResponse = agentResult.output;
        toolCalls = agentResult.toolCalls;

        this.logger.log(
          `Agent execution complete. Tool calls: ${toolCalls.length}`
        );
      } else {
        this.logger.log('Using direct LangChain execution');

        // Use the full chatHistory for context
        const conversationResult = await this.langchain.executeConversation(
          persona,
          profile,
          result.chatHistory.slice(0, -1), // Full chat history except last message
          this.normalizeContent(messages[messages.length - 1]?.content),
          result.summary,
          conversationId
        );

        llmResponse = conversationResult.response;

        // If tool calls were made in direct execution, include them
        if (
          conversationResult.toolCalls &&
          conversationResult.toolCalls.length > 0
        ) {
          toolCalls = conversationResult.toolCalls;
          this.logger.log(
            `Direct LangChain execution made ${toolCalls.length} tool calls`
          );
        }
      }

      return {
        response: llmResponse,
        topics: result.recentTopics,
        toolCalls,
      };
    } catch (error) {
      this.logger.error(`Error executing conversation graph: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current context for a profile
   */
  async getProfileContext(profileId: string) {
    return this.contextStorage.getContext(profileId);
  }

  /**
   * Clear context for a profile
   */
  async clearProfileContext(profileId: string) {
    return this.contextStorage.deleteContext(profileId);
  }

  /**
   * Get context statistics
   */
  async getContextStats() {
    return this.contextStorage.getStats();
  }
}
