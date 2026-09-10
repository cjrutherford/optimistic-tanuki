import {
  Body,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Put,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
  Optional,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppConfigCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  CreateAppConfigDto,
  AppConfigRequestContext,
  PublishAppConfigDto,
  RollbackAppConfigDto,
  UpdateAppConfigDto,
  PublishedAppConfiguration,
  AppAccessPolicy,
} from '@optimistic-tanuki/app-config-models';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { AppScope } from '../../decorators/appscope.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';
import { Public } from '../../decorators/public.decorator';
import { WorkspaceContext } from '../../decorators/workspace-context.decorator';
import { WorkspaceContextGuard } from '../../guards/workspace-context.guard';
import { adaptAuthenticatedWorkspaceAppContext } from '../../app/workspace-context/workspace-app-context.adapter';
import { firstValueFrom } from 'rxjs';
import { validatePublishedManifestResources } from './published-resource-validator';

const APP_CONFIG_RESOLVE_CONTEXT_COMMAND = {
  cmd: 'app-config.resolveContext',
};

@ApiTags('app-config')
@Controller('app-config')
export class AppConfigController {
  constructor(
    private readonly logger: Logger,
    @Inject(ServiceTokens.APP_CONFIGURATOR_SERVICE)
    private readonly client: ClientProxy,
    @Optional()
    @Inject(ServiceTokens.BLOG_SERVICE)
    private readonly bloggingClient?: ClientProxy
  ) {}

  @RequirePermissions('app-config.create')
  @WorkspaceContext({
    supportedKinds: ['business-site', 'community'],
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Create a new app configuration' })
  @ApiResponse({
    status: 201,
    description: 'Configuration created successfully',
  })
  @Post()
  async createConfiguration(
    @Body() createDto: CreateAppConfigDto,
    @User() user: UserDetails,
    @AppScope() appScope: string,
    @Req() request: any
  ) {
    this.logger.log('Creating app configuration');
    return await firstValueFrom(
      this.client.send(
        { cmd: AppConfigCommands.Create },
        {
          dto: this.stripAuthoritativeMutationFields(createDto),
          context: await this.context(request, user, appScope),
        }
      )
    );
  }

  @RequirePermissions('app-config.read')
  @WorkspaceContext({
    supportedKinds: ['business-site', 'community'],
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get all app configurations' })
  @ApiResponse({ status: 200, description: 'Configurations retrieved' })
  @Get()
  async getAllConfigurations(
    @User() user: UserDetails,
    @AppScope() appScope: string,
    @Req() request: any
  ) {
    this.logger.log('Getting all app configurations');
    return await this.sendQuery(AppConfigCommands.GetAll, {
      context: await this.context(request, user, appScope),
    });
  }

  @ApiOperation({ summary: 'Get app configuration by domain' })
  @ApiResponse({ status: 200, description: 'Configuration found' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Get('by-domain/:domain')
  @Public()
  async getConfigurationByDomain(@Param('domain') domain: string) {
    this.logger.log(`Getting app configuration by domain: ${domain}`);
    return await this.sendQuery(AppConfigCommands.GetPublishedByDomain, {
      domain,
    });
  }

  @ApiOperation({ summary: 'Discover published client apps' })
  @ApiResponse({ status: 200, description: 'Visible published apps' })
  @Get('discover')
  @Public()
  @UseGuards(AuthGuard)
  async discoverPublishedApps(
    @Query('search') search?: string,
    @Query('accessPolicy') accessPolicy?: AppAccessPolicy,
    @User() user?: UserDetails | null
  ): Promise<unknown[]> {
    return (await this.sendQuery(AppConfigCommands.DiscoverPublishedApps, {
      identity: user
        ? { userId: user.userId, profileId: user.profileId }
        : null,
      query: { search, accessPolicy },
    })) as unknown[];
  }

  @ApiOperation({ summary: 'Open a published client app' })
  @ApiResponse({ status: 200, description: 'Published app resolved' })
  @ApiResponse({
    status: 404,
    description: 'App is unavailable or not visible',
  })
  @Get('apps/:id')
  @Public()
  @UseGuards(AuthGuard)
  async resolvePublishedApp(
    @Param('id') id: string,
    @User() user?: UserDetails | null
  ): Promise<PublishedAppConfiguration> {
    return (await this.sendQuery(AppConfigCommands.ResolvePublishedApp, {
      id,
      identity: user
        ? { userId: user.userId, profileId: user.profileId }
        : null,
    })) as PublishedAppConfiguration;
  }

  @ApiOperation({ summary: 'Join a published app' })
  @Post('apps/:id/join')
  @UseGuards(AuthGuard)
  async joinPublishedApp(
    @Param('id') id: string,
    @User() user: UserDetails | null
  ): Promise<unknown> {
    if (!user)
      throw new UnauthorizedException(
        'Authentication is required to join an app'
      );
    this.requireVerifiedAccount(user);
    return await this.sendMutation(AppConfigCommands.JoinPublishedApp, {
      id,
      identity: { userId: user.userId, profileId: user.profileId },
    });
  }

  @ApiOperation({ summary: 'Request access to a published app' })
  @Post('apps/:id/request')
  @UseGuards(AuthGuard)
  async requestPublishedApp(
    @Param('id') id: string,
    @User() user: UserDetails | null
  ): Promise<unknown> {
    if (!user)
      throw new UnauthorizedException(
        'Authentication is required to request app access'
      );
    this.requireVerifiedAccount(user);
    return await this.sendMutation(AppConfigCommands.RequestPublishedApp, {
      id,
      identity: { userId: user.userId, profileId: user.profileId },
    });
  }

  private requireVerifiedAccount(user: UserDetails): void {
    if (user.emailVerified !== true) {
      throw new ForbiddenException(
        'Email verification is required before joining or requesting app access'
      );
    }
  }

  @ApiOperation({ summary: 'Get app configuration by name' })
  @ApiResponse({ status: 200, description: 'Configuration found' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Get('by-name/:name')
  @RequirePermissions('app-config.read')
  @WorkspaceContext({
    supportedKinds: ['business-site', 'community'],
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  async getConfigurationByName(
    @Param('name') name: string,
    @User() user: UserDetails,
    @AppScope() appScope: string,
    @Req() request: any
  ) {
    this.logger.log(`Getting app configuration by name: ${name}`);
    return await this.sendQuery(AppConfigCommands.GetByName, {
      name,
      context: await this.context(request, user, appScope),
    });
  }

  @ApiOperation({ summary: 'Get app configuration by ID' })
  @ApiResponse({ status: 200, description: 'Configuration found' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Get(':id')
  @RequirePermissions('app-config.read')
  @WorkspaceContext({
    supportedKinds: ['business-site', 'community'],
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  async getConfiguration(
    @Param('id') id: string,
    @User() user: UserDetails,
    @AppScope() appScope: string,
    @Req() request: any
  ) {
    this.logger.log(`Getting app configuration: ${id}`);
    return await this.sendQuery(AppConfigCommands.Get, {
      id,
      context: await this.context(request, user, appScope),
    });
  }

  @RequirePermissions('app-config.update')
  @WorkspaceContext({
    supportedKinds: ['business-site', 'community'],
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Update app configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Put(':id')
  async updateConfiguration(
    @Param('id') id: string,
    @Body() updateDto: UpdateAppConfigDto,
    @User() user: UserDetails,
    @AppScope() appScope: string,
    @Req() request: any
  ) {
    this.logger.log(`Updating app configuration: ${id}`);
    return await this.sendMutation(AppConfigCommands.Update, {
      id,
      dto: this.stripAuthoritativeMutationFields(updateDto),
      context: await this.context(request, user, appScope),
    });
  }

  @RequirePermissions('app-config.update')
  @WorkspaceContext({
    supportedKinds: ['business-site', 'community'],
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Publish app configuration' })
  @Post(':id/publish')
  async publishConfiguration(
    @Param('id') id: string,
    @Body() publishDto: PublishAppConfigDto,
    @User() user: UserDetails,
    @AppScope() appScope: string,
    @Req() request: any
  ) {
    this.logger.log(`Publishing app configuration: ${id}`);
    const context = await this.context(request, user, appScope);
    await this.validatePublishedResources(id, context);
    const result = await this.sendMutation(AppConfigCommands.Publish, {
      id,
      dto: this.stripAuthoritativeMutationFields(publishDto),
      context,
    });
    this.assertPublishResponse(result, id, context);
    return result;
  }

  @RequirePermissions('app-config.update')
  @WorkspaceContext({
    supportedKinds: ['business-site', 'community'],
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Rollback app configuration to a published revision',
  })
  @Post(':id/rollback')
  async rollbackConfiguration(
    @Param('id') id: string,
    @Body() rollbackDto: RollbackAppConfigDto,
    @User() user: UserDetails,
    @AppScope() appScope: string,
    @Req() request: any
  ) {
    this.logger.log(`Rolling back app configuration: ${id}`);
    const context = await this.context(request, user, appScope);
    await this.validatePublishedResources(id, context, rollbackDto.version);
    const result = await this.sendMutation(AppConfigCommands.Rollback, {
      id,
      dto: this.stripAuthoritativeMutationFields(rollbackDto),
      context,
    });
    this.assertPublishResponse(result, id, context, 'rollback');
    return result;
  }

  @RequirePermissions('app-config.delete')
  @WorkspaceContext({
    supportedKinds: ['business-site', 'community'],
    source: 'query',
    path: 'workspaceSlug',
    strict: true,
  })
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Delete app configuration' })
  @ApiResponse({ status: 200, description: 'Configuration deleted' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @Delete(':id')
  async deleteConfiguration(
    @Param('id') id: string,
    @User() user: UserDetails,
    @AppScope() appScope: string,
    @Req() request: any
  ) {
    this.logger.log(`Deleting app configuration: ${id}`);
    return await this.sendMutation(AppConfigCommands.Delete, {
      id,
      context: await this.context(request, user, appScope),
    });
  }

  private async context(
    request: any,
    user: UserDetails,
    appScope: string
  ): Promise<AppConfigRequestContext> {
    // P7 dashboard reads and owner actions are intentionally owner-only.
    // The selector supplies navigation context; app-configurator remains the
    // authority for persisted membership and app identity.
    const normalizedAppScope = Array.isArray(appScope) ? appScope[0] : appScope;
    const workspace = request?.workspaceContext?.workspace;
    if (!workspace?.workspaceId) {
      throw new BadRequestException('A resolved workspace is required');
    }

    let resolved: AppConfigRequestContext;
    try {
      resolved = await firstValueFrom(
        this.client.send(APP_CONFIG_RESOLVE_CONTEXT_COMMAND, {
          ownerUserId: user.userId,
          ownerProfileId: user.profileId,
          workspaceId: workspace.workspaceId,
          appScope: normalizedAppScope,
        })
      );
    } catch (error) {
      throw this.toHttpException(
        error,
        'App configuration context resolution failed'
      );
    }

    if (
      resolved?.ownerUserId !== user.userId ||
      resolved?.ownerProfileId !== user.profileId ||
      resolved?.workspaceId !== workspace.workspaceId ||
      resolved?.appScope !== normalizedAppScope ||
      resolved?.membershipRole !== 'owner' ||
      resolved?.membershipStatus !== 'active'
    ) {
      throw new ForbiddenException(
        'An active owner membership is required for this app configuration'
      );
    }

    if (
      typeof resolved.appInstanceId !== 'string' ||
      resolved.appInstanceId.trim().length === 0 ||
      typeof resolved.membershipId !== 'string' ||
      resolved.membershipId.trim().length === 0
    ) {
      throw new ServiceUnavailableException(
        'App configuration context resolution returned an incomplete authoritative identity'
      );
    }

    adaptAuthenticatedWorkspaceAppContext({
      appScope: normalizedAppScope,
      authenticatedUser: {
        userId: user.userId,
        profileId: user.profileId,
      },
      resolvedWorkspace: workspace,
      membership: {
        appInstanceId: resolved.appInstanceId,
        membershipId: resolved.membershipId,
        workspaceId: resolved.workspaceId,
        appScope: resolved.appScope,
        member: {
          userId: user.userId,
          profileId: user.profileId,
        },
        role: resolved.membershipRole,
        status: resolved.membershipStatus,
      },
    });

    return {
      ownerUserId: user.userId,
      ownerProfileId: user.profileId,
      appScope: normalizedAppScope,
      workspaceId: resolved.workspaceId,
      appInstanceId: resolved.appInstanceId,
      membershipId: resolved.membershipId,
      membershipRole: resolved.membershipRole,
      membershipStatus: resolved.membershipStatus,
    };
  }

  private async sendMutation(
    command: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    try {
      return await firstValueFrom(this.client.send({ cmd: command }, payload));
    } catch (error) {
      throw this.toHttpException(error, 'App configuration mutation failed');
    }
  }

  private async validatePublishedResources(
    id: string,
    context: AppConfigRequestContext,
    rollbackVersion?: number
  ): Promise<void> {
    // Unit callers that do not compose Blogging retain the existing app-config
    // behavior; the production gateway always provides this client proxy.
    if (!this.bloggingClient) return;
    const current = (await this.sendQuery(AppConfigCommands.Get, {
      id,
      context,
    })) as any;
    const snapshot =
      rollbackVersion === undefined
        ? current
        : current?.release?.history?.find(
            (revision: any) => revision.version === rollbackVersion
          )?.snapshot;
    await validatePublishedManifestResources(
      snapshot,
      context,
      this.bloggingClient
    );
  }

  private async sendQuery(
    command: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    try {
      return await firstValueFrom(this.client.send({ cmd: command }, payload));
    } catch (error) {
      throw this.toHttpException(error, 'App configuration read failed');
    }
  }

  private stripAuthoritativeMutationFields<T extends object>(dto: T): T {
    const {
      workspaceId: _workspaceId,
      appInstanceId: _appInstanceId,
      membershipId: _membershipId,
      membershipRole: _membershipRole,
      membershipStatus: _membershipStatus,
      ownerUserId: _ownerUserId,
      ownerProfileId: _ownerProfileId,
      appScope: _appScope,
      role: _role,
      status: _status,
      ...legitimateFields
    } = (dto ?? {}) as Record<string, unknown>;

    return legitimateFields as T;
  }

  private assertPublishResponse(
    result: unknown,
    configurationId: string,
    context: AppConfigRequestContext,
    operation: 'publish' | 'rollback' = 'publish'
  ): asserts result is Record<string, unknown> {
    const response =
      result && typeof result === 'object'
        ? (result as Record<string, unknown>)
        : undefined;
    const release =
      response?.release && typeof response.release === 'object'
        ? (response.release as Record<string, unknown>)
        : undefined;

    if (
      response?.id !== configurationId ||
      response.workspaceId !== context.workspaceId ||
      response.appInstanceId !== context.appInstanceId ||
      response.appScope !== context.appScope ||
      typeof response.revision !== 'number' ||
      !Number.isInteger(response.revision) ||
      !release ||
      release.status !== 'published'
    ) {
      throw new ServiceUnavailableException(
        `App configuration ${operation} response did not match the resolved context`
      );
    }

    if (
      (response.ownerUserId !== undefined &&
        response.ownerUserId !== context.ownerUserId) ||
      (response.ownerProfileId !== undefined &&
        response.ownerProfileId !== context.ownerProfileId)
    ) {
      throw new ServiceUnavailableException(
        `App configuration ${operation} response identity did not match the resolved context`
      );
    }
  }

  private toHttpException(
    error: unknown,
    fallbackMessage: string
  ): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    const rpcError =
      typeof (error as any)?.getError === 'function'
        ? (error as any).getError()
        : error;
    const response = (rpcError as any)?.response;
    const nestedError = (rpcError as any)?.error;
    const remote =
      response && typeof response === 'object'
        ? response
        : nestedError && typeof nestedError === 'object'
        ? nestedError
        : rpcError ?? {};
    const status = Number(
      remote.statusCode ??
        remote.status ??
        (rpcError as any)?.statusCode ??
        (rpcError as any)?.status
    );
    const rawMessage = remote.message ?? (rpcError as any)?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : typeof rawMessage === 'string'
      ? rawMessage
      : fallbackMessage;

    return new HttpException(
      message,
      Number.isInteger(status) && status >= 400 && status < 600
        ? status
        : HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
