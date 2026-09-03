import { Module } from '@nestjs/common';
import { McpModule as NestMcpModule } from '@rekog/mcp-nest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { loadConfig, TcpServiceConfig } from '../../config';
import { ApprovalGate } from './approval-gate.service';
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

/**
 * The tools have to be registered with the server, not merely provided.
 *
 * Discovery walks the subtree of whichever module imports McpModule.forRoot.
 * That is McpServerModule, and no tool lives there, so the server came up
 * advertising no capabilities at all and answered "Method not found" to
 * tools/list. Every tool in this file existed and none of them could be
 * reached, which is why an agent had never called one.
 *
 * forFeature is how the library is told that providers in another module
 * belong to a named server.
 */
@Module({
  imports: [
    McpServerModule,
    NestMcpModule.forFeature(
      [
        ProjectMcpService,
        TaskMcpService,
        RiskMcpService,
        ChangeMcpService,
        JournalMcpService,
        ProjectSchemaResource,
      ],
      'forgeofwill-mcp-server'
    ),
  ],
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
    ApprovalGate,
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
  imports: [
    McpServerModule,
    NestMcpModule.forFeature([PersonaMcpService], 'forgeofwill-mcp-server'),
  ],
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
