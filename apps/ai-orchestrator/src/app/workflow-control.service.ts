/**
 * Workflow Control Service
 *
 * Detects whether a prompt requires tool calling, conversational response, or both
 * Uses a lightweight model for fast classification
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ModelInitializerService } from './model-initializer.service';

export enum WorkflowType {
  CONVERSATIONAL = 'conversational',
  TOOL_CALLING = 'tool_calling',
  HYBRID = 'hybrid', // Requires both tool calling and conversational response
}

export interface WorkflowDecision {
  type: WorkflowType;
  confidence: number;
  reasoning?: string;
  requiresToolCalling: boolean;
  requiresConversation: boolean;
}

@Injectable()
export class WorkflowControlService {
  private readonly logger = new Logger(WorkflowControlService.name);
  private workflowControlLLM: ChatOllama | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly modelInitializer: ModelInitializerService
  ) {
    this.initializeWorkflowModel();
  }

  /**
   * Initialize the workflow control model
   */
  private initializeWorkflowModel(): void {
    try {
      const modelConfig =
        this.modelInitializer.getModelConfig('workflow_control');

      if (!modelConfig) {
        this.logger.warn(
          'Workflow control model not configured, using default conversational model'
        );
        return;
      }

      const ollama = this.config.get<{ host: string; port: number }>('ollama');
      const baseUrl =
        ollama?.host && ollama?.port
          ? `http://${ollama.host}:${ollama.port}`
          : 'http://prompt-proxy:11434';

      this.workflowControlLLM = new ChatOllama({
        model: modelConfig.name,
        baseUrl,
        temperature: modelConfig.temperature,
      });

      this.logger.log(
        `Initialized workflow control model: ${modelConfig.name}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize workflow control model: ${error.message}`
      );
    }
  }

  /**
   * Detect workflow type for a given prompt
   */
  async detectWorkflow(
    userPrompt: string,
    availableTools: string[] = [],
    conversationContext?: string
  ): Promise<WorkflowDecision> {
    // Fallback to heuristic detection if workflow model is not available
    if (!this.workflowControlLLM) {
      return this.heuristicDetection(userPrompt, availableTools);
    }

    try {
      const systemPrompt = this.createWorkflowDetectionPrompt(availableTools);
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ];

      if (conversationContext) {
        messages.splice(
          1,
          0,
          new SystemMessage(`Context: ${conversationContext}`)
        );
      }

      const response = await this.workflowControlLLM.invoke(messages);
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      return this.parseWorkflowResponse(content);
    } catch (error) {
      this.logger.error(
        `Error detecting workflow: ${error.message}, falling back to heuristic`
      );
      return this.heuristicDetection(userPrompt, availableTools);
    }
  }

  /**
   * Create a prompt for workflow detection
   */
  private createWorkflowDetectionPrompt(availableTools: string[]): string {
    const toolsList =
      availableTools.length > 0
        ? `Available tools: ${availableTools.join(', ')}`
        : 'No tools currently available';

    return `You are a workflow classifier. Your job is to analyze user prompts and determine the best workflow type.

${toolsList}

Classify the user's prompt into one of these workflows:
1. CONVERSATIONAL - Simple question/answer, greeting, or general conversation that doesn't require external data or actions
2. TOOL_CALLING - Request requires executing tools/actions (creating, updating, listing, querying data)
3. HYBRID - Request requires both tool execution AND a conversational explanation

Respond ONLY with a JSON object in this exact format:
{
  "type": "conversational" | "tool_calling" | "hybrid",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "requiresToolCalling": boolean,
  "requiresConversation": boolean
}

Examples:
- "Hello, how are you?" → conversational
- "Create a project called Website Redesign" → tool_calling
- "What projects do I have and tell me about them?" → hybrid
- "Update task status to done" → tool_calling
- "Explain TELOS framework" → conversational
- "Show me my tasks and explain which ones are urgent" → hybrid`;
  }

  /**
   * Parse the workflow detection response
   */
  private parseWorkflowResponse(response: string): WorkflowDecision {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type ?? WorkflowType.CONVERSATIONAL,
          confidence: parsed.confidence ?? 0.7,
          reasoning: parsed.reasoning,
          requiresToolCalling: parsed.requiresToolCalling ?? false,
          requiresConversation: parsed.requiresConversation ?? true,
        };
      }

      // Fallback to text parsing
      const lower = response.toLowerCase();
      if (lower.includes('tool_calling')) {
        return {
          type: WorkflowType.TOOL_CALLING,
          confidence: 0.7,
          requiresToolCalling: true,
          requiresConversation: false,
        };
      } else if (lower.includes('hybrid')) {
        return {
          type: WorkflowType.HYBRID,
          confidence: 0.7,
          requiresToolCalling: true,
          requiresConversation: true,
        };
      }

      return {
        type: WorkflowType.CONVERSATIONAL,
        confidence: 0.7,
        requiresToolCalling: false,
        requiresConversation: true,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to parse workflow response: ${error.message}, defaulting to conversational`
      );
      return {
        type: WorkflowType.CONVERSATIONAL,
        confidence: 0.5,
        requiresToolCalling: false,
        requiresConversation: true,
      };
    }
  }

  /**
   * Heuristic-based workflow detection (fallback)
   */
  private heuristicDetection(
    userPrompt: string,
    availableTools: string[]
  ): WorkflowDecision {
    const lower = userPrompt.toLowerCase();

    // Keywords indicating tool calling
    const toolKeywords = [
      'create',
      'update',
      'delete',
      'add',
      'remove',
      'list',
      'show',
      'get',
      'find',
      'query',
      'search',
      'set',
      'change',
      'modify',
    ];

    // Keywords indicating conversational only
    const conversationalKeywords = [
      'what is',
      'explain',
      'how does',
      'tell me about',
      'hello',
      'hi',
      'thanks',
      'thank you',
    ];

    // Keywords indicating hybrid (tool + explanation)
    const hybridKeywords = [
      'and tell me',
      'and explain',
      'and describe',
      'show me',
      'what are my',
      'list my',
    ];

    // Check for hybrid first
    if (hybridKeywords.some((keyword) => lower.includes(keyword))) {
      return {
        type: WorkflowType.HYBRID,
        confidence: 0.8,
        requiresToolCalling: true,
        requiresConversation: true,
      };
    }

    // Check for conversational only
    if (
      conversationalKeywords.some((keyword) => lower.includes(keyword)) &&
      !toolKeywords.some((keyword) => lower.includes(keyword))
    ) {
      return {
        type: WorkflowType.CONVERSATIONAL,
        confidence: 0.8,
        requiresToolCalling: false,
        requiresConversation: true,
      };
    }

    // Check for tool calling
    if (toolKeywords.some((keyword) => lower.includes(keyword))) {
      return {
        type: WorkflowType.TOOL_CALLING,
        confidence: 0.7,
        requiresToolCalling: true,
        requiresConversation: false,
      };
    }

    // Default to conversational
    return {
      type: WorkflowType.CONVERSATIONAL,
      confidence: 0.6,
      requiresToolCalling: false,
      requiresConversation: true,
    };
  }

  /**
   * Extract thinking tokens from model response
   * Returns both the thinking content and the filtered response
   */
  extractThinkingTokens(response: string): {
    thinking: string[];
    filtered: string;
  } {
    const thinking: string[] = [];

    // Extract <think> blocks
    const thinkMatches = response.match(/<think>([\s\S]*?)<\/think>/gi);
    if (thinkMatches) {
      thinkMatches.forEach((match) => {
        const content = match.replace(/<\/?think>/gi, '').trim();
        if (content) thinking.push(content);
      });
    }

    // Extract [THINKING] blocks
    const thinkingMatches = response.match(/\[THINKING\]([\s\S]*?)\[\/THINKING\]/gi);
    if (thinkingMatches) {
      thinkingMatches.forEach((match) => {
        const content = match.replace(/\[\/?(THINKING)\]/gi, '').trim();
        if (content) thinking.push(content);
      });
    }

    // Extract **Thinking:** blocks
    const thinkingHeaderMatches = response.match(/\*\*Thinking:?\*\*([\s\S]*?)\n\n/gi);
    if (thinkingHeaderMatches) {
      thinkingHeaderMatches.forEach((match) => {
        const content = match.replace(/\*\*Thinking:?\*\*/gi, '').trim();
        if (content) thinking.push(content);
      });
    }

    // Filter out thinking tokens
    const filtered = this.filterThinkingTokens(response);

    return { thinking, filtered };
  }

  /**
   * Filter thinking tokens from model response
   * DeepSeek and similar models often output thinking tokens in <think> tags
   */
  filterThinkingTokens(response: string): string {
    // Combined regex pattern for all thinking token types
    const thinkingPattern = /<think>[\s\S]*?<\/think>|\[THINKING\][\s\S]*?\[\/THINKING\]|\*\*Thinking:?\*\*[\s\S]*?\n\n/gi;
    
    let filtered = response.replace(thinkingPattern, '');

    // Clean up extra whitespace
    filtered = filtered.trim().replace(/\n{3,}/g, '\n\n');

    return filtered;
  }
}
