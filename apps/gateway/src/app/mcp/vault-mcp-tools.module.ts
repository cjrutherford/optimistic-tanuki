import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { McpModule as NestMcpModule } from '@rekog/mcp-nest';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { loadConfig, TcpServiceConfig } from '../../config';
import { VaultTenantResolver } from '../../security/vault-tenant-resolver.service';
import { McpServerModule } from './mcp-tools.module';
import { VaultMcpService } from './vault-mcp.service';
import { VaultModelService } from './air-gap/vault-model.service';

/**
 * The vault tools, registered with the same server as the project tools.
 *
 * Registered rather than merely provided, for the reason the file this sits
 * beside documents at length: discovery walks the subtree of whichever module
 * imports `McpModule.forRoot`, so a tool that is written and provided but never
 * handed to `forFeature` is a tool no agent can call, and nothing fails loudly
 * when that happens.
 *
 * The downstream clients are declared here rather than imported from the root
 * module, matching `ProjectPlanningMcpToolsModule`: the MCP server must be able
 * to stand up its own tools whether or not the rest of the gateway is in scope.
 */
@Module({
  imports: [
    ConfigModule.forFeature(loadConfig),
    McpServerModule,
    NestMcpModule.forFeature([VaultMcpService], 'forgeofwill-mcp-server'),
  ],
  providers: [
    {
      provide: ServiceTokens.COMPLIANCE_AUDIT_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.compliance_audit'
        ) ?? {
          name: 'compliance_audit',
          transport: Transport.TCP,
          host: process.env.SERVICE_COMPLIANCE_AUDIT_HOST || 'localhost',
          port: parseInt(
            process.env.SERVICE_COMPLIANCE_AUDIT_PORT || '3025',
            10
          ),
        };
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host: serviceConfig.host, port: serviceConfig.port },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.FINANCE_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.finance');
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: { host: serviceConfig.host, port: serviceConfig.port },
        });
      },
      inject: [ConfigService],
    },
    VaultTenantResolver,
    VaultModelService,
    VaultMcpService,
  ],
  exports: [VaultMcpService],
})
export class VaultMcpToolsModule {}
