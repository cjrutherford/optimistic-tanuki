/**
 * Model Manager Service
 *
 * Centralizes LLM model management for Ollama.
 * Provides cached model instances with proper configuration.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOllama } from '@langchain/ollama';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export enum ModelType {
  CONVERSATIONAL = 'conversational',
  TOOL_CALLING = 'tool_calling',
  WORKFLOW_CONTROL = 'workflow_control',
  INTENT_ANALYSIS = 'intent_analysis',
}

export interface ModelConfig {
  name: string;
  temperature: number;
  baseUrl: string;
  maxTokens?: number;
}

@Injectable()
export class ModelManager {
  private readonly logger = new Logger(ModelManager.name);
  private models: Map<ModelType, BaseChatModel> = new Map();
  private configs: Map<ModelType, ModelConfig> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeConfigs();
  }

  /**
   * Initialize model configurations from config
   */
  private initializeConfigs(): void {
    const ollama = this.configService.get<{ host: string; port: number }>(
      'ollama'
    );
    const baseUrl =
      ollama?.host && ollama?.port
        ? `http://${ollama.host}:${ollama.port}`
        : 'http://prompt-proxy:11434';

    // Conversational model - for general chat
    this.configs.set(ModelType.CONVERSATIONAL, {
      name:
        this.configService.get<string>('models.conversational.name') ||
        'bjoernb/deepseek-r1-8b',
      temperature:
        this.configService.get<number>('models.conversational.temperature') ||
        0.7,
      baseUrl,
      maxTokens:
        this.configService.get<number>('models.conversational.maxTokens') ||
        2048,
    });

    // Tool calling model - optimized for function calling
    this.configs.set(ModelType.TOOL_CALLING, {
      name:
        this.configService.get<string>('models.toolCalling.name') ||
        'bjoernb/deepseek-r1-8b',
      temperature:
        this.configService.get<number>('models.toolCalling.temperature') || 0.3,
      baseUrl,
      maxTokens:
        this.configService.get<number>('models.toolCalling.maxTokens') || 2048,
    });

    // Workflow control model - lightweight classifier
    this.configs.set(ModelType.WORKFLOW_CONTROL, {
      name:
        this.configService.get<string>('models.workflowControl.name') ||
        'bjoernb/deepseek-r1-8b',
      temperature:
        this.configService.get<number>('models.workflowControl.temperature') ||
        0.1,
      baseUrl,
      maxTokens: 512,
    });

    // Intent analysis model - for understanding user requests
    this.configs.set(ModelType.INTENT_ANALYSIS, {
      name:
        this.configService.get<string>('models.intentAnalysis.name') ||
        'bjoernb/deepseek-r1-8b',
      temperature:
        this.configService.get<number>('models.intentAnalysis.temperature') ||
        0.2,
      baseUrl,
      maxTokens: 1024,
    });

    this.logger.log(
      `Initialized model configurations with base URL: ${baseUrl}`
    );
  }

  /**
   * Get or create a model instance
   */
  getModel(type: ModelType): BaseChatModel {
    if (!this.models.has(type)) {
      this.models.set(type, this.createModel(type));
    }
    return this.models.get(type)!;
  }

  /**
   * Get model configuration without creating instance
   */
  getModelConfig(type: ModelType): ModelConfig {
    return (
      this.configs.get(type) || this.configs.get(ModelType.CONVERSATIONAL)!
    );
  }

  /**
   * Create a new model instance
   */
  private createModel(type: ModelType): BaseChatModel {
    const config = this.configs.get(type);
    if (!config) {
      throw new Error(`No configuration found for model type: ${type}`);
    }

    this.logger.log(`Creating ${type} model: ${config.name}`);

    return new ChatOllama({
      model: config.name,
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      maxRetries: 3,
    });
  }

  /**
   * Reset all cached models (useful for config changes)
   */
  resetModels(): void {
    this.logger.log('Resetting all cached model instances');
    this.models.clear();
    this.initializeConfigs();
  }

  /**
   * Get a model with tools bound
   */
  getModelWithTools(type: ModelType, tools: any[]): any {
    const model = this.getModel(type);
    return model.bindTools(tools);
  }

  /**
   * Check if a model type is configured
   */
  isModelConfigured(type: ModelType): boolean {
    return this.configs.has(type);
  }

  /**
   * Get all configured model types
   */
  getConfiguredTypes(): ModelType[] {
    return Array.from(this.configs.keys());
  }
}
