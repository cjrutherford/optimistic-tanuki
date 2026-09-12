import {
  Controller,
  Get,
  Inject,
  Param,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens, WorkspaceCommands } from '@optimistic-tanuki/constants';
import {
  isResolvedWorkspace,
  ResolvedWorkspace,
  WorkspaceKind,
  WorkspaceStatus,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { toWorkspaceHttpException } from '../../app/workspace-context/workspace-resolver.service';

export interface DiscoveredWorkspace {
  workspaceId: string;
  kind: WorkspaceKind;
  slug: string;
  displayName: string;
  appScope: string;
  status: WorkspaceStatus;
  appInstanceId: string;
  configurationId: string;
  membershipRole: 'owner' | 'admin' | 'moderator' | 'member';
  membershipStatus: 'invited' | 'active' | 'suspended' | 'removed';
}

interface ResolvedAppConfigContext {
  ownerUserId: string;
  ownerProfileId: string;
  workspaceId: string;
  appScope: string;
  appInstanceId: string;
  membershipId: string;
  membershipRole: DiscoveredWorkspace['membershipRole'];
  membershipStatus: DiscoveredWorkspace['membershipStatus'];
}

interface AppConfigurationIdentity {
  id: string;
  workspaceId: string;
  appInstanceId: string;
  appScope: string;
}

const APP_CONFIG_COMMANDS = {
  RESOLVE_CONTEXT: { cmd: 'app-config.resolveContext' },
  GET_BY_CONTEXT: { cmd: 'app-config.getByContext' },
};

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspaceDiscoveryController {
  constructor(
    @Inject(ServiceTokens.WORKSPACE_SERVICE)
    private readonly workspaceClient: ClientProxy,
    @Optional()
    @Inject(ServiceTokens.APP_CONFIGURATOR_SERVICE)
    private readonly appConfigClient?: ClientProxy
  ) {}

  @Get()
  async list(@User() user: UserDetails): Promise<DiscoveredWorkspace[]> {
    const workspaces = await this.request(WorkspaceCommands.LIST_OWNED, {
      ownerUserId: user.userId,
      ownerProfileId: user.profileId,
    });
    if (!Array.isArray(workspaces) || !workspaces.every(isResolvedWorkspace)) {
      throw new ServiceUnavailableException(
        'Workspace service returned an invalid discovery response'
      );
    }
    const discovered = await Promise.all(
      workspaces.map((workspace) =>
        this.resolveDiscoveredWorkspace(workspace, user)
      )
    );
    return discovered.filter(
      (workspace): workspace is DiscoveredWorkspace => workspace !== undefined
    );
  }

  @Get(':workspaceId')
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @User() user: UserDetails
  ): Promise<DiscoveredWorkspace> {
    const workspace = await this.request(WorkspaceCommands.RESOLVE_OWNED, {
      workspaceId,
      ownerUserId: user.userId,
      ownerProfileId: user.profileId,
    });
    if (!isResolvedWorkspace(workspace)) {
      throw new ServiceUnavailableException(
        'Workspace service returned an invalid discovery response'
      );
    }
    const discovered = await this.resolveDiscoveredWorkspace(workspace, user);
    if (!discovered) {
      throw new NotFoundException('Workspace was not found');
    }
    return discovered;
  }

  private async resolveDiscoveredWorkspace(
    workspace: ResolvedWorkspace,
    user: UserDetails
  ): Promise<DiscoveredWorkspace | undefined> {
    if (workspace.status !== 'active' || !this.appConfigClient) {
      return undefined;
    }

    let context: ResolvedAppConfigContext;
    try {
      context = await firstValueFrom(
        this.appConfigClient.send(APP_CONFIG_COMMANDS.RESOLVE_CONTEXT, {
          ownerUserId: user.userId,
          ownerProfileId: user.profileId,
          workspaceId: workspace.workspaceId,
          appScope: workspace.appScope,
        })
      );
    } catch (error) {
      const httpError = toWorkspaceHttpException(
        error,
        'App configuration context resolution failed'
      );
      if ([400, 403, 404].includes(httpError.getStatus())) {
        return undefined;
      }
      throw httpError;
    }

    if (
      !context ||
      context.ownerUserId !== user.userId ||
      context.ownerProfileId !== user.profileId ||
      context.workspaceId !== workspace.workspaceId ||
      context.appScope !== workspace.appScope ||
      typeof context.appInstanceId !== 'string' ||
      context.appInstanceId.length === 0 ||
      typeof context.membershipId !== 'string' ||
      context.membershipId.length === 0 ||
      context.membershipRole !== 'owner' ||
      context.membershipStatus !== 'active'
    ) {
      return undefined;
    }

    let configuration!: AppConfigurationIdentity;
    try {
      configuration = await firstValueFrom(
        this.appConfigClient.send(APP_CONFIG_COMMANDS.GET_BY_CONTEXT, {
          context,
        })
      );
    } catch (error) {
      const httpError = toWorkspaceHttpException(
        error,
        'App configuration discovery failed'
      );
      if ([400, 403, 404].includes(httpError.getStatus())) {
        return undefined;
      }
      throw httpError;
    }

    if (
      !configuration ||
      typeof configuration.id !== 'string' ||
      configuration.workspaceId !== context.workspaceId ||
      configuration.appInstanceId !== context.appInstanceId ||
      configuration.appScope !== context.appScope
    ) {
      return undefined;
    }

    return {
      workspaceId: workspace.workspaceId,
      kind: workspace.kind,
      slug: workspace.slug,
      displayName: workspace.displayName,
      appScope: workspace.appScope,
      status: workspace.status,
      appInstanceId: context.appInstanceId,
      configurationId: configuration.id,
      membershipRole: context.membershipRole,
      membershipStatus: context.membershipStatus,
    };
  }

  private async request<T>(pattern: string, payload: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.workspaceClient.send(pattern, payload));
    } catch (error) {
      throw toWorkspaceHttpException(error);
    }
  }
}
