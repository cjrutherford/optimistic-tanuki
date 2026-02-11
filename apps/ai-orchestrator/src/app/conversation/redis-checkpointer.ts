/**
 * Redis Checkpointer for LangGraph
 *
 * Provides state persistence for LangGraph using Redis.
 * Compatible with LangGraph's checkpointer pattern.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export interface Checkpoint {
  id: string;
  ts?: number;
  channel_values: Record<string, unknown>;
  channel_versions: Record<string, number>;
  versions_seen: Record<string, Record<string, number>>;
}

export interface CheckpointMetadata {
  source: string;
  step: number;
  writes?: Record<string, unknown>;
  parents?: Record<string, string>;
}

export interface RedisCheckpoint {
  checkpoint: Checkpoint;
  metadata: CheckpointMetadata;
  parentConfig?: Record<string, unknown>;
}

export interface Configurable {
  thread_id: string;
  checkpoint_ns?: string;
  checkpoint_id?: string;
  parent_config?: Record<string, unknown>;
}

export interface CheckpointConfig {
  configurable: Configurable;
}

@Injectable()
export class RedisCheckpointer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCheckpointer.name);
  private client: RedisClientType;
  private readonly keyPrefix = 'langgraph:checkpoint:';
  private readonly defaultTTL = 7 * 24 * 60 * 60; // 7 days in seconds
  private isConnected = false;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.initPromise = this.initializeRedis();
    await this.initPromise;
  }

  private async ensureConnected(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.isConnected) {
      throw new Error('Redis not connected');
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisCfg = this.configService.get<any>('redis');
      let redisHost: string | undefined;
      let redisPort: number | undefined;
      let redisPassword: string | undefined;

      if (redisCfg && typeof redisCfg === 'object') {
        redisHost = redisCfg.host;
        redisPort = redisCfg.port;
        redisPassword = redisCfg.password;
      } else {
        redisHost = this.configService.get('REDIS_HOST') || 'localhost';
        redisPort = this.configService.get('REDIS_PORT') || 6379;
        redisPassword = this.configService.get('REDIS_PASSWORD');
      }

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
        this.logger.log('Connected to Redis for checkpoint storage');
        this.isConnected = true;
      });

      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      this.logger.error(`Failed to initialize Redis: ${error.message}`);
      this.isConnected = false;
    }
  }

  /**
   * Get a checkpoint from Redis
   */
  async get(config: CheckpointConfig): Promise<Checkpoint | undefined> {
    await this.ensureConnected();

    try {
      const threadId = config.configurable.thread_id;
      const checkpointNs = config.configurable.checkpoint_ns || 'default';

      if (!threadId) {
        this.logger.warn('No thread_id provided for checkpoint get');
        return undefined;
      }

      const key = this.getKey(threadId, checkpointNs);
      const data = await this.client.get(key);

      if (!data) {
        const msg = 'No checkpoint found for ' + threadId + '/' + checkpointNs;
        this.logger.debug(msg);
        return undefined;
      }

      const parsed: RedisCheckpoint = typeof data === 'string' ? JSON.parse(data) : data as RedisCheckpoint;
      this.logger.debug('Retrieved checkpoint successfully');
      return parsed.checkpoint;
    } catch (error) {
      this.logger.error(`Error getting checkpoint: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Put a checkpoint into Redis
   */
  async put(
    config: CheckpointConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<CheckpointConfig> {
    await this.ensureConnected();

    try {
      const threadId = config.configurable.thread_id;
      const checkpointNs = config.configurable.checkpoint_ns || 'default';

      if (!threadId) {
        this.logger.warn('No thread_id provided for checkpoint put');
        return config;
      }

      const key = this.getKey(threadId, checkpointNs);
      const data: RedisCheckpoint = {
        checkpoint,
        metadata,
        parentConfig: config.configurable.parent_config,
      };

      await this.client.setEx(key, this.defaultTTL, JSON.stringify(data));
      const msg = 'Saved checkpoint for ' + threadId + '/' + checkpointNs;
      this.logger.debug(msg);

      // Return updated config
      const updatedConfigurable: Configurable = {
        thread_id: config.configurable.thread_id,
        checkpoint_ns: config.configurable.checkpoint_ns,
        checkpoint_id: checkpoint.id,
        parent_config: config.configurable.parent_config,
      };

      return {
        configurable: updatedConfigurable,
      };
    } catch (error) {
      this.logger.error(`Error saving checkpoint: ${error.message}`);
      return config;
    }
  }

  /**
   * List checkpoints for a thread
   */
  async list(config: CheckpointConfig): Promise<Checkpoint[]> {
    await this.ensureConnected();

    try {
      const threadId = config.configurable.thread_id;
      if (!threadId) {
        return [];
      }

      const pattern = `${this.keyPrefix}${threadId}:*`;

      const checkpoints: Checkpoint[] = [];
      // Use SCAN instead of KEYS to avoid blocking Redis on large keyspaces
      for await (const key of this.client.scanIterator({ MATCH: pattern })) {
        const keyStr = String(key);
        const data = await this.client.get(keyStr);
        if (data) {
          const parsed: RedisCheckpoint =
            typeof data === 'string' ? JSON.parse(data) : (data as RedisCheckpoint);
          checkpoints.push(parsed.checkpoint);
        }
      }

      return checkpoints.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    } catch (error) {
      this.logger.error(`Error listing checkpoints: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete a checkpoint
   */
  async delete(config: CheckpointConfig): Promise<void> {
    await this.ensureConnected();

    try {
      const threadId = config.configurable.thread_id;
      const checkpointNs = config.configurable.checkpoint_ns || 'default';

      if (!threadId) {
        return;
      }

      const key = this.getKey(threadId, checkpointNs);
      await this.client.del(key);
      const msg = 'Deleted checkpoint for ' + threadId + '/' + checkpointNs;
      this.logger.debug(msg);
    } catch (error) {
      this.logger.error(`Error deleting checkpoint: ${error.message}`);
    }
  }

  /**
   * Get the latest checkpoint for a thread
   */
  async getLatest(
    config: CheckpointConfig
  ): Promise<
    { checkpoint: Checkpoint; metadata: CheckpointMetadata } | undefined
  > {
    const checkpoints = await this.list(config);
    if (checkpoints.length === 0) {
      return undefined;
    }

    const latest = checkpoints[0];

    // Retrieve full data to get metadata
    const threadId = config.configurable.thread_id;
    const checkpointNs = config.configurable.checkpoint_ns || 'default';
    const key = this.getKey(threadId, checkpointNs);
    const data = await this.client.get(key);

    if (data) {
      const parsed: RedisCheckpoint = typeof data === 'string' ? JSON.parse(data) : data as RedisCheckpoint;
      return { checkpoint: latest, metadata: parsed.metadata };
    }

    return { checkpoint: latest, metadata: { source: 'unknown', step: 0 } };
  }

  /**
   * Generate Redis key
   */
  private getKey(threadId: string, checkpointNs: string): string {
    return `${this.keyPrefix}${threadId}:${checkpointNs}`;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.logger.log('Disconnected from Redis checkpoint storage');
    }
  }
}
