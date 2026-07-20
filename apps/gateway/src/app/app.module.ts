import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TcpServiceConfig, loadConfig } from '../config';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';
import {
  LoginAccountBootstrapService,
  RegisterAccountBootstrapService,
} from '@optimistic-tanuki/auth-feature-account-bootstrap';

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
import { PersonaController } from '../controllers/persona/persona.controller';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RequestTimeoutInterceptor } from '../interceptors/request-timeout.interceptor';
import { StoreController } from '../controllers/store/store.controller';
import { PermissionsProxyService } from '../auth/permissions-proxy.service';
import { AppConfigController } from '../controllers/app-config/app-config.controller';
import { ForumController } from '../controllers/forum/forum.controller';
import { FinanceController } from '../controllers/finance/finance.controller';
import { OAuthController } from '../controllers/oauth/oauth.controller';
import { VideosController } from '../controllers/videos/videos.controller';
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
import { ChatController } from '../controllers/chat/chat.controller';
import { PaymentsController } from '../controllers/payments/payments.controller';
import { DonationsController } from '../controllers/donations/donations.controller';
import { LeadsController } from '../controllers/leads/leads.controller';
import { HardwareController } from '../controllers/hardware/hardware.controller';
import { TrainerController } from '../controllers/trainer/trainer.controller';
import { LocalityDiscoveryController } from '../controllers/locality/locality-discovery.controller';
import {
  GATEWAY_APP_REGISTRY,
  GATEWAY_NAVIGATION_LINKS,
  RegistryController,
} from '../controllers/registry/registry.controller';
import { DEFAULT_NAVIGATION_LINKS } from '@optimistic-tanuki/app-registry-backend';
import { loadConfiguredRegistry } from '../controllers/registry/registry.config';
import {
  ComposableEntry,
  filterEnabledEntries,
  loadGatewayCompositionFromFile,
  normalizeGatewayComposition,
} from './gateway-composition';
import {
  createMcpToolImports,
  createGatewayServiceProviders,
} from './gateway-service-providers';

const gatewayServices = [
  'authentication',
  'profile',
  'social',
  'assets',
  'project-planning',
  'chat-collector',
  'telos-docs-service',
  'ai-orchestration',
  'blogging',
  'permissions',
  'store',
  'app-configurator',
  'forum',
  'finance',
  'wellness',
  'classifieds',
  'payments',
  'lead-tracker',
  'system-configurator-api',
  'videos',
] as const;

const gatewayComposition = normalizeGatewayComposition(
  loadGatewayCompositionFromFile(process.env.GATEWAY_COMPOSITION_PATH),
  [...gatewayServices]
);

type ValueComposableEntry<T> = ComposableEntry<T> & { value: T };

const controllerEntries: Array<ValueComposableEntry<any>> =
  filterEnabledEntries(
    [
      { id: 'palettes', value: PalettesController },
      { id: 'personalities', value: PersonalitiesController },
      {
        id: 'authentication',
        requiredServices: ['authentication', 'profile'],
        value: AuthenticationController,
      },
      {
        id: 'profile',
        requiredServices: [
          'profile',
          'ai-orchestration',
          'authentication',
          'telos-docs-service',
          'permissions',
          'social',
        ],
        value: ProfileController,
      },
      { id: 'social', requiredServices: ['social'], value: SocialController },
      {
        id: 'social-components',
        requiredServices: ['social'],
        value: SocialComponentController,
      },
      {
        id: 'community',
        requiredServices: ['social', 'permissions', 'chat-collector'],
        value: CommunityController,
      },
      {
        id: 'chat',
        requiredServices: ['chat-collector'],
        value: ChatController,
      },
      {
        id: 'follow',
        requiredServices: ['social', 'profile'],
        value: FollowController,
      },
      {
        id: 'asset',
        requiredServices: ['assets', 'authentication', 'permissions'],
        value: AssetController,
      },
      {
        id: 'project-planning',
        requiredServices: ['project-planning'],
        value: ProjectPlanningController,
      },
      {
        id: 'contact',
        requiredServices: ['blogging'],
        value: ContactController,
      },
      { id: 'post', requiredServices: ['blogging'], value: PostController },
      { id: 'event', requiredServices: ['blogging'], value: EventController },
      { id: 'blog', requiredServices: ['blogging'], value: BlogController },
      {
        id: 'blog-components',
        requiredServices: ['blogging'],
        value: BlogComponentController,
      },
      {
        id: 'permissions',
        requiredServices: ['permissions'],
        value: PermissionsController,
      },
      {
        id: 'persona',
        requiredServices: ['telos-docs-service'],
        value: PersonaController,
      },
      { id: 'store', requiredServices: ['store'], value: StoreController },
      {
        id: 'app-config',
        requiredServices: ['app-configurator'],
        value: AppConfigController,
      },
      { id: 'forum', requiredServices: ['forum'], value: ForumController },
      {
        id: 'oauth',
        requiredServices: ['authentication', 'profile'],
        value: OAuthController,
      },
      {
        id: 'finance',
        requiredServices: ['finance'],
        value: FinanceController,
      },
      { id: 'videos', requiredServices: ['videos'], value: VideosController },
      {
        id: 'wellness',
        requiredServices: ['wellness', 'ai-orchestration'],
        value: WellnessController,
      },
      {
        id: 'classifieds',
        requiredServices: ['classifieds', 'social'],
        value: ClassifiedsController,
      },
      {
        id: 'communities',
        requiredServices: ['social', 'permissions'],
        value: CommunitiesController,
      },
      {
        id: 'locality-discovery',
        requiredServices: ['social', 'payments', 'videos'],
        value: LocalityDiscoveryController,
      },
      {
        id: 'notifications',
        requiredServices: ['social'],
        value: NotificationController,
      },
      {
        id: 'search',
        requiredServices: ['social'],
        value: SearchController,
      },
      {
        id: 'privacy',
        requiredServices: ['social'],
        value: PrivacyController,
      },
      {
        id: 'activity',
        requiredServices: ['social'],
        value: ActivityController,
      },
      {
        id: 'presence',
        requiredServices: ['social'],
        value: PresenceController,
      },
      {
        id: 'profile-analytics',
        requiredServices: ['social'],
        value: ProfileAnalyticsController,
      },
      {
        id: 'poll',
        requiredServices: ['social'],
        value: PollController,
      },
      {
        id: 'post-share',
        requiredServices: ['social'],
        value: PostShareController,
      },
      {
        id: 'social-event',
        requiredServices: ['social'],
        value: SocialEventController,
      },
      {
        id: 'payments',
        requiredServices: ['payments'],
        value: PaymentsController,
      },
      {
        id: 'donations',
        requiredServices: ['payments'],
        value: DonationsController,
      },
      {
        id: 'leads',
        requiredServices: ['lead-tracker'],
        value: LeadsController,
      },
      {
        id: 'hardware',
        requiredServices: ['system-configurator-api'],
        value: HardwareController,
      },
      {
        id: 'trainer',
        requiredServices: ['store', 'lead-tracker'],
        value: TrainerController,
      },
      { id: 'registry', value: RegistryController },
    ] as Array<ValueComposableEntry<any>>,
    gatewayComposition
  ) as Array<ValueComposableEntry<any>>;

const realtimeProviderEntries: Array<ValueComposableEntry<any>> =
  filterEnabledEntries(
    [
      {
        id: 'chat-gateway',
        requiredServices: [
          'chat-collector',
          'ai-orchestration',
          'telos-docs-service',
          'profile',
        ],
        value: ChatGateway,
      },
      {
        id: 'social-gateway',
        requiredServices: ['social'],
        value: SocialGateway,
      },
    ] as Array<ValueComposableEntry<any>>,
    gatewayComposition
  ) as Array<ValueComposableEntry<any>>;
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
    ...createMcpToolImports(gatewayComposition),
  ],
  controllers: controllerEntries.map((entry) => entry.value),
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      // Enforce a uniform request timeout across every gateway route so a
      // slow/hung microservice cannot hang requests indefinitely. Streaming,
      // WebSocket and LLM routes are handled via @LongRunning/@RequestTimeout.
      provide: APP_INTERCEPTOR,
      useClass: RequestTimeoutInterceptor,
    },
    {
      provide: GATEWAY_APP_REGISTRY,
      useFactory: () => loadConfiguredRegistry(process.env.APP_REGISTRY_PATH),
    },
    {
      provide: GATEWAY_NAVIGATION_LINKS,
      useFactory: () => DEFAULT_NAVIGATION_LINKS,
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
        const secret =
          config.get<string>('auth.jwtSecret') ??
          config.get<string>('auth.jwt_secret');

        if (!secret) {
          throw new Error(
            'JWT secret is not configured; set JWT_SECRET or auth.jwtSecret'
          );
        }
        return new JwtService({ secret });
      },
      inject: [ConfigService],
    },
    RoleInitService,
    {
      provide: LoginAccountBootstrapService,
      useFactory: (
        authClient: ClientProxy,
        profileClient: ClientProxy,
        permissionsClient: ClientProxy,
        roleInitService: RoleInitService
      ) =>
        new LoginAccountBootstrapService(
          authClient,
          profileClient,
          permissionsClient,
          roleInitService
        ),
      inject: [
        ServiceTokens.AUTHENTICATION_SERVICE,
        ServiceTokens.PROFILE_SERVICE,
        ServiceTokens.PERMISSIONS_SERVICE,
        RoleInitService,
      ],
    },
    {
      provide: RegisterAccountBootstrapService,
      useFactory: (
        authClient: ClientProxy,
        profileClient: ClientProxy,
        roleInitService: RoleInitService
      ) =>
        new RegisterAccountBootstrapService(
          authClient,
          profileClient,
          roleInitService
        ),
      inject: [
        ServiceTokens.AUTHENTICATION_SERVICE,
        ServiceTokens.PROFILE_SERVICE,
        RoleInitService,
      ],
    },
    ...createGatewayServiceProviders(gatewayComposition),
    ...realtimeProviderEntries.map((entry) => entry.value),
  ],
})
export class AppModule {}
