import { forwardRef, Module } from '@nestjs/common';
import { McpModule as NestMcpModule } from '@rekog/mcp-nest';
import { ProjectMcpService } from './project-mcp.service';
import { TaskMcpService } from './task-mcp.service';
import { RiskMcpService } from './risk-mcp.service';
import { ChangeMcpService } from './change-mcp.service';
import { JournalMcpService } from './journal-mcp.service';
import { PersonaMcpService } from './persona-mcp.service';
import { AppModule } from '../app.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { loadConfig, TcpServiceConfig } from '../../config';

/**
 * MCP Module for ForgeOfWill
 * Provides Model Context Protocol tools for AI assistants to interact with
 * projects, tasks, risks, changes, journal entries, and other AI personas
 */
@Module({
  imports: [
    ConfigModule.forFeature(loadConfig),
    NestMcpModule.forRoot({
      name: 'forgeofwill-mcp-server',
      version: '1.0.0',
    }),
    forwardRef(() => AppModule),
  ],
  providers: [
    {
      provide: ServiceTokens.PROJECT_PLANNING_SERVICE,
      useFactory: (config: ConfigService) => {
        const serviceConfig = config.get<TcpServiceConfig>(
          'services.project_planning'
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
    },
    {
      provide: ServiceTokens.TELOS_DOCS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.telos_docs_service'
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
    },
    ProjectMcpService,
    TaskMcpService,
    RiskMcpService,
    ChangeMcpService,
    JournalMcpService,
    PersonaMcpService,
  ],
  exports: [
    ProjectMcpService,
    TaskMcpService,
    RiskMcpService,
    ChangeMcpService,
    JournalMcpService,
    PersonaMcpService,
  ],
})
export class McpToolsModule {}
