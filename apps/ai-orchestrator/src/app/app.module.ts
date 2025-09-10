import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { loadConfig } from './config';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { LoggerModule } from '@optimistic-tanuki/logger';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      load: [loadConfig],
    })
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: ServiceTokens.PROMPT_PROXY,
      useFactory: (config: ConfigService) => {
        const options = config.get('dependencies.prompt_proxy')
        if(!options) {
          throw new Error('Prompt Proxy configuration not found');
        }
        return ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            port: options.port,
            host: options.host,
          }
        })
      },
      inject: [ConfigService]
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
          }
        });
      },
      inject: [ConfigService]
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
          }
        });
      },
      inject: [ConfigService]
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
          }
        });
      },
      inject: [ConfigService]
    }
  ],
})
export class AppModule {}
