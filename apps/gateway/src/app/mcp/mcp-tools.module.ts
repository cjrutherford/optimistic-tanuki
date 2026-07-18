import { Module } from '@nestjs/common';
import { McpModule as NestMcpModule } from '@rekog/mcp-nest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { loadConfig, TcpServiceConfig } from '../../config';
import { ChangeMcpService } from './change-mcp.service';
import { JournalMcpService } from './journal-mcp.service';
import { McpAuthGuard } from './mcp-auth.guard';
import { PersonaMcpService } from './persona-mcp.service';
import { ProjectMcpService } from './project-mcp.service';
import { ProjectSchemaResource } from './resources';
import { RiskMcpService } from './risk-mcp.service';
import { TaskMcpService } from './task-mcp.service';

@Module({
  imports: [
    ConfigModule.forFeature(loadConfig),
    NestMcpModule.forRoot({
      name: 'forgeofwill-mcp-server',
      version: '1.0.0',
      guards: [McpAuthGuard],
    }),
  ],
})
export class McpServerModule {}

@Module({
  imports: [McpServerModule],
  providers: [
    {
      provide: ServiceTokens.PROJECT_PLANNING_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
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
    ProjectMcpService,
    TaskMcpService,
    RiskMcpService,
    ChangeMcpService,
    JournalMcpService,
    ProjectSchemaResource,
  ],
  exports: [
    ProjectMcpService,
    TaskMcpService,
    RiskMcpService,
    ChangeMcpService,
    JournalMcpService,
  ],
})
export class ProjectPlanningMcpToolsModule {}

@Module({
  imports: [McpServerModule],
  providers: [
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
    PersonaMcpService,
  ],
  exports: [PersonaMcpService],
})
export class TelosDocsMcpToolsModule {}
