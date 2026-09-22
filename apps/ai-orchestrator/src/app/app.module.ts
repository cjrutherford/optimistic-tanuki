import { FactoryProvider, Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WellnessController } from './wellness.controller';
import { ProjectAiController } from './project-ai.controller';
import { ProjectAiService } from './project-ai.service';
import { ProjectAgentService } from './project-agent.service';
import { PersonaVoiceService } from './persona-voice.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { loadConfig } from './config';
import {
  DisabledClientProxy,
  GatewayComposition,
  ServiceTokens,
  WellnessCommands,
  isServiceEnabled,
  loadGatewayCompositionFromFile,
  normalizeGatewayComposition,
} from '@optimistic-tanuki/constants';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { ToolsService } from './tools.service';
import { MCPToolExecutor } from './mcp-tool-executor';
import { EnhancedMCPToolExecutor } from './enhanced-mcp-tool-executor.service';
import { LangChainService } from './langchain.service';
import { ContextStorageService } from './context-storage.service';
import { LangGraphService } from './langgraph.service';
import { LangChainAgentService } from './langchain-agent.service';
import { ModelInitializerService } from './model-initializer.service';
import { WorkflowControlService } from './workflow-control.service';
import { PromptTemplateService } from './prompt-template.service';
import { SystemPromptBuilder } from './system-prompt-builder.service';
import { ToolValidationService } from './tool-validation.service';
import { ToolFactory } from './tool-factory.service';
import { WellnessPromptService } from './wellness-prompt.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './guards/rate-limit.guard';

// New refactored services
import { ModelManager } from './models/model-manager.service';
import { ToolRegistry } from './tools/tool-registry.service';
import { IntentAnalyzer } from './intent/intent-analyzer.service';
import { DataTracker } from './data/data-tracker.service';
import { ConversationService } from './conversation/conversation.service';
import { RedisCheckpointer } from './conversation/redis-checkpointer';

// O24b: downstream set mirrors the gateway's composition vocabulary so the
// O23 coherence check holds. `prompt-proxy` is wired but optional (unused at
// runtime); the other three are required. Reads the same
// GATEWAY_COMPOSITION_PATH file where deployments share storage; otherwise
// every declared dependency is enabled.
export const ORCHESTRATOR_SERVICE_IDS = [
  'profile',
  'chat-collector',
  'telos-docs-service',
  'prompt-proxy',
] as const;

const orchestratorComposition = normalizeGatewayComposition(
  loadGatewayCompositionFromFile(process.env.GATEWAY_COMPOSITION_PATH),
  [...ORCHESTRATOR_SERVICE_IDS]
);

const orchestratorLog = new Logger('OrchestratorComposition');
for (const serviceId of ORCHESTRATOR_SERVICE_IDS) {
  orchestratorLog.log(
    `downstream "${serviceId}": ${
      isServiceEnabled(orchestratorComposition, serviceId)
        ? 'enabled'
        : 'disabled'
    }`
  );
}

type OrchestratorDependency = {
  token: string;
  serviceId: (typeof ORCHESTRATOR_SERVICE_IDS)[number];
  configKey: string;
};

const orchestratorDependencies: OrchestratorDependency[] = [
  {
    token: ServiceTokens.PROMPT_PROXY,
    serviceId: 'prompt-proxy',
    configKey: 'prompt_proxy',
  },
  {
    token: ServiceTokens.TELOS_DOCS_SERVICE,
    serviceId: 'telos-docs-service',
    configKey: 'telos_docs_service',
  },
  {
    token: ServiceTokens.PROFILE_SERVICE,
    serviceId: 'profile',
    configKey: 'profile',
  },
  {
    token: ServiceTokens.CHAT_COLLECTOR_SERVICE,
    serviceId: 'chat-collector',
    configKey: 'chat_collector',
  },
];

// O24b providers below are built from `orchestratorDependencies` — a single
// factory maps composition state + config presence to either a TCP client or
// a shared DisabledClientProxy (never a boot-time throw).
export const createOrchestratorProviders = (
  composition: GatewayComposition
): FactoryProvider[] =>
  orchestratorDependencies.map((definition) => ({
    provide: definition.token,
    useFactory: (config: ConfigService): ClientProxy => {
      if (!isServiceEnabled(composition, definition.serviceId)) {
        // DisabledClientProxy extends ClientProxy but carries different
        // generic parameters; the cast satisfies the provider contract.
        return new DisabledClientProxy(
          definition.serviceId
        ) as unknown as ClientProxy;
      }
      const options = config.get<{
        host: string;
        port: number;
      }>(`dependencies.${definition.configKey}`);
      if (!options) {
        return new DisabledClientProxy(
          definition.serviceId
        ) as unknown as ClientProxy;
      }
      return ClientProxyFactory.create({
        transport: Transport.TCP,
        options: {
          port: options.port,
          host: options.host,
        },
      });
    },
    inject: [ConfigService],
  }));

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      load: [loadConfig],
    }),
    HttpModule,
  ],
  controllers: [AppController, WellnessController, ProjectAiController],
  providers: [
    AppService,
    ToolsService,
    MCPToolExecutor,
    EnhancedMCPToolExecutor,
    ModelInitializerService,
    WorkflowControlService,
    PromptTemplateService,
    SystemPromptBuilder,
    ToolValidationService,
    ToolFactory,
    WellnessPromptService,
    ProjectAiService,
    ProjectAgentService,
    PersonaVoiceService,
    LangChainService,
    ContextStorageService,
    LangGraphService,
    LangChainAgentService,
    // New refactored services
    ModelManager,
    ToolRegistry,
    IntentAnalyzer,
    DataTracker,
    ConversationService,
    RedisCheckpointer,
    // {
    //   provide: APP_GUARD,
    //   useClass: RateLimitGuard,
    // },
    {
      provide: 'ai-enabled-apps',
      useFactory: (config: ConfigService) => {
        return config.get<{ [key: string]: string }>('ai-enabled-apps', {});
      },
      inject: [ConfigService],
    },
    ...createOrchestratorProviders(orchestratorComposition),
  ],
})
export class AppModule {}
