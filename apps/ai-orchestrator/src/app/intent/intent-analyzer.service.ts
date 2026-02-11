/**
 * Intent Analyzer Service
 *
 * Provides intelligent intent classification using hybrid approach:
 * - Fast heuristic analysis for common patterns
 * - LLM-based analysis for ambiguous cases
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseMessage } from '@langchain/core/messages';
import { ModelManager, ModelType } from '../models/model-manager.service';

export type IntentType =
  | 'INFORMATIONAL'
  | 'ACTION'
  | 'CLARIFICATION'
  | 'CONVERSATIONAL';
export type IntentDomain =
  | 'PROJECT'
  | 'TASK'
  | 'RISK'
  | 'CHANGE'
  | 'JOURNAL'
  | 'GENERAL';
export type ActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LIST'
  | 'QUERY'
  | 'ANALYZE';

export interface IntentClassification {
  type: IntentType;
  domain: IntentDomain;
  confidence: number;
  actionType?: ActionType;
  suggestedTools: string[];
  missingContext: string[];
  ambiguityScore: number;
  reasoning: string;
}

export interface ExtractedEntity {
  type:
    | 'PROJECT_NAME'
    | 'TASK_TITLE'
    | 'RISK_TITLE'
    | 'CHANGE_TITLE'
    | 'ID'
    | 'STATUS'
    | 'PRIORITY'
    | 'DATE'
    | 'USER'
    | 'ENTITY_REF';
  value: string;
  confidence: number;
  position: number;
}

export interface ExtractedDataPoint {
  entity: ExtractedEntity;
  source: 'EXPLICIT' | 'INFERRED';
  messageIndex: number;
}

@Injectable()
export class IntentAnalyzer {
  private readonly logger = new Logger(IntentAnalyzer.name);

  // Confidence threshold for using heuristic result
  private readonly HEURISTIC_CONFIDENCE_THRESHOLD = 0.85;

  constructor(private readonly modelManager: ModelManager) {}

  /**
   * Analyze user message intent using hybrid approach
   */
  async analyzeIntent(
    message: string,
    history: BaseMessage[],
    availableTools: string[]
  ): Promise<IntentClassification> {
    // First, try fast heuristic analysis
    const heuristicResult = this.heuristicAnalysis(message, availableTools);

    if (heuristicResult.confidence >= this.HEURISTIC_CONFIDENCE_THRESHOLD) {
      this.logger.debug(
        `Using heuristic intent analysis (confidence: ${heuristicResult.confidence})`
      );
      return heuristicResult;
    }

    // Fall back to LLM analysis for ambiguous cases
    this.logger.debug(
      `Heuristic confidence low (${heuristicResult.confidence}), using LLM analysis`
    );
    return this.llmAnalysis(message, history, availableTools);
  }

  /**
   * Extract entities and data points from message
   */
  async extractDataPoints(
    message: string,
    history: BaseMessage[]
  ): Promise<ExtractedDataPoint[]> {
    const dataPoints: ExtractedDataPoint[] = [];
    const lowerMessage = message.toLowerCase();

    // Extract project names (patterns like "project X", "the X project")
    const projectPatterns = [
      /(?:project|for)\s+["']?([^"']{2,50})["']?(?:\s+project)?/gi,
      /(?:called|named)\s+["']?([^"']{2,50})["']?/gi,
    ];

    for (const pattern of projectPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        if (match[1] && match[1].length > 2) {
          dataPoints.push({
            entity: {
              type: 'PROJECT_NAME',
              value: match[1].trim(),
              confidence: 0.8,
              position: match.index,
            },
            source: 'EXPLICIT',
            messageIndex: 0,
          });
        }
      }
    }

    // Extract task titles
    const taskPatterns = [/(?:task|todo|to-do)\s+["']?([^"']{2,100})["']?/gi];

    for (const pattern of taskPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        if (match[1] && match[1].length > 2) {
          dataPoints.push({
            entity: {
              type: 'TASK_TITLE',
              value: match[1].trim(),
              confidence: 0.75,
              position: match.index,
            },
            source: 'EXPLICIT',
            messageIndex: 0,
          });
        }
      }
    }

    // Extract UUIDs
    const uuidPattern =
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
    let uuidMatch;
    while ((uuidMatch = uuidPattern.exec(message)) !== null) {
      dataPoints.push({
        entity: {
          type: 'ID',
          value: uuidMatch[0],
          confidence: 0.95,
          position: uuidMatch.index,
        },
        source: 'EXPLICIT',
        messageIndex: 0,
      });
    }

    // Extract status values
    const statusPattern =
      /\b(todo|in[-_]?progress|done|archived|planning|active|completed)\b/gi;
    let statusMatch;
    while ((statusMatch = statusPattern.exec(lowerMessage)) !== null) {
      dataPoints.push({
        entity: {
          type: 'STATUS',
          value: statusMatch[0].toUpperCase().replace(/[-_]/g, '_'),
          confidence: 0.9,
          position: statusMatch.index,
        },
        source: 'EXPLICIT',
        messageIndex: 0,
      });
    }

    // Extract priority values
    const priorityPattern = /\b(low|medium|high)\s*(?:priority)?\b/gi;
    let priorityMatch;
    while ((priorityMatch = priorityPattern.exec(lowerMessage)) !== null) {
      dataPoints.push({
        entity: {
          type: 'PRIORITY',
          value: priorityMatch[0].toUpperCase(),
          confidence: 0.85,
          position: priorityMatch.index,
        },
        source: 'EXPLICIT',
        messageIndex: 0,
      });
    }

    return dataPoints;
  }

  /**
   * Determine which tools are relevant to the intent
   */
  determineRelevantTools(
    intent: IntentClassification,
    availableTools: string[]
  ): string[] {
    const relevant: string[] = [];

    // Map intent to likely tools
    const toolMapping: Record<string, string[]> = {
      PROJECT: [
        'list_projects',
        'query_projects',
        'create_project',
        'update_project',
        'delete_project',
      ],
      TASK: ['list_tasks', 'create_task', 'update_task', 'delete_task'],
      RISK: ['list_risks', 'create_risk', 'update_risk', 'delete_risk'],
      CHANGE: [
        'list_changes',
        'create_change',
        'update_change',
        'delete_change',
      ],
      JOURNAL: ['list_journal_entries', 'create_journal_entry'],
    };

    if (intent.domain !== 'GENERAL' && toolMapping[intent.domain]) {
      const domainTools = toolMapping[intent.domain];

      if (intent.actionType) {
        // Filter by action type
        const actionPrefix = intent.actionType.toLowerCase();
        const filtered = domainTools.filter((t) => t.includes(actionPrefix));
        if (filtered.length > 0) {
          relevant.push(...filtered);
        }
      }

      // Add list/query tools for all action types
      const listTools = domainTools.filter(
        (t) => t.startsWith('list_') || t.startsWith('query_')
      );
      relevant.push(...listTools);
    }

    // Always include list_tools for discovery
    if (!relevant.includes('list_tools')) {
      relevant.unshift('list_tools');
    }

    // Filter to only available tools
    return relevant.filter((t) => availableTools.includes(t));
  }

  /**
   * Fast heuristic-based intent analysis
   */
  private heuristicAnalysis(
    message: string,
    availableTools: string[]
  ): IntentClassification {
    const lower = message.toLowerCase();
    let confidence = 0.7;
    let reasoning = 'Heuristic pattern matching';

    // Determine intent type
    let type: IntentType = 'CONVERSATIONAL';
    let actionType: ActionType | undefined;

    // Action keywords
    const actionKeywords: Record<ActionType, string[]> = {
      CREATE: ['create', 'make', 'add', 'new', 'start'],
      UPDATE: ['update', 'change', 'modify', 'edit', 'set'],
      DELETE: ['delete', 'remove', 'archive', 'clear'],
      LIST: ['list', 'show', 'display', 'get all', 'view all'],
      QUERY: ['find', 'search', 'query', 'get', 'show me', 'look up'],
      ANALYZE: ['analyze', 'summarize', 'report', 'compare'],
    };

    for (const [action, keywords] of Object.entries(actionKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        actionType = action as ActionType;
        type = 'ACTION';
        confidence += 0.1;
        break;
      }
    }

    // Informational keywords
    const informationalKeywords = [
      'what is',
      'how do',
      'explain',
      'tell me about',
      'what are',
    ];
    if (informationalKeywords.some((kw) => lower.includes(kw))) {
      type = 'INFORMATIONAL';
      confidence += 0.05;
    }

    // Greeting keywords
    const greetingKeywords = [
      'hello',
      'hi',
      'hey',
      'good morning',
      'good afternoon',
    ];
    if (
      greetingKeywords.some((kw) => lower.includes(kw)) &&
      message.length < 50
    ) {
      type = 'CONVERSATIONAL';
      actionType = undefined;
      confidence = 0.95;
      reasoning = 'Greeting detected';
    }

    // Determine domain
    let domain: IntentDomain = 'GENERAL';
    const domainKeywords: Record<IntentDomain, string[]> = {
      PROJECT: ['project', 'initiative', 'endeavor'],
      TASK: ['task', 'todo', 'to-do', 'action item'],
      RISK: ['risk', 'issue', 'problem', 'concern'],
      CHANGE: ['change', 'change request', 'modification'],
      JOURNAL: ['journal', 'entry', 'note', 'log'],
      GENERAL: [],
    };

    for (const [dom, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        domain = dom as IntentDomain;
        confidence += 0.1;
        break;
      }
    }

    // Calculate ambiguity
    const ambiguityScore = this.calculateAmbiguity(message, type, domain);

    // Adjust confidence based on ambiguity
    confidence -= ambiguityScore * 0.3;

    // Determine suggested tools
    const suggestedTools = this.suggestToolsFromHeuristics(
      type,
      domain,
      actionType,
      availableTools
    );

    // Determine missing context
    const missingContext = this.identifyMissingContext(type, domain, message);

    return {
      type,
      domain,
      confidence: Math.min(confidence, 1.0),
      actionType,
      suggestedTools,
      missingContext,
      ambiguityScore,
      reasoning,
    };
  }

  /**
   * LLM-based intent analysis for ambiguous cases
   */
  private async llmAnalysis(
    message: string,
    history: BaseMessage[],
    availableTools: string[]
  ): Promise<IntentClassification> {
    const model = this.modelManager.getModel(ModelType.INTENT_ANALYSIS);

    const prompt = `You are an intent classifier. Analyze the user's message and classify it.

Available tools: ${availableTools.join(', ')}

Classify the message into:
- Type: INFORMATIONAL (asking for info), ACTION (wants to do something), CLARIFICATION (asking for clarification), or CONVERSATIONAL (chat/greeting)
- Domain: PROJECT, TASK, RISK, CHANGE, JOURNAL, or GENERAL
- Action (if ACTION type): CREATE, UPDATE, DELETE, LIST, QUERY, or ANALYZE
- Suggested tools: Which tools from the available list would help
- Missing context: What information is missing to complete the request

Respond in JSON format:
{
  "type": "...",
  "domain": "...",
  "actionType": "...",
  "confidence": 0.0-1.0,
  "suggestedTools": ["..."],
  "missingContext": ["..."],
  "ambiguityScore": 0.0-1.0,
  "reasoning": "..."
}

User message: "${message}"`;

    try {
      const response = await model.invoke(prompt);
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type || 'CONVERSATIONAL',
          domain: parsed.domain || 'GENERAL',
          confidence: parsed.confidence || 0.7,
          actionType: parsed.actionType,
          suggestedTools: parsed.suggestedTools || [],
          missingContext: parsed.missingContext || [],
          ambiguityScore: parsed.ambiguityScore || 0.5,
          reasoning: parsed.reasoning || 'LLM analysis',
        };
      }
    } catch (error) {
      this.logger.error(`LLM intent analysis failed: ${error.message}`);
    }

    // Fallback to heuristic if LLM fails
    return this.heuristicAnalysis(message, availableTools);
  }

  /**
   * Calculate ambiguity score
   */
  private calculateAmbiguity(
    message: string,
    type: IntentType,
    domain: IntentDomain
  ): number {
    let score = 0;

    // Short messages are more ambiguous
    if (message.length < 20) score += 0.3;

    // Multiple action keywords = more ambiguous
    const actionWords = [
      'create',
      'update',
      'delete',
      'list',
      'find',
      'add',
      'remove',
    ];
    const actionCount = actionWords.filter((w) =>
      message.toLowerCase().includes(w)
    ).length;
    if (actionCount > 1) score += 0.2;

    // Multiple domain keywords = more ambiguous
    const domainWords = ['project', 'task', 'risk', 'change', 'journal'];
    const domainCount = domainWords.filter((w) =>
      message.toLowerCase().includes(w)
    ).length;
    if (domainCount > 1) score += 0.2;

    // Question marks = potentially informational
    if (message.includes('?') && type === 'ACTION') score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Suggest tools based on heuristic analysis
   */
  private suggestToolsFromHeuristics(
    type: IntentType,
    domain: IntentDomain,
    actionType: ActionType | undefined,
    availableTools: string[]
  ): string[] {
    const suggestions: string[] = [];

    // Always suggest list_tools
    suggestions.push('list_tools');

    // Domain-based suggestions
    const domainPrefix = domain.toLowerCase();

    if (type === 'ACTION' && actionType) {
      const actionPrefix = actionType.toLowerCase();
      const matchingTools = availableTools.filter(
        (t) => t.includes(actionPrefix) && t.includes(domainPrefix)
      );
      suggestions.push(...matchingTools);
    }

    // Query/List suggestions
    if (type === 'INFORMATIONAL' || type === 'ACTION') {
      const listTools = availableTools.filter(
        (t) =>
          (t.startsWith('list_') || t.startsWith('query_')) &&
          t.includes(domainPrefix)
      );
      suggestions.push(...listTools);
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Identify missing context for the request
   */
  private identifyMissingContext(
    type: IntentType,
    domain: IntentDomain,
    message: string
  ): string[] {
    const missing: string[] = [];
    const lower = message.toLowerCase();

    if (type === 'ACTION') {
      if (domain === 'PROJECT') {
        if (!lower.includes('name') && !lower.match(/(?:called|named)\s+/)) {
          missing.push('project name');
        }
      }

      if (domain === 'TASK') {
        if (!lower.includes('title') && !lower.match(/(?:called|named)\s+/)) {
          missing.push('task title');
        }
        if (!lower.includes('project')) {
          missing.push('project reference');
        }
      }
    }

    return missing;
  }
}
