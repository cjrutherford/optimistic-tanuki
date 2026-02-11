/**
 * Conversation State Types
 *
 * Type definitions for the conversation state graph.
 */

import {
  BaseMessage,
  AIMessage,
} from '@langchain/core/messages';
// Define local interfaces to avoid circular imports
export interface IntentClassification {
  type: 'INFORMATIONAL' | 'ACTION' | 'CLARIFICATION' | 'CONVERSATIONAL';
  domain: 'PROJECT' | 'TASK' | 'RISK' | 'CHANGE' | 'JOURNAL' | 'GENERAL';
  confidence: number;
  actionType?: 'CREATE' | 'UPDATE' | 'DELETE' | 'LIST' | 'QUERY' | 'ANALYZE';
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

export interface ConversationDataStore {
  conversationId: string;
  extractedEntities: Map<string, any>;
  resolvedIds: Map<string, string>;
  mentionedProjects: Array<{ id?: string; name: string; confidence: number }>;
  mentionedTasks: Array<{
    id?: string;
    title: string;
    projectId?: string;
    confidence: number;
  }>;
  toolCallHistory: Array<any>;
  lastToolCall?: any;
  metadata: {
    currentDomain?: string;
    lastAction?: string;
    pendingClarification?: string;
    messageCount: number;
  };
}
import { PersonaTelosDto, ProfileDto } from '@optimistic-tanuki/models';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  success: boolean;
}

export interface ConversationState {
  // Core messages
  messages: BaseMessage[];

  // Intent analysis
  intent: IntentClassification | null;
  extractedData: ExtractedDataPoint[];

  // Data tracking
  availableData: ConversationDataStore | null;

  // Tool calls and results
  pendingToolCalls: ToolCall[];
  toolResults: ToolResult[];

  // LLM response
  llmResponse: string;

  // Iteration counter for loop prevention
  iteration: number;

  // Human-in-the-loop flag
  awaitingHumanApproval: boolean;
  approvedToolCalls: ToolCall[];

  // Error tracking
  error: string | null;

  // Metadata
  metadata: {
    conversationId: string;
    profileId: string;
    personaId: string;
    userId: string;
    timestamp: Date;
  };
}

export interface ConversationConfig {
  conversationId: string;
  profile: ProfileDto;
  persona: PersonaTelosDto;
  enableHumanApproval?: boolean;
  maxIterations?: number;
  metadata: {
    conversationId: string;
    profileId: string;
    personaId: string;
    userId: string;
    timestamp: Date;
  };
}

// State channel reducers
export const messagesReducer = (
  current: BaseMessage[],
  next: BaseMessage[]
) => {
  return [...current, ...next];
};

export const toolResultsReducer = (
  current: ToolResult[],
  next: ToolResult[]
) => {
  return [...current, ...next];
};

export const pendingToolCallsReducer = (
  current: ToolCall[],
  next: ToolCall[]
) => {
  return [...current, ...next];
};

export const extractedDataReducer = (
  current: ExtractedDataPoint[],
  next: ExtractedDataPoint[]
) => {
  // Merge avoiding duplicates based on entity type and value
  const merged = [...current];
  for (const newPoint of next) {
    const exists = merged.some(
      (existing) =>
        existing.entity.type === newPoint.entity.type &&
        existing.entity.value === newPoint.entity.value
    );
    if (!exists) {
      merged.push(newPoint);
    }
  }
  return merged;
};
