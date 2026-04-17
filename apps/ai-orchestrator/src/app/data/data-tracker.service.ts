/**
 * Data Tracker Service
 *
 * Tracks data points, entities, and context across conversation turns.
 * Provides entity resolution and missing parameter identification.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ContextStorageService } from '../context-storage.service';
import {
  ExtractedDataPoint,
  ExtractedEntity,
} from '../intent/intent-analyzer.service';

export interface EntityInfo {
  type: string;
  value: string;
  confidence: number;
  resolvedId?: string;
  source: 'USER_INPUT' | 'TOOL_RESULT' | 'INFERENCE';
  timestamp: Date;
}

export interface ToolCallRecord {
  toolName: string;
  parameters: Record<string, unknown>;
  result: unknown;
  success: boolean;
  timestamp: Date;
}

export interface ProjectRef {
  id?: string;
  name: string;
  confidence: number;
}

export interface TaskRef {
  id?: string;
  title: string;
  projectId?: string;
  confidence: number;
}

export interface ConversationDataStore {
  conversationId: string;
  extractedEntities: Map<string, EntityInfo>;
  resolvedIds: Map<string, string>; // entityKey -> UUID
  mentionedProjects: ProjectRef[];
  mentionedTasks: TaskRef[];
  toolCallHistory: ToolCallRecord[];
  lastToolCall?: ToolCallRecord;
  metadata: {
    currentDomain?: string;
    lastAction?: string;
    pendingClarification?: string;
    messageCount: number;
  };
}

export interface MissingParameter {
  name: string;
  type: 'REQUIRED' | 'OPTIONAL';
  description?: string;
  suggestedValue?: string;
}

@Injectable()
export class DataTracker {
  private readonly logger = new Logger(DataTracker.name);
  private memoryCache: Map<string, ConversationDataStore> = new Map();

  constructor(private readonly contextStorage: ContextStorageService) {}

  /**
   * Initialize data store for a conversation
   */
  async initializeConversation(
    conversationId: string
  ): Promise<ConversationDataStore> {
    const existing = await this.getConversationData(conversationId);
    if (existing) {
      return existing;
    }

    const newStore: ConversationDataStore = {
      conversationId,
      extractedEntities: new Map(),
      resolvedIds: new Map(),
      mentionedProjects: [],
      mentionedTasks: [],
      toolCallHistory: [],
      metadata: {
        messageCount: 0,
      },
    };

    this.memoryCache.set(conversationId, newStore);
    return newStore;
  }

  /**
   * Get conversation data (from memory cache or storage)
   */
  async getConversationData(
    conversationId: string
  ): Promise<ConversationDataStore | null> {
    // Check memory cache first
    if (this.memoryCache.has(conversationId)) {
      return this.memoryCache.get(conversationId)!;
    }

    // Try to load from context storage
    try {
      const context = await this.contextStorage.getContext(conversationId);
      if (context && context.metadata?.dataStore) {
        const dataStore = this.deserializeDataStore(context.metadata.dataStore);
        this.memoryCache.set(conversationId, dataStore);
        return dataStore;
      }
    } catch (error) {
      this.logger.warn(`Failed to load conversation data: ${error.message}`);
    }

    return null;
  }

  /**
   * Track extracted data points from user input
   */
  async trackExtractedData(
    conversationId: string,
    dataPoints: ExtractedDataPoint[],
    source: 'USER_INPUT' | 'TOOL_RESULT' = 'USER_INPUT'
  ): Promise<void> {
    const store = await this.initializeConversation(conversationId);

    for (const dataPoint of dataPoints) {
      const entity = dataPoint.entity;
      const key = `${entity.type}:${entity.value}`;

      const entityInfo: EntityInfo = {
        type: entity.type,
        value: entity.value,
        confidence: entity.confidence,
        source,
        timestamp: new Date(),
      };

      // Update or add entity
      store.extractedEntities.set(key, entityInfo);

      // Add to domain-specific collections
      if (entity.type === 'PROJECT_NAME') {
        const existing = store.mentionedProjects.find(
          (p) => p.name === entity.value
        );
        if (!existing) {
          store.mentionedProjects.push({
            name: entity.value,
            confidence: entity.confidence,
          });
        }
      }

      if (entity.type === 'TASK_TITLE') {
        const existing = store.mentionedTasks.find(
          (t) => t.title === entity.value
        );
        if (!existing) {
          store.mentionedTasks.push({
            title: entity.value,
            confidence: entity.confidence,
          });
        }
      }

      this.logger.debug(`Tracked entity: ${key} (${source})`);
    }

    store.metadata.messageCount++;
    await this.persistConversationData(store);
  }

  /**
   * Track a tool call and its result
   */
  async trackToolCall(
    conversationId: string,
    toolName: string,
    parameters: Record<string, unknown>,
    result: unknown,
    success: boolean
  ): Promise<void> {
    const store = await this.initializeConversation(conversationId);

    const record: ToolCallRecord = {
      toolName,
      parameters,
      result,
      success,
      timestamp: new Date(),
    };

    store.toolCallHistory.push(record);
    store.lastToolCall = record;

    // Extract IDs from successful tool results
    if (success && result) {
      await this.extractIdsFromResult(store, toolName, result);
    }

    // Update metadata
    store.metadata.lastAction = toolName;

    await this.persistConversationData(store);
    this.logger.debug(`Tracked tool call: ${toolName} (success: ${success})`);
  }

  /**
   * Update metadata for a conversation
   */
  async updateMetadata(
    conversationId: string,
    updates: Partial<ConversationDataStore['metadata']>
  ): Promise<void> {
    const store = await this.initializeConversation(conversationId);
    store.metadata = { ...store.metadata, ...updates };
    await this.persistConversationData(store);
  }

  /**
   * Resolve an entity name to an ID
   */
  async resolveEntityId(
    conversationId: string,
    entityType: string,
    entityValue: string
  ): Promise<string | undefined> {
    const store = await this.getConversationData(conversationId);
    if (!store) return undefined;

    const key = `${entityType}:${entityValue}`;
    return store.resolvedIds.get(key);
  }

  /**
   * Store a resolved entity ID
   */
  async storeResolvedId(
    conversationId: string,
    entityType: string,
    entityValue: string,
    id: string
  ): Promise<void> {
    const store = await this.initializeConversation(conversationId);
    const key = `${entityType}:${entityValue}`;
    store.resolvedIds.set(key, id);

    // Also update the entity info
    const entityInfo = store.extractedEntities.get(key);
    if (entityInfo) {
      entityInfo.resolvedId = id;
    }

    await this.persistConversationData(store);
  }

  /**
   * Get available data as formatted context string
   */
  async getAvailableDataContext(conversationId: string): Promise<string> {
    const store = await this.getConversationData(conversationId);
    if (!store) return '';

    const parts: string[] = [];

    // Mentioned projects
    if (store.mentionedProjects.length > 0) {
      const projects = store.mentionedProjects
        .map((p) => {
          const resolvedId = store.resolvedIds.get(`PROJECT_NAME:${p.name}`);
          return resolvedId ? `${p.name} (ID: ${resolvedId})` : p.name;
        })
        .join(', ');
      parts.push(`Projects mentioned: ${projects}`);
    }

    // Mentioned tasks
    if (store.mentionedTasks.length > 0) {
      const tasks = store.mentionedTasks
        .map((t) => {
          const resolvedId = store.resolvedIds.get(`TASK_TITLE:${t.title}`);
          return resolvedId ? `${t.title} (ID: ${resolvedId})` : t.title;
        })
        .join(', ');
      parts.push(`Tasks mentioned: ${tasks}`);
    }

    // Last tool call
    if (store.lastToolCall) {
      parts.push(
        `Last action: ${store.lastToolCall.toolName} (${
          store.lastToolCall.success ? 'success' : 'failed'
        })`
      );
    }

    // Current domain
    if (store.metadata.currentDomain) {
      parts.push(`Current domain: ${store.metadata.currentDomain}`);
    }

    return parts.join('\n');
  }

  /**
   * Identify missing parameters for a tool
   */
  async identifyMissingParameters(
    conversationId: string,
    toolName: string,
    toolSchema: any
  ): Promise<MissingParameter[]> {
    const store = await this.getConversationData(conversationId);
    const missing: MissingParameter[] = [];

    if (!toolSchema?.properties) {
      return missing;
    }

    const availableData = store ? this.buildAvailableDataMap(store) : new Map();

    for (const [paramName, schema] of Object.entries(toolSchema.properties)) {
      const property = schema as any;

      // Skip auto-injected fields
      if (['userId', 'profileId', 'createdBy'].includes(paramName)) {
        continue;
      }

      // Check if required
      const isRequired = toolSchema.required?.includes(paramName);

      // Check if we have this data available
      const hasValue =
        availableData.has(paramName) ||
        availableData.has(`${toolName.split('_')[1]}_${paramName}`);

      if (isRequired && !hasValue) {
        missing.push({
          name: paramName,
          type: 'REQUIRED',
          description: property.description,
        });
      } else if (!isRequired && !hasValue && property.description) {
        // Suggest optional parameters that might be useful
        missing.push({
          name: paramName,
          type: 'OPTIONAL',
          description: property.description,
        });
      }
    }

    return missing;
  }

  /**
   * Get recent tool calls (for context)
   */
  async getRecentToolCalls(
    conversationId: string,
    limit = 5
  ): Promise<ToolCallRecord[]> {
    const store = await this.getConversationData(conversationId);
    if (!store) return [];

    return store.toolCallHistory.slice(-limit);
  }

  /**
   * Clear conversation data
   */
  async clearConversation(conversationId: string): Promise<void> {
    this.memoryCache.delete(conversationId);
    this.logger.log(`Cleared conversation data for ${conversationId}`);
  }

  /**
   * Extract IDs from tool results
   */
  private async extractIdsFromResult(
    store: ConversationDataStore,
    toolName: string,
    result: unknown
  ): Promise<void> {
    if (!result || typeof result !== 'object') return;

    const resultObj = result as any;

    // Extract project ID from create_project result
    if (toolName === 'create_project' && resultObj.id) {
      if (resultObj.name) {
        await this.storeResolvedId(
          store.conversationId,
          'PROJECT_NAME',
          resultObj.name,
          resultObj.id
        );
      }
    }

    // Extract task ID from create_task result
    if (toolName === 'create_task' && resultObj.id) {
      if (resultObj.title) {
        await this.storeResolvedId(
          store.conversationId,
          'TASK_TITLE',
          resultObj.title,
          resultObj.id
        );
      }
    }

    // Extract IDs from list results
    if (toolName.startsWith('list_') && Array.isArray(resultObj)) {
      for (const item of resultObj) {
        if (item.id && item.name) {
          const entityType = toolName.includes('project')
            ? 'PROJECT_NAME'
            : toolName.includes('task')
            ? 'TASK_TITLE'
            : 'ENTITY_REF';
          await this.storeResolvedId(
            store.conversationId,
            entityType,
            item.name,
            item.id
          );
        }
      }
    }
  }

  /**
   * Persist conversation data to storage
   */
  private async persistConversationData(
    store: ConversationDataStore
  ): Promise<void> {
    try {
      const context = await this.contextStorage.getContext(
        store.conversationId
      );
      const updatedMetadata = {
        ...context?.metadata,
        dataStore: this.serializeDataStore(store),
      };

      await this.contextStorage.updateContext(store.conversationId, {
        metadata: updatedMetadata,
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist conversation data: ${error.message}`
      );
    }
  }

  /**
   * Serialize data store for storage
   */
  private serializeDataStore(store: ConversationDataStore): any {
    return {
      conversationId: store.conversationId,
      extractedEntities: Array.from(store.extractedEntities.entries()),
      resolvedIds: Array.from(store.resolvedIds.entries()),
      mentionedProjects: store.mentionedProjects,
      mentionedTasks: store.mentionedTasks,
      toolCallHistory: store.toolCallHistory.slice(-10), // Keep last 10
      metadata: store.metadata,
    };
  }

  /**
   * Deserialize data store from storage
   */
  private deserializeDataStore(data: any): ConversationDataStore {
    return {
      conversationId: data.conversationId,
      extractedEntities: new Map(data.extractedEntities || []),
      resolvedIds: new Map(data.resolvedIds || []),
      mentionedProjects: data.mentionedProjects || [],
      mentionedTasks: data.mentionedTasks || [],
      toolCallHistory: data.toolCallHistory || [],
      metadata: data.metadata || { messageCount: 0 },
    };
  }

  /**
   * Build a map of available data for parameter matching
   */
  private buildAvailableDataMap(
    store: ConversationDataStore
  ): Map<string, string> {
    const map = new Map<string, string>();

    // Add resolved IDs
    for (const [key, id] of store.resolvedIds.entries()) {
      const [type, value] = key.split(':');
      if (type === 'PROJECT_NAME') {
        map.set('projectId', id);
        map.set('project_id', id);
      }
      if (type === 'TASK_TITLE') {
        map.set('taskId', id);
        map.set('task_id', id);
      }
    }

    // Add entity values
    for (const [key, entity] of store.extractedEntities.entries()) {
      const [type, value] = key.split(':');
      if (type === 'STATUS') {
        map.set('status', value);
      }
      if (type === 'PRIORITY') {
        map.set('priority', value);
      }
    }

    return map;
  }
}
