/**
 * Model Initializer Service
 *
 * Handles initialization and pulling of AI models from Ollama
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ModelConfigs } from './config';

@Injectable()
export class ModelInitializerService implements OnModuleInit {
  private readonly logger = new Logger(ModelInitializerService.name);
  private ollamaBaseUrl: string;
  private modelConfigs: ModelConfigs | null = null;
  
  // Configuration constants
  private readonly MODEL_PULL_TIMEOUT_MS = 300000; // 5 minutes
  private readonly MODEL_CHECK_TIMEOUT_MS = 10000; // 10 seconds

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService
  ) {
    const ollama = this.config.get<{ host: string; port: number }>('ollama');
    this.ollamaBaseUrl =
      ollama?.host && ollama?.port
        ? `http://${ollama.host}:${ollama.port}`
        : 'http://prompt-proxy:11434';

    this.modelConfigs = this.config.get<ModelConfigs>('models') || null;
  }

  async onModuleInit() {
    this.logger.log('Initializing AI models (background)...');
    // Don't await this, let it run in background to avoid blocking app startup
    // especially if Ollama is unreachable or slow
    this.initializeModels().catch(err => {
      this.logger.error('Failed to initialize models in background', err);
    });
  }

  /**
   * Initialize and pull all configured models
   */
  async initializeModels(): Promise<void> {
    if (!this.modelConfigs) {
      this.logger.warn('No model configurations found, skipping initialization');
      return;
    }

    const modelTypes: Array<keyof ModelConfigs> = [
      'workflow_control',
      'tool_calling',
      'conversational',
    ];

    for (const modelType of modelTypes) {
      const modelConfig = this.modelConfigs[modelType];
      if (modelConfig && modelConfig.pullOnStartup) {
        await this.pullModel(modelConfig.name, modelType);
      }
    }

    this.logger.log('Model initialization complete');
  }

  /**
   * Pull a specific model from Ollama
   */
  private async pullModel(
    modelName: string,
    modelType: string
  ): Promise<void> {
    try {
      this.logger.log(`Pulling model: ${modelName} for ${modelType}...`);

      // Check if model already exists
      const modelExists = await this.checkModelExists(modelName);
      if (modelExists) {
        this.logger.log(`Model ${modelName} already exists, skipping pull`);
        return;
      }

      // Pull the model
      const response = await firstValueFrom(
        this.http.post(
          `${this.ollamaBaseUrl}/api/pull`,
          { name: modelName },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: this.MODEL_PULL_TIMEOUT_MS,
          }
        )
      );

      if (response.status === 200) {
        this.logger.log(`Successfully pulled model: ${modelName}`);
      } else {
        this.logger.warn(
          `Unexpected response when pulling ${modelName}: ${response.status}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to pull model ${modelName}: ${error.message}`,
        error.stack
      );
      // Don't throw - we want the service to continue even if model pulling fails
    }
  }

  /**
   * Check if a model exists in Ollama
   */
  private async checkModelExists(modelName: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.ollamaBaseUrl}/api/tags`, {
          timeout: this.MODEL_CHECK_TIMEOUT_MS,
        })
      );

      const models = response.data?.models || [];
      return models.some((m: any) => m.name === modelName);
    } catch (error) {
      this.logger.warn(
        `Failed to check if model exists: ${error.message}. Assuming it needs to be pulled.`
      );
      return false;
    }
  }

  /**
   * Get model configuration for a specific use case
   */
  getModelConfig(
    modelType: keyof ModelConfigs
  ): { name: string; temperature: number } | null {
    if (!this.modelConfigs || !this.modelConfigs[modelType]) {
      this.logger.warn(`Model config not found for ${modelType}`);
      return null;
    }

    const config = this.modelConfigs[modelType];
    return {
      name: config.name,
      temperature: config.temperature ?? 0.7,
    };
  }

  /**
   * Get all model configurations
   */
  getAllModelConfigs(): ModelConfigs | null {
    return this.modelConfigs;
  }
}
