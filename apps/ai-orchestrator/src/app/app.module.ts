import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { loadConfig } from './config';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { ToolsService } from './tools.service';
import { MCPToolExecutor } from './mcp-tool-executor';
import { LangChainService } from './langchain.service';
import { ContextStorageService } from './context-storage.service';
import { LangGraphService } from './langgraph.service';
import { LangChainAgentService } from './langchain-agent.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      load: [loadConfig],
    }),
    HttpModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 10,  // 10 requests per profile per 60 seconds
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ToolsService,
    MCPToolExecutor,
    LangChainService,
    ContextStorageService,
    LangGraphService,
    LangChainAgentService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: 'ai-enabled-apps',
      useFactory: (config: ConfigService) => {
        return config.get<{ [key: string]: string }>('ai-enabled-apps', {});
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.PROMPT_PROXY,
      useFactory: (config: ConfigService) => {
        const options = config.get('dependencies.prompt_proxy');
        if (!options) {
          throw new Error('Prompt Proxy configuration not found');
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
    },
    {
      provide: ServiceTokens.TELOS_DOCS_SERVICE,
      useFactory: (config: ConfigService) => {
        const options = config.get('dependencies.telos_docs_service');
        if (!options) {
          throw new Error('Telos Docs Service configuration not found');
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
    },
    {
      provide: ServiceTokens.PROFILE_SERVICE,
      useFactory: (config: ConfigService) => {
        const options = config.get('dependencies.profile');
        if (!options) {
          throw new Error('Profile Service configuration not found');
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
    },
    {
      provide: ServiceTokens.CHAT_COLLECTOR_SERVICE,
      useFactory: (config: ConfigService) => {
        const options = config.get('dependencies.chat_collector');
        if (!options) {
          throw new Error('Chat Collector configuration not found');
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
    },
  ],
})
export class AppModule {}
