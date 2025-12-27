/**
 * Context Storage Service
 * 
 * Manages conversation context persistence using Redis
 * Maps profileId to conversation context for quick retrieval
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export interface ConversationContext {
  profileId: string;
  summary: string;
  recentTopics: string[];
  activeProjects: string[];
  lastUpdated: Date;
  messageCount: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ContextStorageService implements OnModuleDestroy {
  private readonly logger = new Logger(ContextStorageService.name);
  private client: RedisClientType;
  private readonly keyPrefix = 'ai-context:';
  private readonly defaultTTL = 7 * 24 * 60 * 60; // 7 days in seconds
  private isConnected = false;

  constructor(private readonly config: ConfigService) {
    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    try {
      const redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
      const redisPort = this.config.get<number>('REDIS_PORT', 6379);
      const redisPassword = this.config.get<string>('REDIS_PASSWORD');

      this.client = createClient({
        socket: {
          host: redisHost,
          port: redisPort,
        },
        password: redisPassword,
      }) as RedisClientType;

      this.client.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to Redis for context storage');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        this.logger.warn('Disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error(`Failed to initialize Redis: ${error.message}`);
      this.isConnected = false;
    }
  }

  private getKey(profileId: string): string {
    return `${this.keyPrefix}${profileId}`;
  }

  /**
   * Store conversation context for a profile
   */
  async storeContext(
    profileId: string,
    context: Omit<ConversationContext, 'profileId' | 'lastUpdated'>
  ): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping context storage');
      return;
    }

    try {
      const fullContext: ConversationContext = {
        profileId,
        ...context,
        lastUpdated: new Date(),
      };

      const key = this.getKey(profileId);
      const value = JSON.stringify(fullContext);

      await this.client.setEx(key, this.defaultTTL, value);
      this.logger.debug(`Stored context for profile: ${profileId}`);
    } catch (error) {
      this.logger.error(`Error storing context for ${profileId}: ${error.message}`);
    }
  }

  /**
   * Retrieve conversation context for a profile
   */
  async getContext(profileId: string): Promise<ConversationContext | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, returning null');
      return null;
    }

    try {
      const key = this.getKey(profileId);
      const value = await this.client.get(key);

      if (!value) {
        this.logger.debug(`No context found for profile: ${profileId}`);
        return null;
      }

      const context = JSON.parse(value) as ConversationContext;
      context.lastUpdated = new Date(context.lastUpdated);
      
      this.logger.debug(`Retrieved context for profile: ${profileId}`);
      return context;
    } catch (error) {
      this.logger.error(`Error retrieving context for ${profileId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Update specific fields in existing context
   */
  async updateContext(
    profileId: string,
    updates: Partial<Omit<ConversationContext, 'profileId' | 'lastUpdated'>>
  ): Promise<void> {
    const existing = await this.getContext(profileId);
    
    if (!existing) {
      // Create new context if doesn't exist
      await this.storeContext(profileId, {
        summary: updates.summary || '',
        recentTopics: updates.recentTopics || [],
        activeProjects: updates.activeProjects || [],
        messageCount: updates.messageCount || 0,
        metadata: updates.metadata,
      });
      return;
    }

    // Merge updates with existing
    await this.storeContext(profileId, {
      summary: updates.summary ?? existing.summary,
      recentTopics: updates.recentTopics ?? existing.recentTopics,
      activeProjects: updates.activeProjects ?? existing.activeProjects,
      messageCount: updates.messageCount ?? existing.messageCount,
      metadata: { ...existing.metadata, ...updates.metadata },
    });
  }

  /**
   * Delete context for a profile
   */
  async deleteContext(profileId: string): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping delete');
      return;
    }

    try {
      const key = this.getKey(profileId);
      await this.client.del(key);
      this.logger.log(`Deleted context for profile: ${profileId}`);
    } catch (error) {
      this.logger.error(`Error deleting context for ${profileId}: ${error.message}`);
    }
  }

  /**
   * Clear all stored contexts (use with caution)
   */
  async clearAllContexts(): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping clear');
      return;
    }

    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.client.keys(pattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
        this.logger.warn(`Cleared ${keys.length} conversation contexts`);
      }
    } catch (error) {
      this.logger.error(`Error clearing all contexts: ${error.message}`);
    }
  }

  /**
   * Get statistics about stored contexts
   */
  async getStats(): Promise<{ totalContexts: number; keys: string[] }> {
    if (!this.isConnected) {
      return { totalContexts: 0, keys: [] };
    }

    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.client.keys(pattern);
      
      return {
        totalContexts: keys.length,
        keys: keys.map(k => k.replace(this.keyPrefix, '')),
      };
    } catch (error) {
      this.logger.error(`Error getting context stats: ${error.message}`);
      return { totalContexts: 0, keys: [] };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.logger.log('Disconnected from Redis');
    }
  }
}
