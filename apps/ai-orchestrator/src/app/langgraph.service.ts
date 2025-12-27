/**
 * LangGraph Service for State Management
 * 
 * Manages conversation state using LangGraph
 * Handles context building, tool execution tracking, and state persistence
 */

import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatMessage, ProfileDto } from '@optimistic-tanuki/models';
import { ContextStorageService } from './context-storage.service';
import { LangChainService } from './langchain.service';

/**
 * Conversation state managed by LangGraph
 */
const ConversationState = Annotation.Root({
  // Core conversation data
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y), // Append new messages
    default: () => [],
  }),
  
  // User context
  profileId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  
  // Conversation summary
  summary: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  
  // Active projects being discussed
  activeProjects: Annotation<string[]>({
    reducer: (x, y) => Array.from(new Set([...x, ...y])),
    default: () => [],
  }),
  
  // Recent topics
  recentTopics: Annotation<string[]>({
    reducer: (x, y) => {
      const combined = [...x, ...y];
      // Keep only last 10 unique topics
      return Array.from(new Set(combined)).slice(-10);
    },
    default: () => [],
  }),
  
  // Tool call tracking
  toolCallsCount: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
  
  // Last tool called
  lastToolCalled: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  
  // Current iteration (for max iterations check)
  iteration: Annotation<number>({
    reducer: (x, y) => x + 1,
    default: () => 0,
  }),
  
  // Whether conversation should continue
  shouldContinue: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => true,
  }),
  
  // Additional metadata
  metadata: Annotation<Record<string, unknown>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

type ConversationStateType = typeof ConversationState.State;

@Injectable()
export class LangGraphService {
  private readonly logger = new Logger(LangGraphService.name);
  private graph: ReturnType<typeof this.buildGraph>;

  constructor(
    private readonly contextStorage: ContextStorageService,
    private readonly langchain: LangChainService
  ) {
    this.graph = this.buildGraph();
  }

  /**
   * Build the conversation state graph
   */
  private buildGraph() {
    const workflow = new StateGraph(ConversationState);

    // Define nodes
    workflow.addNode('loadContext', this.loadContextNode.bind(this));
    workflow.addNode('processMessage', this.processMessageNode.bind(this));
    workflow.addNode('extractTopics', this.extractTopicsNode.bind(this));
    workflow.addNode('updateSummary', this.updateSummaryNode.bind(this));
    workflow.addNode('saveContext', this.saveContextNode.bind(this));

    // Define edges
    workflow.addEdge(START, 'loadContext');
    workflow.addEdge('loadContext', 'processMessage');
    workflow.addEdge('processMessage', 'extractTopics');
    workflow.addEdge('extractTopics', 'updateSummary');
    workflow.addEdge('updateSummary', 'saveContext');
    workflow.addEdge('saveContext', END);

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
        const content = message.content.toString().toLowerCase();
        
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
      const summary = `Last discussed: ${lastMessage.content.toString().slice(0, 100)}... Topics: ${state.recentTopics.join(', ')}`;
      
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
    existingSummary?: string
  ): Promise<ConversationStateType> {
    const initialState: Partial<ConversationStateType> = {
      profileId,
      messages,
      summary: existingSummary || '',
      iteration: 0,
    };

    try {
      const result = await this.graph.invoke(initialState);
      return result;
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
