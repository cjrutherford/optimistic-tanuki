/** Real production routes for the opt-in, loopback-only R4 journey fixture. */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';
import {
  LoginAccountBootstrapService,
  RegisterAccountBootstrapService,
} from '@optimistic-tanuki/auth-feature-account-bootstrap';
import { AuthenticationController } from '../../../gateway/src/controllers/authentication/authentication.controller';
import { ProfileController } from '../../../gateway/src/controllers/profile/profile.controller';
import { CommunityController } from '../../../gateway/src/controllers/social/community/community.controller';
import { CommunitiesController } from '../../../gateway/src/controllers/communities/communities.controller';
import { ClassifiedsController } from '../../../gateway/src/controllers/classifieds/classifieds.controller';
import { PaymentsController } from '../../../gateway/src/controllers/payments/payments.controller';
import { AssetController } from '../../../gateway/src/controllers/asset.controller';
import { ChatController } from '../../../gateway/src/controllers/chat/chat.controller';
import { SocialController } from '../../../gateway/src/controllers/social/social.controller';
import { PermissionsController } from '../../../gateway/src/controllers/permissions/permissions.controller';
import { CommunityWorkspaceProvisioner } from '../../../gateway/src/app/community-provisioning/community-workspace-provisioner.service';
import { PermissionsGuard } from '../../../gateway/src/guards/permissions.guard';
import { WorkspaceContextGuard } from '../../../gateway/src/guards/workspace-context.guard';
import { WorkspaceResolverService } from '../../../gateway/src/app/workspace-context/workspace-resolver.service';
import { IdentityThrottlerGuard } from '../../../gateway/src/controllers/learning/identity-throttler.guard';
import type { D27WorkerConfig } from './d27-owner.worker';
import { OAuthController } from '../../../gateway/src/controllers/oauth/oauth.controller';
import { FollowController } from '../../../gateway/src/controllers/social/follow/follow.controller';
import { PrivacyController } from '../../../gateway/src/controllers/social/privacy/privacy.controller';
import { NotificationController } from '../../../gateway/src/controllers/social/notification/notification.controller';
import { GatewayNotificationRecipientService } from '../../../gateway/src/controllers/social/notification/gateway-notification-recipient.service';
export function r4GatewayComposition(
  fixture: D27WorkerConfig,
  clients: Record<string, ClientProxy>,
  disabled: ClientProxy
) {
  const role = new RoleInitService(clients['permissions']);
  const config = new ConfigService({
    services: {
      payments: fixture.endpoints['payments'],
      social: fixture.endpoints['social'],
    },
    ASSETS_INTERNAL_MEDIA_URL: `http://127.0.0.1:${fixture.mediaPort}`,
    ASSETS_INTERNAL_MEDIA_TOKEN: fixture.proofKey,
    assetUrl: `http://127.0.0.1:${fixture.listen.port}/api/asset`,
  });
  return {
    imports: [
      ThrottlerModule.forRoot([
        { name: 'short', ttl: 1000, limit: 1000 },
        { name: 'long', ttl: 60000, limit: 1000 },
      ]),
    ],
    controllers: [
      ...(process.env['R6_RELEASE'] === '1'
        ? [
            OAuthController,
            FollowController,
            PrivacyController,
            NotificationController,
          ]
        : []),
      AuthenticationController,
      ProfileController,
      CommunityController,
      CommunitiesController,
      ClassifiedsController,
      PaymentsController,
      AssetController,
      ChatController,
      SocialController,
      PermissionsController,
    ],
    providers: [
      Logger,
      GatewayNotificationRecipientService,
      PermissionsGuard,
      WorkspaceContextGuard,
      WorkspaceResolverService,
      IdentityThrottlerGuard,
      CommunityWorkspaceProvisioner,
      { provide: ConfigService, useValue: config },
      { provide: RoleInitService, useValue: role },
      {
        provide: LoginAccountBootstrapService,
        useValue: new LoginAccountBootstrapService(
          clients['authentication'],
          clients['profile'],
          clients['permissions'],
          role
        ),
      },
      {
        provide: RegisterAccountBootstrapService,
        useValue: new RegisterAccountBootstrapService(
          clients['authentication'],
          clients['profile'],
          role
        ),
      },
      ...[
        ['PROFILE_SERVICE', 'profile'],
        ['SOCIAL_SERVICE', 'social'],
        ['CLASSIFIEDS_SERVICE', 'classifieds'],
        ['ASSETS_SERVICE', 'assets'],
        ['FORUM_SERVICE', 'forum'],
        ['CHAT_COLLECTOR_SERVICE', 'chat-collector'],
        ['WORKSPACE_SERVICE', 'workspace'],
      ].map(([token, owner]) => ({
        provide: ServiceTokens[token as keyof typeof ServiceTokens],
        useValue: clients[owner],
      })),
      ...[
        'AI_ORCHESTRATION_SERVICE',
        'TELOS_DOCS_SERVICE',
        'STORE_SERVICE',
      ].map((token) => ({
        provide: ServiceTokens[token as keyof typeof ServiceTokens],
        useValue: disabled,
      })),
    ],
  };
}
