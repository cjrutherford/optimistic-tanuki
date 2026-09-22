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

export type OrchestratorDependencyState = 'enabled' | 'disabled';

/**
 * O27a: per-dependency state for the HealthCheck reply (R5). Pure over the
 * composition so the matrix is unit-testable; the module-level singleton
 * below binds it to the boot composition.
 */
export const resolveOrchestratorDependencyStates = (
  composition: GatewayComposition
): Record<
  (typeof ORCHESTRATOR_SERVICE_IDS)[number],
  OrchestratorDependencyState
> => {
  const states = {} as Record<
    (typeof ORCHESTRATOR_SERVICE_IDS)[number],
    OrchestratorDependencyState
  >;
  for (const serviceId of ORCHESTRATOR_SERVICE_IDS) {
    states[serviceId] = isServiceEnabled(composition, serviceId)
      ? 'enabled'
      : 'disabled';
  }
  return states;
};

export const getOrchestratorDependencyStates = () =>
  resolveOrchestratorDependencyStates(orchestratorComposition);

export type OrchestratorDependencyDef = {
  token: string;
  serviceId: (typeof ORCHESTRATOR_SERVICE_IDS)[number];
  /** R2: false only for prompt-proxy — every other downstream is required
   * and the O27 readiness gate fails closed without it. */
  required: boolean;
};

/**
 * O22 registry: the single mapping between `config.yaml dependencies:`
 * keys and orchestrator providers. Adding a downstream = one entry here +
 * its config block; no factory edits, no new manifest file.
 */
export const ORCHESTRATOR_DEPENDENCY_DEFS: Record<
  string,
  OrchestratorDependencyDef
> = {
  profile: {
    token: ServiceTokens.PROFILE_SERVICE,
    serviceId: 'profile',
    required: true,
  },
  chat_collector: {
    token: ServiceTokens.CHAT_COLLECTOR_SERVICE,
    serviceId: 'chat-collector',
    required: true,
  },
  telos_docs_service: {
    token: ServiceTokens.TELOS_DOCS_SERVICE,
    serviceId: 'telos-docs-service',
    required: true,
  },
  prompt_proxy: {
    token: ServiceTokens.PROMPT_PROXY,
    serviceId: 'prompt-proxy',
    required: false,
  },
};

/** Service ids the O27 readiness gate must fail closed on. */
export const REQUIRED_ORCHESTRATOR_SERVICE_IDS = (
  Object.values(ORCHESTRATOR_DEPENDENCY_DEFS) as OrchestratorDependencyDef[]
)
  .filter((def) => def.required)
  .map((def) => def.serviceId);

export const isRequiredOrchestratorDependency = (serviceId: string): boolean =>
  (REQUIRED_ORCHESTRATOR_SERVICE_IDS as string[]).includes(serviceId);

/**
 * O22 validation: resolves the registry against the actual `dependencies:`
 * map. Unknown config keys are reported (likely a typo for a known key)
 * instead of silently ignored; every known def always yields a provider
 * (missing/disabled → DisabledClientProxy, never a boot throw).
 */
export const resolveOrchestratorDefinitions = (
  dependenciesConfig: Record<string, unknown>
): { defs: OrchestratorDependencyDef[]; unknownKeys: string[] } => {
  const unknownKeys = Object.keys(dependenciesConfig ?? {}).filter(
    (key) => !(key in ORCHESTRATOR_DEPENDENCY_DEFS)
  );
  return {
    defs: Object.values(ORCHESTRATOR_DEPENDENCY_DEFS),
    unknownKeys,
  };
};

// O24b providers below are built from `ORCHESTRATOR_DEPENDENCY_DEFS` — a single
// factory maps composition state + config presence to either a TCP client or
// a shared DisabledClientProxy (never a boot-time throw).
export const createOrchestratorProviders = (
  composition: GatewayComposition,
  dependenciesConfig: Record<string, unknown> = {}
): FactoryProvider[] => {
  const { unknownKeys } = resolveOrchestratorDefinitions(dependenciesConfig);
  for (const key of unknownKeys) {
    orchestratorLog.warn(
      `unknown dependencies config key "${key}" — no orchestrator provider; ` +
        `known keys: ${Object.keys(ORCHESTRATOR_DEPENDENCY_DEFS).join(', ')}`
    );
  }
  return Object.entries(ORCHESTRATOR_DEPENDENCY_DEFS).map(
    ([configKey, definition]) => ({
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
        }>(`dependencies.${configKey}`);
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
    })
  );
};

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
