import { FactoryProvider } from '@nestjs/common';
import { DynamicModule, Type } from '@nestjs/common/interfaces';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { TcpServiceConfig } from '../config';
import { GatewayComposition, isServiceEnabled } from './gateway-composition';
import {
  McpServerModule,
  ProjectPlanningMcpToolsModule,
  TelosDocsMcpToolsModule,
} from './mcp/mcp-tools.module';

type GatewayServiceProviderDefinition = {
  token: string;
  serviceId: string;
  configKey: string;
};

export class DisabledClientProxy extends ClientProxy {
  constructor(private readonly serviceId: string) {
    super();
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {}

  unwrap<T>(): T {
    return undefined as T;
  }

  protected publish(
    _packet: any,
    callback: (packet: { err: Error; isDisposed: boolean }) => void
  ): () => void {
    callback({
      err: new Error(`Gateway service "${this.serviceId}" is disabled`),
      isDisposed: true,
    });
    return () => undefined;
  }

  protected dispatchEvent(): Promise<never> {
    return Promise.reject(
      new Error(`Gateway service "${this.serviceId}" is disabled`)
    );
  }
}

const gatewayServiceProviderDefinitions: GatewayServiceProviderDefinition[] = [
  {
    token: ServiceTokens.AUTHENTICATION_SERVICE,
    serviceId: 'authentication',
    configKey: 'authentication',
  },
  {
    token: ServiceTokens.PROFILE_SERVICE,
    serviceId: 'profile',
    configKey: 'profile',
  },
  {
    token: ServiceTokens.SOCIAL_SERVICE,
    serviceId: 'social',
    configKey: 'social',
  },
  {
    token: ServiceTokens.ASSETS_SERVICE,
    serviceId: 'assets',
    configKey: 'asset',
  },
  {
    token: ServiceTokens.PROJECT_PLANNING_SERVICE,
    serviceId: 'project-planning',
    configKey: 'project_planning',
  },
  {
    token: ServiceTokens.CHAT_COLLECTOR_SERVICE,
    serviceId: 'chat-collector',
    configKey: 'chat_collector',
  },
  {
    token: ServiceTokens.TELOS_DOCS_SERVICE,
    serviceId: 'telos-docs-service',
    configKey: 'telos_docs_service',
  },
  {
    token: ServiceTokens.AI_ORCHESTRATION_SERVICE,
    serviceId: 'ai-orchestration',
    configKey: 'ai_orchestration',
  },
  {
    token: ServiceTokens.BLOG_SERVICE,
    serviceId: 'blogging',
    configKey: 'blogging',
  },
  {
    token: ServiceTokens.PERMISSIONS_SERVICE,
    serviceId: 'permissions',
    configKey: 'permissions',
  },
  {
    token: ServiceTokens.STORE_SERVICE,
    serviceId: 'store',
    configKey: 'store',
  },
  {
    token: ServiceTokens.APP_CONFIGURATOR_SERVICE,
    serviceId: 'app-configurator',
    configKey: 'app_configurator',
  },
  {
    token: ServiceTokens.FORUM_SERVICE,
    serviceId: 'forum',
    configKey: 'forum',
  },
  {
    token: ServiceTokens.FINANCE_SERVICE,
    serviceId: 'finance',
    configKey: 'finance',
  },
  {
    token: ServiceTokens.WELLNESS_SERVICE,
    serviceId: 'wellness',
    configKey: 'wellness',
  },
  {
    token: ServiceTokens.CLASSIFIEDS_SERVICE,
    serviceId: 'classifieds',
    configKey: 'classifieds',
  },
  {
    token: ServiceTokens.LEAD_SERVICE,
    serviceId: 'lead-tracker',
    configKey: 'lead_tracker',
  },
  {
    token: ServiceTokens.SYSTEM_CONFIGURATOR_SERVICE,
    serviceId: 'system-configurator-api',
    configKey: 'system_configurator',
  },
  {
    token: ServiceTokens.VIDEOS_SERVICE,
    serviceId: 'videos',
    configKey: 'videos',
  },
  {
    token: ServiceTokens.LEARNING_SERVICE,
    serviceId: 'learning-service',
    configKey: 'learning_service',
  },
];

type ModuleImport = Type<any> | DynamicModule;

export const createMcpToolImports = (
  composition: GatewayComposition
): ModuleImport[] => {
  const imports: ModuleImport[] = [];
  const enableProjectPlanning = isServiceEnabled(
    composition,
    'project-planning'
  );
  const enableTelosDocs = isServiceEnabled(composition, 'telos-docs-service');

  if (!enableProjectPlanning && !enableTelosDocs) {
    return imports;
  }

  imports.push(McpServerModule);

  if (enableProjectPlanning) {
    imports.push(ProjectPlanningMcpToolsModule);
  }
  if (enableTelosDocs) {
    imports.push(TelosDocsMcpToolsModule);
  }

  return imports;
};

export const createGatewayServiceProviders = (
  composition: GatewayComposition
): FactoryProvider[] =>
  gatewayServiceProviderDefinitions.map((definition) => ({
    provide: definition.token,
    useFactory: (configService: ConfigService): ClientProxy => {
      if (!isServiceEnabled(composition, definition.serviceId)) {
        return new DisabledClientProxy(definition.serviceId);
      }

      const serviceConfig = configService.get<TcpServiceConfig>(
        `services.${definition.configKey}`
      );

      return ClientProxyFactory.create({
        transport: Transport.TCP,
        options: {
          host: serviceConfig.host,
          port: serviceConfig.port,
        },
      });
    },
    inject: [ConfigService],
  }));
