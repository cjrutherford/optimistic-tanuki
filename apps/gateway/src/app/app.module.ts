import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TcpServiceConfig, loadConfig } from '../config';

import { AssetController } from '../controllers/asset.controller';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticationController } from '../controllers/authentication/authentication.controller';
import { JwtService } from '@nestjs/jwt';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { Module } from '@nestjs/common';
import { ProfileController } from '../controllers/profile/profile.controller';
import { ProjectPlanningController } from '../controllers/project-planning/project-planning.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { SocialController } from '../controllers/social/social.controller';
import { ChatGateway } from './chat-gateway/chat.gateway';

/**
 * The main application module.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    LoggerModule,
  ],
  controllers: [
    AuthenticationController,
    ProfileController,
    SocialController,
    AssetController,
    ProjectPlanningController,
  ],
  providers: [
    AuthGuard,
    JwtService,
    {
      provide: ServiceTokens.AUTHENTICATION_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.authentication'
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
      provide: ServiceTokens.PROFILE_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.profile');
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
      provide: ServiceTokens.SOCIAL_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.social');
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
      provide: ServiceTokens.ASSETS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.asset');
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
      provide: ServiceTokens.CHAT_COLLECTOR_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.chat_collector'
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
    ChatGateway,
  ],
})
export class AppModule {}
