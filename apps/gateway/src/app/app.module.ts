import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TcpServiceConfig, loadConfig } from '../config';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';

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
import { SocialGateway } from './social-gateway/social.gateway';
import { ContactController } from '../controllers/blogging/contact.controller';
import { PostController } from '../controllers/blogging/post.controller';
import { EventController } from '../controllers/blogging/event.controller';
import { BlogController } from '../controllers/blogging/blog.controller';
import { PermissionsController } from '../controllers/permissions/permissions.controller';
import { PermissionsGuard } from '../guards/permissions.guard';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { CacheProviderFactory } from '../auth/cache/cache-provider.factory';

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
    ContactController,
    PostController,
    EventController,
    BlogController,
    PermissionsController,
  ],
  providers: [
    AuthGuard,
    PermissionsGuard,
    {
      provide: PermissionsCacheService,
      useFactory: (configService: ConfigService) => {
        const cacheProvider = CacheProviderFactory.create(configService);
        return new PermissionsCacheService(cacheProvider);
      },
      inject: [ConfigService],
    },
    {
      provide: JwtService, 
      useFactory: (config: ConfigService) => {
        const secret = config.get('auth.jwt_secret') || 'default_jwt_secret';
        return new JwtService({ secret });
      }, 
      inject: [ConfigService]
    },
    RoleInitService,
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
    ChatGateway,
    SocialGateway,
    {
      provide: ServiceTokens.AI_ORCHESTRATION_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.ai_orchestration'
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
      provide: ServiceTokens.BLOG_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.blogging');
        console.log('Blog Service Config:', serviceConfig);
        const client = ClientProxyFactory.create({
          transport: Transport.TCP,
          options: {
            host: serviceConfig.host,
            port: serviceConfig.port,
          },
        });
        console.log('Blog Service Client created:', client);
        return client;
      },
      inject: [ConfigService],
    },
    {
      provide: ServiceTokens.PERMISSIONS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.permissions'
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
  ],
})
export class AppModule {}
