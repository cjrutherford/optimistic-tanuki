import {
  Body,
  ConflictException,
  Controller,
  Inject,
  NotFoundException,
  Post,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ServiceTokens,
  AppScopeCommands,
  CommunityCommands,
  RoleCommands,
  TrainerConfigCommands,
  WorkspaceCommands,
  getWorkspaceOwnerPermissionContract,
  WORKSPACE_OWNER_PERMISSION_CONTRACTS,
  WorkspaceOwnerPermissionContract,
} from '@optimistic-tanuki/constants';
import { workspaceScopeName } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { AppScope } from '../../decorators/appscope.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';

type WorkspaceProvisionBody = {
  appScope?: string;
  slug?: string;
  displayName?: string;
};

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspaceClaimController {
  constructor(
    @Inject(ServiceTokens.STORE_SERVICE)
    private readonly storeClient: ClientProxy,
    @Inject(ServiceTokens.WORKSPACE_SERVICE)
    private readonly workspaceClient: ClientProxy,
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy
  ) {}

  @Post('business-sites/claim')
  async claimBusinessSite(
    @Body() body: { slug?: string; returnPath?: string },
    @User() user: UserDetails,
    @AppScope() appScope: string
  ) {
    this.requireVerifiedEmail(user);
    const slug = body.slug?.trim();
    if (!slug) {
      throw new NotFoundException('A stable business-site slug is required');
    }
    if (appScope !== 'business-site') {
      throw new ConflictException(
        'Business-site claims require the business-site app scope'
      );
    }

    const result = (await firstValueFrom(
      this.storeClient.send(TrainerConfigCommands.GET_CONFIG, {
        configKey: 'default',
        slug,
      })
    )) as {
      id?: string;
      config?: {
        leadContext?: { profileId?: string; appScope?: string };
        brand?: { businessName?: string };
      };
    } | null;
    const configId =
      result?.id ?? (result as { configId?: string } | null)?.configId;
    if (!configId || !result?.config) {
      throw new NotFoundException('Business-site configuration was not found');
    }
    if (result.config.leadContext?.profileId !== user.profileId) {
      throw new ConflictException(
        'This business-site configuration belongs to another owner'
      );
    }

    const workspace = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.REGISTER, {
        kind: 'business-site',
        slug,
        displayName: result.config.brand?.businessName?.trim() || slug,
        appScope: 'business-site',
        ownerUserId: user.userId,
        ownerProfileId: user.profileId,
        source: { service: 'store', sourceId: configId },
      })
    );

    const activated = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.ACTIVATE, {
        workspaceId: workspace.workspaceId,
        appScope: 'business-site',
        source: { service: 'store', sourceId: configId },
      })
    );
    await this.ensureWorkspaceOwnerAssignment(
      activated.workspaceId,
      user.profileId,
      WORKSPACE_OWNER_PERMISSION_CONTRACTS['business-site']
    );
    return {
      workspace: activated,
      returnPath: this.safeReturnPath(body.returnPath),
    };
  }

  @Post('business-sites/provision')
  async provisionBusinessSite(
    @Body() body: WorkspaceProvisionBody,
    @User() user: UserDetails,
    @AppScope() appScope: string
  ) {
    this.requireVerifiedEmail(user);
    const requestedScope = body.appScope?.trim() || appScope;
    if (requestedScope !== appScope) {
      throw new ConflictException(
        'Provisioning app scope must match the authenticated app scope'
      );
    }

    if (!['business-site', 'configurable-client'].includes(requestedScope)) {
      throw new ConflictException(
        'Workspace provisioning is not enabled for this app scope'
      );
    }
    const ownerContract = getWorkspaceOwnerPermissionContract(requestedScope);
    if (!ownerContract) {
      throw new ConflictException(
        'Workspace provisioning is not enabled for this app scope'
      );
    }

    if (requestedScope === 'configurable-client') {
      const slug =
        body.slug?.trim() || `owner-${requestedScope}-${user.profileId}`;
      const displayName =
        body.displayName?.trim() || 'Configurable Client Workspace';
      const source = {
        service: 'app-configurator',
        sourceId: user.profileId,
      };
      const workspace = await firstValueFrom(
        this.workspaceClient.send(WorkspaceCommands.REGISTER, {
          kind: 'business-site',
          slug,
          displayName,
          appScope: requestedScope,
          ownerUserId: user.userId,
          ownerProfileId: user.profileId,
          source,
        })
      );
      const activated = await firstValueFrom(
        this.workspaceClient.send(WorkspaceCommands.ACTIVATE, {
          workspaceId: workspace.workspaceId,
          appScope: requestedScope,
          source,
        })
      );
      await this.ensureWorkspaceOwnerAssignment(
        activated.workspaceId,
        user.profileId,
        ownerContract
      );
      return { workspace: activated, created: true };
    }

    type BusinessSiteProvisioningConfig = {
      site?: { slug?: string };
      brand?: { businessName?: string };
    };
    const existing = (await firstValueFrom(
      this.storeClient.send(TrainerConfigCommands.GET_CONFIG, {
        profileId: user.profileId,
      })
    )) as {
      id?: string;
      configId?: string | null;
      config?: BusinessSiteProvisioningConfig | null;
    } | null;

    const created = !existing?.config;
    let configId = existing?.id ?? existing?.configId ?? undefined;
    let config = existing?.config ?? undefined;
    if (!config) {
      const createdConfig = (await firstValueFrom(
        this.storeClient.send(TrainerConfigCommands.CREATE_CONFIG, {
          configKey: `business-site:${user.profileId}`,
          businessType: 'general',
          site: { slug: `owner-${user.profileId}`, status: 'draft' },
          leadContext: {
            profileId: user.profileId,
            appScope: 'business-site',
          },
          brand: { businessName: 'Your Business' },
        })
      )) as {
        id?: string;
        configId?: string;
        config?: BusinessSiteProvisioningConfig;
      };
      configId = createdConfig.id ?? createdConfig.configId;
      config = createdConfig.config;
    }
    const slug = config?.site?.slug?.trim();
    if (!configId || !config || !slug) {
      throw new NotFoundException(
        'Business-site provisioning did not return a stable configuration'
      );
    }

    const workspace = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.REGISTER, {
        kind: 'business-site',
        slug,
        displayName: config.brand?.businessName?.trim() || 'Your Business',
        appScope: 'business-site',
        ownerUserId: user.userId,
        ownerProfileId: user.profileId,
        source: { service: 'store', sourceId: configId },
      })
    );
    const activated = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.ACTIVATE, {
        workspaceId: workspace.workspaceId,
        appScope: 'business-site',
        source: { service: 'store', sourceId: configId },
      })
    );
    await this.ensureWorkspaceOwnerAssignment(
      activated.workspaceId,
      user.profileId,
      WORKSPACE_OWNER_PERMISSION_CONTRACTS['business-site']
    );

    return { workspace: activated, created };
  }

  @Post('communities/claim')
  async claimCommunity(
    @Body() body: { slug?: string; returnPath?: string },
    @User() user: UserDetails,
    @AppScope() appScope: string
  ) {
    this.requireVerifiedEmail(user);
    const slug = body.slug?.trim();
    if (!slug) {
      throw new NotFoundException('A stable community slug is required');
    }
    const community = (await firstValueFrom(
      this.socialClient.send({ cmd: CommunityCommands.FIND_BY_SLUG }, { slug })
    )) as {
      id?: string;
      name?: string;
      ownerId?: string;
      ownerProfileId?: string;
      appScope?: string;
    } | null;
    if (!community?.id || !community.ownerId || !community.ownerProfileId) {
      throw new NotFoundException('Community was not found');
    }
    if (
      community.ownerId !== user.userId ||
      community.ownerProfileId !== user.profileId ||
      community.appScope !== appScope
    ) {
      throw new ConflictException('This community belongs to another owner');
    }

    const workspace = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.REGISTER, {
        kind: 'community',
        slug,
        displayName: community.name?.trim() || slug,
        appScope,
        ownerUserId: community.ownerId,
        ownerProfileId: community.ownerProfileId,
        source: { service: 'social', sourceId: community.id },
      })
    );
    const activated = await firstValueFrom(
      this.workspaceClient.send(WorkspaceCommands.ACTIVATE, {
        workspaceId: workspace.workspaceId,
        appScope,
        source: { service: 'social', sourceId: community.id },
      })
    );
    await this.ensureWorkspaceOwnerAssignment(
      activated.workspaceId,
      user.profileId,
      { label: 'Community', roleName: 'community_manager', appScope }
    );
    return {
      workspace: activated,
      returnPath: this.safeReturnPath(body.returnPath, `/communities/${slug}`),
    };
  }

  private safeReturnPath(
    returnPath: string | undefined,
    fallback = '/owner/site'
  ): string {
    return returnPath?.startsWith('/') && !returnPath.startsWith('//')
      ? returnPath
      : fallback;
  }

  private requireVerifiedEmail(user: UserDetails): void {
    if (user.emailVerified !== true) {
      throw new ForbiddenException(
        'Email verification is required before claiming a workspace'
      );
    }
  }

  private async ensureWorkspaceOwnerAssignment(
    workspaceId: string,
    profileId: string,
    contract:
      | WorkspaceOwnerPermissionContract
      | {
          label: string;
          roleName: string;
          appScope: string;
        }
  ): Promise<void> {
    const name = workspaceScopeName(workspaceId);
    const existing = await firstValueFrom(
      this.permissionsClient.send({ cmd: AppScopeCommands.GetByName }, { name })
    );
    const workspaceScope =
      existing ||
      (await firstValueFrom(
        this.permissionsClient.send(
          { cmd: AppScopeCommands.Create },
          {
            name,
            description: `${contract.label} workspace permission scope`,
            active: true,
          }
        )
      ));
    const ownerRole = await firstValueFrom(
      this.permissionsClient.send(
        { cmd: RoleCommands.GetByName },
        { name: contract.roleName, appScope: contract.appScope }
      )
    );
    if (!ownerRole?.id || !workspaceScope?.id) {
      throw new NotFoundException(
        'Workspace owner permissions are not configured'
      );
    }
    await firstValueFrom(
      this.permissionsClient.send(
        { cmd: RoleCommands.Assign },
        { roleId: ownerRole.id, profileId, appScopeId: workspaceScope.id }
      )
    );
  }
}
