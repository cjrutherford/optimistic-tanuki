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
  /**
   * Reading a body of work and saying something about it. Not conversation,
   * not tool calling, not classification. The project summary is the first
   * caller and it wants depth over speed, which is the opposite of what the
   * classifier types want.
   */
  PROJECT_ANALYSIS = 'project_analysis',
}

export interface ModelConfig {
  name: string;
  temperature: number;
  baseUrl: string;
  maxTokens?: number;
  /**
   * Ollama's repeat penalty.
   *
   * Carried here because it is not a nicety. At temperature 0 a model was
   * observed looping inside a single field until it ran out of room, producing
   * unterminated JSON. The pilot that chose these models ran with this set,
   * and this service did not, so the pilot's results did not transfer until it
   * did.
   */
  repeatPenalty?: number;
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

    for (const type of Object.values(ModelType)) {
      // The key is the enum value, so the config file and the code cannot
      // drift. They had: the code asked for models.toolCalling while the file
      // defined models.tool_calling, and three of four types silently fell
      // back to a hardcoded name for a model that was not installed on the
      // host. Deriving the key removes the class of bug rather than fixing
      // this instance of it.
      const name = this.configService.get<string>(`models.${type}.name`);
      if (!name) {
        // No default. A missing model name used to resolve to a hardcoded one,
        // which is how a typo became a running service quietly talking to a
        // model that did not exist. Better to be absent and say so.
        this.logger.warn(
          `No model configured for ${type}. Set models.${type}.name in the ` +
            `ai-orchestrator config. Requests for this type will be refused.`
        );
        continue;
      }

      this.configs.set(type, {
        name,
        // Temperature and token budget are tuning rather than identity, so
        // they keep defaults. Getting these wrong degrades an answer; getting
        // the model name wrong means there is no answer at all.
        temperature:
          this.configService.get<number>(`models.${type}.temperature`) ?? 0.3,
        baseUrl,
        maxTokens: this.configService.get<number>(`models.${type}.maxTokens`),
        repeatPenalty: this.configService.get<number>(
          `models.${type}.repeatPenalty`
        ),
      });
    }

    const configured = Array.from(this.configs.keys());
    this.logger.log(
      `Model configuration at ${baseUrl}: ` +
        (configured.length
          ? configured
              .map((type) => `${type}=${this.configs.get(type)?.name}`)
              .join(', ')
          : 'nothing configured')
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
    const config = this.configs.get(type);
    if (!config) {
      // Previously fell back to the conversational model, so asking for a
      // tool-calling model and getting a chat one looked like the model being
      // bad at tool calling rather than a missing setting.
      throw new Error(
        `No model configured for ${type}. Set models.${type}.name in the ` +
          `ai-orchestrator config.`
      );
    }
    return config;
  }

  /**
   * Create a new model instance
   */
  private createModel(type: ModelType): BaseChatModel {
    const config = this.getModelConfig(type);

    this.logger.log(`Creating ${type} model: ${config.name}`);

    return new ChatOllama({
      model: config.name,
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      repeatPenalty: config.repeatPenalty,
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
