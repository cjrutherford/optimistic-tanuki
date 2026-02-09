/**
 * LangGraph Service for State Management
 *
 * Manages conversation state using LangGraph
 * Handles context building, topic extraction, and state persistence
 * LLM execution is handled by LangChainAgentService which uses
 * LangGraph's prebuilt React agent internally
 */

import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import {
  ChatMessage,
  ProfileDto,
  PersonaTelosDto,
} from '@optimistic-tanuki/models';
import { ContextStorageService } from './context-storage.service';
import { LangChainService } from './langchain.service';
import { LangChainAgentService } from './langchain-agent.service';

function getConversationState() {
  const AnnotationRuntime = Annotation;

  return AnnotationRuntime.Root({
    messages: AnnotationRuntime<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
      default: () => [],
    }),
    chatHistory: AnnotationRuntime<ChatMessage[]>({
      reducer: (x, y) => x.concat(y),
      default: () => [],
    }),
    profileId: AnnotationRuntime<string>({
      reducer: (x, y) => y ?? x,
      default: () => '',
    }),
    summary: AnnotationRuntime<string>({
      reducer: (x, y) => y ?? x,
      default: () => '',
    }),
    activeProjects: AnnotationRuntime<string[]>({
      reducer: (x, y) => Array.from(new Set([...x, ...y])),
      default: () => [],
    }),
    recentTopics: AnnotationRuntime<string[]>({
      reducer: (x, y) => Array.from(new Set([...x, ...y])).slice(-10),
      default: () => [],
    }),
    toolCallsCount: AnnotationRuntime<number>({
      reducer: (x, y) => x + y,
      default: () => 0,
    }),
    lastToolCalled: AnnotationRuntime<string | null>({
      reducer: (x, y) => y ?? x,
      default: () => null,
    }),
    iteration: AnnotationRuntime<number>({
      reducer: (x, y) => x + 1,
      default: () => 0,
    }),
    shouldContinue: AnnotationRuntime<boolean>({
      reducer: (x, y) => y ?? x,
      default: () => true,
    }),
    metadata: AnnotationRuntime<Record<string, unknown>>({
      reducer: (x, y) => ({ ...x, ...y }),
      default: () => ({}),
    }),
  });
}

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

  private buildGraph() {
    const workflow = new StateGraph(getConversationState());

    workflow.addNode('loadContext', this.loadContextNode.bind(this));
    workflow.addNode('extractTopics', this.extractTopicsNode.bind(this));
    workflow.addNode('updateSummary', this.updateSummaryNode.bind(this));
    workflow.addNode('saveContext', this.saveContextNode.bind(this));

    (workflow as any).addEdge(START, 'loadContext');
    (workflow as any).addEdge('loadContext', 'extractTopics');
    (workflow as any).addEdge('extractTopics', 'updateSummary');
    (workflow as any).addEdge('updateSummary', 'saveContext');
    (workflow as any).addEdge('saveContext', END);

    return workflow.compile();
  }

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

  private async extractTopicsNode(
    state: ConversationStateType
  ): Promise<Partial<ConversationStateType>> {
    try {
      const lastMessages = state.messages.slice(-3);
      const topics: string[] = [];

      for (const message of lastMessages) {
        const content = this.normalizeContent(message.content).toLowerCase();
        if (content.includes('project')) topics.push('projects');
        if (content.includes('task')) topics.push('tasks');
        if (content.includes('risk')) topics.push('risks');
        if (content.includes('change')) topics.push('changes');
        if (content.includes('journal') || content.includes('note'))
          topics.push('journal');
      }

      return { recentTopics: topics };
    } catch (error) {
      this.logger.error(`Error extracting topics: ${error.message}`);
      return {};
    }
  }

  private async updateSummaryNode(
    state: ConversationStateType
  ): Promise<Partial<ConversationStateType>> {
    try {
      const lastMessage = state.messages[state.messages.length - 1];
      let summary = `Last: ${this.normalizeContent(lastMessage?.content).slice(
        0,
        100
      )}... Topics: ${state.recentTopics.join(', ')}`;
      if (state.lastToolCalled) {
        summary += `. Previous tool: ${state.lastToolCalled}.`;
      }
      return { summary };
    } catch (error) {
      this.logger.error(`Error updating summary: ${error.message}`);
      return {};
    }
  }

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

  async executeConversation(
    profileId: string,
    messages: BaseMessage[],
    chatHistory: ChatMessage[],
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
      summary: '',
      iteration: 0,
    };

    try {
      const result = await this.graph.invoke(initialState);
      this.logger.log('Graph execution complete, now executing LLM...');

      let llmResponse: string;
      let toolCalls: Array<{ tool: string; input: unknown; output: unknown }> =
        [];

      if (useAgent && this.agent && this.agent.isInitialized()) {
        this.logger.log('Using Agent for multi-step execution');
        const lastMessage = messages[messages.length - 1];
        const userInput = this.normalizeContent(lastMessage?.content);

        const agentResult = await this.agent.executeAgent(
          userInput,
          messages.slice(0, -1),
          profile,
          persona,
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
        const conversationResult = await this.langchain.executeConversation(
          persona,
          profile,
          result.chatHistory.slice(0, -1),
          this.normalizeContent(messages[messages.length - 1]?.content),
          conversationId,
          onProgress
        );

        llmResponse = conversationResult.response;
        if (
          conversationResult.toolCalls &&
          conversationResult.toolCalls.length > 0
        ) {
          toolCalls = conversationResult.toolCalls;
        }
      }

      return {
        response: llmResponse,
        topics: result.recentTopics,
        toolCalls,
      };
    } catch (error) {
      this.logger.error(`Error executing conversation: ${error.message}`);
      throw error;
    }
  }

  async getProfileContext(profileId: string) {
    return this.contextStorage.getContext(profileId);
  }

  async clearProfileContext(profileId: string) {
    return this.contextStorage.deleteContext(profileId);
  }

  async getContextStats() {
    return this.contextStorage.getStats();
  }
}
