import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TcpServiceConfig, loadConfig } from '../config';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';

import { AssetController } from '../controllers/asset.controller';
import { PalettesController } from '../controllers/palettes.controller';
import { PersonalitiesController } from '../controllers/personalities.controller';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticationController } from '../controllers/authentication/authentication.controller';
import { JwtService } from '@nestjs/jwt';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { Module } from '@nestjs/common';
import { ProfileController } from '../controllers/profile/profile.controller';
import { ProjectPlanningController } from '../controllers/project-planning/project-planning.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { SocialController } from '../controllers/social/social.controller';
import { FollowController } from '../controllers/social/follow/follow.controller';
import { ChatGateway } from './chat-gateway/chat.gateway';
import { SocialGateway } from './social-gateway/social.gateway';
import { ContactController } from '../controllers/blogging/contact.controller';
import { PostController } from '../controllers/blogging/post.controller';
import { EventController } from '../controllers/blogging/event.controller';
import { BlogController } from '../controllers/blogging/blog.controller';
import { BlogComponentController } from '../controllers/blogging/blog-component.controller';
import { PermissionsController } from '../controllers/permissions/permissions.controller';
import { PermissionsGuard } from '../guards/permissions.guard';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { CacheProviderFactory } from '../auth/cache/cache-provider.factory';
import { McpToolsModule } from './mcp/mcp-tools.module';
import { PersonaController } from '../controllers/persona/persona.controller';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { StoreController } from '../controllers/store/store.controller';
import { PermissionsProxyService } from '../auth/permissions-proxy.service';
import { AppConfigController } from '../controllers/app-config/app-config.controller';
import { ForumController } from '../controllers/forum/forum.controller';
import { SocialComponentController } from '../controllers/social/social-component.controller';
import { CommunityController } from '../controllers/social/community/community.controller';
import { WellnessController } from '../controllers/wellness/wellness.controller';
import { ClassifiedsController } from '../controllers/classifieds/classifieds.controller';
import { CommunitiesController } from '../controllers/communities/communities.controller';
import { NotificationController } from '../controllers/social/notification/notification.controller';
import { SearchController } from '../controllers/social/search/search.controller';
import { PrivacyController } from '../controllers/social/privacy/privacy.controller';
import { ActivityController } from '../controllers/social/activity/activity.controller';
import { PresenceController } from '../controllers/social/presence/presence.controller';
import { ProfileAnalyticsController } from '../controllers/social/profile-analytics/profile-analytics.controller';
import { PollController } from '../controllers/social/poll/poll.controller';
import { PostShareController } from '../controllers/social/post-share/post-share.controller';
import { SocialEventController } from '../controllers/social/social-event/social-event.controller';
import { PaymentsController } from '../controllers/payments/payments.controller';
import { DonationsController } from '../controllers/donations/donations.controller';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10000, // Increased for E2E
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50000, // Increased for E2E
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100000, // Increased for E2E
      },
    ]),
    LoggerModule,
    McpToolsModule,
  ],
  controllers: [
    PalettesController,
    PersonalitiesController,
    AuthenticationController,
    ProfileController,
    SocialController,
    SocialComponentController,
    CommunityController,
    FollowController,
    AssetController,
    ProjectPlanningController,
    ContactController,
    PostController,
    EventController,
    BlogController,
    BlogComponentController,
    PermissionsController,
    PersonaController,
    StoreController,
    AppConfigController,
    ForumController,
    WellnessController,
    ClassifiedsController,
    CommunitiesController,
    NotificationController,
    SearchController,
    PrivacyController,
    ActivityController,
    PresenceController,
    ProfileAnalyticsController,
    PollController,
    PostShareController,
    SocialEventController,
    PaymentsController,
    DonationsController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AuthGuard,
    PermissionsGuard,
    PermissionsProxyService,
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
      inject: [ConfigService],
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
    {
      provide: ServiceTokens.STORE_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.store');
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
      provide: ServiceTokens.APP_CONFIGURATOR_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.app_configurator'
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
      provide: ServiceTokens.FORUM_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.forum');
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
      provide: ServiceTokens.WELLNESS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig =
          configService.get<TcpServiceConfig>('services.wellness');
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
      provide: ServiceTokens.CLASSIFIEDS_SERVICE,
      useFactory: (configService: ConfigService) => {
        const serviceConfig = configService.get<TcpServiceConfig>(
          'services.classifieds'
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
