import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { loadConfig, TcpServiceConfig } from '../../../config';
import { McpServerModule } from '../mcp-tools.module';
import { AudioMcpService } from './audio-mcp.service';

@Module({
  imports: [McpServerModule],
  providers: [
    {
      provide: ServiceTokens.AUDIO_WORKSTATION_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.audio_workstation'
        );
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: serviceConfig?.host || 'audio-workstation',
            port: serviceConfig?.port || 3025,
          },
        });
      },
      inject: [ConfigService],
    },
    AudioMcpService,
  ],
  exports: [AudioMcpService],
})
export class AudioMcpToolsModule {}
