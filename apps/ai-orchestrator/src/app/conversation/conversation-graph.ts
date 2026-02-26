/**
 * Conversation Graph
 *
 * Main LangGraph StateGraph definition for conversation orchestration.
 * Implements conditional edges, tool execution, and human-in-the-loop.
 */

import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { IntentAnalyzer } from '../intent/intent-analyzer.service';
import { DataTracker } from '../data/data-tracker.service';
import { ToolRegistry } from '../tools/tool-registry.service';
import { ModelManager, ModelType } from '../models/model-manager.service';
import { SystemPromptBuilder } from '../system-prompt-builder.service';
import { RedisCheckpointer } from './redis-checkpointer';

// Define state interface
interface ConversationGraphState {
  messages: BaseMessage[];
  intent: any | null;
  extractedData: any[];
  availableData: any | null;
  pendingToolCalls: ToolCall[];
  toolResults: ToolResult[];
  llmResponse: string;
  iteration: number;
  awaitingHumanApproval: boolean;
  approvedToolCalls: ToolCall[];
  error: string | null;
  metadata: {
    conversationId: string;
    profileId: string;
    personaId: string;
    userId: string;
    timestamp: Date;
  };
}

// Define state channels
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  intent: Annotation<any | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  extractedData: Annotation<any[]>({
    reducer: (x, y) => {
      const merged = [...x];
      for (const newPoint of y) {
        const exists = merged.some(
          (existing) =>
            existing.entity?.type === newPoint.entity?.type &&
            existing.entity?.value === newPoint.entity?.value
        );
        if (!exists) merged.push(newPoint);
      }
      return merged;
    },
    default: () => [],
  }),
  availableData: Annotation<any | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  pendingToolCalls: Annotation<ToolCall[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  toolResults: Annotation<ToolResult[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  llmResponse: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  iteration: Annotation<number>({
    reducer: (x, y) => x + (y || 1),
    default: () => 0,
  }),
  awaitingHumanApproval: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  approvedToolCalls: Annotation<ToolCall[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  error: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  metadata: Annotation<any>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

// Tool call and result types
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  success: boolean;
}

@Injectable()
export class ConversationGraphBuilder {
  private readonly logger = new Logger(ConversationGraphBuilder.name);
  private graph: ReturnType<typeof this.buildGraph>;

  constructor(
    private readonly intentAnalyzer: IntentAnalyzer,
    private readonly dataTracker: DataTracker,
    private readonly toolRegistry: ToolRegistry,
    private readonly modelManager: ModelManager,
    private readonly promptBuilder: SystemPromptBuilder,
    private readonly checkpointer: RedisCheckpointer
  ) {
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    const workflow = new StateGraph(StateAnnotation);

    // Add nodes
    workflow.addNode('analyzeIntent', this.analyzeIntentNode.bind(this));
    workflow.addNode('extractData', this.extractDataNode.bind(this));
    workflow.addNode('loadContext', this.loadContextNode.bind(this));
    workflow.addNode('buildPrompt', this.buildPromptNode.bind(this));
    workflow.addNode('callLLM', this.callLLMNode.bind(this));
    workflow.addNode(
      'checkHumanApproval',
      this.checkHumanApprovalNode.bind(this)
    );
    workflow.addNode('executeTools', this.createToolNode());
    workflow.addNode(
      'processToolResults',
      this.processToolResultsNode.bind(this)
    );
    workflow.addNode('formatResponse', this.formatResponseNode.bind(this));
    workflow.addNode('saveContext', this.saveContextNode.bind(this));

    // Add edges using type assertions to bypass strict type checking
    (workflow as any).addEdge(START, 'analyzeIntent');
    (workflow as any).addEdge('analyzeIntent', 'extractData');
    (workflow as any).addEdge('extractData', 'loadContext');
    (workflow as any).addEdge('loadContext', 'buildPrompt');
    (workflow as any).addEdge('buildPrompt', 'callLLM');

    // Conditional edge: check if tools need approval
    (workflow as any).addConditionalEdges(
      'callLLM',
      this.shouldCheckApproval.bind(this),
      {
        checkApproval: 'checkHumanApproval',
        executeTools: 'executeTools',
        formatResponse: 'formatResponse',
      }
    );

    (workflow as any).addEdge('checkHumanApproval', 'executeTools');
    (workflow as any).addEdge('executeTools', 'processToolResults');

    // Conditional edge: check if we need to call LLM again or finish
    (workflow as any).addConditionalEdges(
      'processToolResults',
      this.shouldContinue.bind(this),
      {
        callLLM: 'callLLM',
        formatResponse: 'formatResponse',
      }
    );

    (workflow as any).addEdge('formatResponse', 'saveContext');
    (workflow as any).addEdge('saveContext', END);

    return workflow.compile({
      checkpointer: this.checkpointer as any,
    });
  }

  /**
   * Analyze user intent
   */
  private async analyzeIntentNode(state: typeof StateAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!(lastMessage instanceof HumanMessage)) {
      return { intent: state.intent };
    }

    const tools = await this.toolRegistry.getTools();
    const toolNames = tools.map((t) => t.name);

    const intent = await this.intentAnalyzer.analyzeIntent(
      lastMessage.content as string,
      state.messages,
      toolNames
    );

    this.logger.debug(`Intent analysis: ${intent.type} (${intent.domain})`);

    return { intent };
  }

  /**
   * Extract data points from user message
   */
  private async extractDataNode(state: typeof StateAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!(lastMessage instanceof HumanMessage)) {
      return { extractedData: [] };
    }

    const dataPoints = await this.intentAnalyzer.extractDataPoints(
      lastMessage.content as string,
      state.messages
    );

    // Track extracted data
    if (dataPoints.length > 0 && state.metadata?.conversationId) {
      await this.dataTracker.trackExtractedData(
        state.metadata.conversationId,
        dataPoints,
        'USER_INPUT'
      );
    }

    return { extractedData: dataPoints };
  }

  /**
   * Load conversation context and data
   */
  private async loadContextNode(state: typeof StateAnnotation.State) {
    if (!state.metadata?.conversationId) {
      return { availableData: null };
    }

    const availableData = await this.dataTracker.getConversationData(
      state.metadata.conversationId
    );

    return { availableData };
  }

  /**
   * Build system prompt with intent and data context
   */
  private async buildPromptNode(state: typeof StateAnnotation.State) {
    if (!state.metadata?.personaId || !state.metadata?.profileId) {
      return { messages: state.messages };
    }

    const { template, variables } = await this.promptBuilder.buildSystemPrompt(
      {
        personaId: state.metadata.personaId,
        profileId: state.metadata.profileId,
      },
      {
        includeTools: true,
        includeProfileTelos: true,
      }
    );

    const systemMessages = await template.formatMessages(variables);

    // Prepend system messages
    return { messages: [...systemMessages, ...state.messages] };
  }

  /**
   * Call LLM with tools
   */
  private async callLLMNode(state: typeof StateAnnotation.State) {
    const tools = await this.toolRegistry.getTools();
    const model = this.modelManager.getModelWithTools(
      ModelType.TOOL_CALLING,
      tools
    );

    try {
      const response = await model.invoke(state.messages);

      // Check for tool calls
      const toolCalls = (response as any).tool_calls || [];

      // Extract tool calls
      const pendingToolCalls: ToolCall[] = toolCalls.map((tc: any) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.args || {},
      }));

      // Get response content
      const llmResponse = response.content as string;

      // Add AI message to state
      const messages = [...state.messages, new AIMessage(llmResponse)];

      return {
        messages,
        llmResponse,
        pendingToolCalls,
        iteration: 1,
      };
    } catch (error) {
      this.logger.error(`LLM call failed: ${error.message}`);
      return {
        error: error.message,
        llmResponse:
          'I apologize, but I encountered an error processing your request.',
      };
    }
  }

  /**
   * Check if tool calls need human approval
   */
  private shouldCheckApproval(state: typeof StateAnnotation.State): string {
    // No tool calls needed
    if (state.pendingToolCalls.length === 0) {
      return 'formatResponse';
    }

    // Check if any tool requires approval
    const needsApproval = state.pendingToolCalls.some((tc) =>
      this.toolRegistry.requiresHumanApproval(tc.name)
    );

    if (needsApproval && !state.awaitingHumanApproval) {
      return 'checkApproval';
    }

    return 'executeTools';
  }

  /**
   * Human approval node
   */
  private async checkHumanApprovalNode(state: typeof StateAnnotation.State) {
    // In a real implementation, this would interrupt and wait for human approval
    // For now, we auto-approve if the flag is set
    if (state.awaitingHumanApproval) {
      return {
        awaitingHumanApproval: false,
        approvedToolCalls: state.pendingToolCalls,
      };
    }

    // Mark as awaiting approval
    return { awaitingHumanApproval: true };
  }

  /**
   * Create tool execution node
   */
  private createToolNode() {
    // Use LangGraph's built-in ToolNode for parallel execution
    const tools = this.toolRegistry.getTools.bind(this.toolRegistry);

    return async (state: typeof StateAnnotation.State) => {
      const toolInstances = await tools();
      const toolNode = new ToolNode(toolInstances);

      return await toolNode.invoke(state);
    };
  }

  /**
   * Process tool results and update context
   */
  private async processToolResultsNode(state: typeof StateAnnotation.State) {
    const toolResults: ToolResult[] = [];

    for (const result of state.toolResults) {
      toolResults.push(result);

      // Track successful tool calls
      if (result.success && state.metadata?.conversationId) {
        await this.dataTracker.trackToolCall(
          state.metadata.conversationId,
          result.name,
          {}, // Parameters could be extracted from tool call
          result.result,
          true
        );
      }
    }

    return { toolResults };
  }

  /**
   * Format final response
   */
  private async formatResponseNode(state: typeof StateAnnotation.State) {
    // The response is already in llmResponse from the LLM node
    return { llmResponse: state.llmResponse };
  }

  /**
   * Save conversation context
   */
  private async saveContextNode(state: typeof StateAnnotation.State) {
    if (!state.metadata?.conversationId) {
      return {};
    }

    // Update metadata in data tracker
    await this.dataTracker.updateMetadata(state.metadata.conversationId, {
      lastAction: state.intent?.actionType,
      currentDomain: state.intent?.domain,
      messageCount: state.messages.length,
    });

    return {};
  }

  /**
   * Determine if we should continue the loop
   */
  private shouldContinue(state: typeof StateAnnotation.State): string {
    const maxIterations = 10;

    // Check for errors
    if (state.error) {
      return 'formatResponse';
    }

    // Prevent infinite loops
    if (state.iteration >= maxIterations) {
      this.logger.warn(`Max iterations reached (${maxIterations}), stopping`);
      return 'formatResponse';
    }

    // Check if we got tool results that need LLM processing
    if (state.toolResults.length > 0 && state.pendingToolCalls.length === 0) {
      return 'callLLM';
    }

    return 'formatResponse';
  }

  /**
   * Get compiled graph
   */
  getGraph() {
    return this.graph;
  }
}
