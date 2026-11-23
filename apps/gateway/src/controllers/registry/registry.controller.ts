import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  NotFoundException,
  OnApplicationBootstrap,
  Param,
  Post,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AppRegistration,
  AppRegistry,
  AppRegistryOrigin,
  PublishRegistryDto,
  RegistryAuditRecord,
  RegistryDriftReport,
  RegistryReleaseBundle,
  RegistryReleaseState,
  RegistrySourceSnapshot,
  RegistryYamlExport,
  NavigationLink,
  RollbackRegistryDto,
} from '@optimistic-tanuki/app-registry-backend';
import { AppConfigCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import {
  GATEWAY_APP_REGISTRY,
  GATEWAY_NAVIGATION_LINKS,
} from './registry.tokens';

export {
  GATEWAY_APP_REGISTRY,
  GATEWAY_NAVIGATION_LINKS,
} from './registry.tokens';

interface NavigationLinksPayload {
  links: NavigationLink[];
  /** Why the draft changed; stored on the audit row. */
  reason?: string;
}

interface AppRegistryPayload {
  registry: AppRegistry;
  /** Why the draft changed; stored on the audit row. */
  reason?: string;
}

/** The audit row as the console reads it. Superset of the original shape. */
export type RegistryAuditEntry = RegistryAuditRecord;

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

interface RegistryRead {
  bundle: RegistryReleaseBundle;
  origin: AppRegistryOrigin;
}

/** How long a registry command may take before the gateway gives up. */
const REGISTRY_TIMEOUT_MS = 5_000;
@ApiTags('registry')
@Controller('registry')
export class RegistryController implements OnApplicationBootstrap {
  private readonly logger = new Logger(RegistryController.name);
  private seeded = false;
  private lastGood: RegistryReleaseBundle | null = null;

  constructor(
    /** The registry the deployment ships (apps.yaml, generated to JSON). */
    @Inject(GATEWAY_APP_REGISTRY)
    private readonly deployedRegistry: AppRegistry,
    @Inject(GATEWAY_NAVIGATION_LINKS)
    private readonly deployedLinks: NavigationLink[],
    @Inject(ServiceTokens.APP_CONFIGURATOR_SERVICE)
    private readonly client: ClientProxy
  ) {}

  onApplicationBootstrap(): void {
    // The service may still be starting; reads retry the seed lazily.
    this.ensureSeeded().catch((error) =>
      this.logger.warn(
        `Could not seed the app registry at boot; it will retry on the next read: ${this.describe(
          error
        )}`
      )
    );
  }

  @ApiOperation({ summary: 'Get the application registry' })
  @ApiResponse({ status: 200, description: 'Application registry retrieved' })
  @Get('apps')
  async getApps(@Res({ passthrough: true }) response?: HeaderResponse) {
    const { bundle, origin } = await this.read();
    this.setRegistryCacheHeaders(bundle.registry, response);

    return {
      success: true,
      data: bundle.registry,
      release: bundle.release,
      origin,
    };
  }

  @ApiOperation({ summary: 'Replace the application registry draft' })
  @ApiResponse({ status: 201, description: 'Application registry updated' })
  @ApiResponse({ status: 400, description: 'Application registry is invalid' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Post('apps')
  async updateApps(
    @Body() payload: AppRegistryPayload,
    @User() user?: UserDetails
  ): Promise<{
    success: true;
    data: AppRegistry;
    release: RegistryReleaseState;
  }> {
    const registry = payload?.registry;

    this.validateRegistry(registry);
    const current = await this.readStrict();
    current.links.forEach((link) => this.validateLink(link, registry));
    const bundle = await this.command<RegistryReleaseBundle>(
      AppConfigCommands.RegistrySaveDraft,
      {
        actor: this.actor(user),
        registry: { ...registry, apps: [...registry.apps] },
        reason: payload.reason,
      }
    );
    this.lastGood = bundle;

    return {
      success: true,
      data: bundle.registry,
      release: bundle.release,
    };
  }

  @ApiOperation({ summary: 'Get a registered application by ID' })
  @ApiResponse({ status: 200, description: 'Registered application found' })
  @ApiResponse({ status: 404, description: 'Registered application not found' })
  @Get('apps/:appId')
  async getApp(@Param('appId') appId: string): Promise<{
    success: true;
    data: AppRegistration;
  }> {
    const { bundle } = await this.read();

    return {
      success: true,
      data: this.assertRegisteredApp(bundle.registry, appId),
    };
  }

  @ApiOperation({ summary: 'Get registered navigation links' })
  @ApiResponse({ status: 200, description: 'Navigation links retrieved' })
  @Get('links')
  async getLinks(): Promise<{ success: true; data: NavigationLink[] }> {
    const { bundle } = await this.read();
    return {
      success: true,
      data: bundle.links,
    };
  }

  @ApiOperation({ summary: 'Get application registry audit log' })
  @ApiResponse({ status: 200, description: 'Registry audit log retrieved' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Get('audit-log')
  async getAuditLog(): Promise<{
    success: true;
    data: RegistryAuditEntry[];
  }> {
    await this.ensureSeeded();
    return {
      success: true,
      data: await this.command<RegistryAuditEntry[]>(
        AppConfigCommands.RegistryAuditList,
        {}
      ),
    };
  }

  @ApiOperation({
    summary: 'Compare the deployed YAML with the database registry',
  })
  @ApiResponse({ status: 200, description: 'Drift report' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Get('drift')
  async getDrift(): Promise<{ success: true; data: RegistryDriftReport }> {
    await this.ensureSeeded();
    return {
      success: true,
      data: await this.command<RegistryDriftReport>(
        AppConfigCommands.RegistryDrift,
        { source: this.source() }
      ),
    };
  }

  @ApiOperation({
    summary: 'Export the published registry as apps.yaml with a diff',
  })
  @ApiResponse({ status: 200, description: 'YAML export' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Get('export')
  async exportYaml(): Promise<{ success: true; data: RegistryYamlExport }> {
    await this.ensureSeeded();
    return {
      success: true,
      data: await this.command<RegistryYamlExport>(
        AppConfigCommands.RegistryExportYaml,
        { source: this.source() }
      ),
    };
  }

  @ApiOperation({ summary: 'Get navigation links for an application' })
  @ApiResponse({ status: 200, description: 'Navigation links retrieved' })
  @ApiResponse({ status: 404, description: 'Application is not registered' })
  @Get('links/:sourceAppId')
  async getLinksForApp(@Param('sourceAppId') sourceAppId: string): Promise<{
    success: true;
    data: NavigationLink[];
  }> {
    const { bundle } = await this.read();
    this.assertRegisteredApp(bundle.registry, sourceAppId);

    return {
      success: true,
      data: bundle.links.filter((link) => link.sourceAppId === sourceAppId),
    };
  }

  @ApiOperation({ summary: 'Replace registered navigation links' })
  @ApiResponse({ status: 201, description: 'Navigation links updated' })
  @ApiResponse({ status: 400, description: 'Navigation links are invalid' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Post('links')
  async updateLinks(
    @Body() payload: NavigationLinksPayload,
    @User() user?: UserDetails
  ): Promise<{
    success: true;
    data: NavigationLink[];
  }> {
    const links = payload?.links;

    if (!Array.isArray(links)) {
      throw new BadRequestException('Navigation links payload is required');
    }

    const current = await this.readStrict();
    links.forEach((link) => this.validateLink(link, current.registry));
    const bundle = await this.command<RegistryReleaseBundle>(
      AppConfigCommands.RegistrySaveDraft,
      { actor: this.actor(user), links: [...links], reason: payload.reason }
    );
    this.lastGood = bundle;

    return {
      success: true,
      data: bundle.links,
    };
  }

  @ApiOperation({ summary: 'Publish the current registry snapshot' })
  @ApiResponse({ status: 201, description: 'Registry snapshot published' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Post('publish')
  async publishRegistry(
    @Body() payload: PublishRegistryDto,
    @User() user?: UserDetails
  ): Promise<{
    success: true;
    data: RegistryReleaseBundle;
  }> {
    if (!payload?.releaseNotes?.trim()) {
      throw new BadRequestException('Release notes are required');
    }

    await this.readStrict();
    const bundle = await this.command<RegistryReleaseBundle>(
      AppConfigCommands.RegistryPublish,
      {
        actor: this.actor(user),
        releaseNotes: payload.releaseNotes,
        changeSummary: payload.changeSummary,
        reason: payload.reason,
        source: this.source(),
      }
    );
    this.lastGood = bundle;

    return { success: true, data: bundle };
  }

  @ApiOperation({ summary: 'Rollback the registry to a published revision' })
  @ApiResponse({ status: 201, description: 'Registry rolled back' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Post('rollback')
  async rollbackRegistry(
    @Body() payload: RollbackRegistryDto,
    @User() user?: UserDetails
  ): Promise<{
    success: true;
    data: RegistryReleaseBundle;
  }> {
    await this.readStrict();
    const bundle = await this.command<RegistryReleaseBundle>(
      AppConfigCommands.RegistryRollback,
      {
        actor: this.actor(user),
        version: payload?.version,
        releaseNotes: payload?.releaseNotes,
        reason: payload?.reason,
        source: this.source(),
      }
    );
    this.lastGood = bundle;

    return { success: true, data: bundle };
  }

  /** The deployed YAML, as the service compares and seeds from it. */
  private source(): RegistrySourceSnapshot {
    return { registry: this.deployedRegistry, links: this.deployedLinks };
  }

  private actor(user?: UserDetails | null): string {
    return user?.email || user?.userId || 'unknown';
  }

  /** Seeds the database from the YAML once; a no-op when already seeded. */
  private async ensureSeeded(): Promise<void> {
    if (this.seeded) {
      return;
    }
    await this.command(AppConfigCommands.RegistrySeed, {
      source: this.source(),
    });
    this.seeded = true;
  }

  /**
   * Public read. If the registry service is down this serves the last good
   * copy, or the deployed YAML, and logs a warning so it is never silent.
   */
  private async read(): Promise<RegistryRead> {
    try {
      await this.ensureSeeded();
      const bundle = await this.command<RegistryReleaseBundle | null>(
        AppConfigCommands.RegistryGet,
        {}
      );
      if (!bundle) {
        throw new Error('the registry service returned no registry');
      }
      this.lastGood = bundle;
      return { bundle, origin: 'database' };
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) {
        throw error;
      }
      const origin: AppRegistryOrigin = this.lastGood
        ? 'cache'
        : 'yaml-fallback';
      this.logger.warn(
        `App registry service unavailable (${this.describe(error)}); serving ${
          this.lastGood
            ? 'the last known registry'
            : 'the deployed YAML registry'
        }`
      );
      return {
        bundle: this.lastGood ?? this.fallbackBundle(),
        origin,
      };
    }
  }

  /** For writes: the live registry, or a 503. Never the fallback. */
  private async readStrict(): Promise<RegistryReleaseBundle> {
    await this.ensureSeeded();
    const bundle = await this.command<RegistryReleaseBundle | null>(
      AppConfigCommands.RegistryGet,
      {}
    );
    if (!bundle) {
      throw new ServiceUnavailableException(
        'The application registry has not been seeded yet'
      );
    }
    return bundle;
  }

  private fallbackBundle(): RegistryReleaseBundle {
    return {
      registry: this.clone(this.deployedRegistry),
      links: this.clone(this.deployedLinks),
      release: {
        status: 'draft',
        previewUrl: this.deployedRegistry.apps.find(
          (app) => app.visibility === 'public'
        )?.uiBaseUrl,
        history: [],
      },
    };
  }

  private async command<T>(cmd: string, payload: unknown): Promise<T> {
    try {
      return await firstValueFrom(
        this.client.send<T>({ cmd }, payload).pipe(timeout(REGISTRY_TIMEOUT_MS))
      );
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /** 4xx from the service pass through; anything else is "unavailable". */
  private toHttpException(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    const remote = (error ?? {}) as {
      statusCode?: number;
      status?: number;
      message?: string | string[];
    };
    const status = Number(remote.statusCode ?? remote.status);
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      const message = Array.isArray(remote.message)
        ? remote.message.join(', ')
        : remote.message ?? 'Registry request rejected';
      return new HttpException(message, status);
    }
    return new ServiceUnavailableException(
      `The application registry service is unavailable: ${this.describe(error)}`
    );
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private validateLink(link: NavigationLink, registry: AppRegistry): void {
    if (!link.linkId || !link.sourceAppId || !link.targetAppId || !link.label) {
      throw new BadRequestException(
        'Navigation links require linkId, sourceAppId, targetAppId, and label'
      );
    }

    if (
      !this.isRegisteredApp(link.sourceAppId, registry) ||
      !this.isRegisteredApp(link.targetAppId, registry)
    ) {
      throw new BadRequestException(
        'Navigation links must reference registered applications'
      );
    }
  }

  private validateRegistry(
    registry: AppRegistry | undefined
  ): asserts registry is AppRegistry {
    if (!registry || !registry.version || !Array.isArray(registry.apps)) {
      throw new BadRequestException(
        'Application registry requires version and apps'
      );
    }

    const appIds = new Set<string>();
    for (const app of registry.apps) {
      if (
        !app.appId ||
        !app.name ||
        !app.domain ||
        !app.uiBaseUrl ||
        !app.apiBaseUrl ||
        !app.appType ||
        !app.visibility
      ) {
        throw new BadRequestException(
          'Registered apps require appId, name, domain, uiBaseUrl, apiBaseUrl, appType, and visibility'
        );
      }

      this.validateDomain(app);
      this.validateAppUrl(app.uiBaseUrl, app, 'uiBaseUrl');
      this.validateAbsoluteUrl(app.apiBaseUrl, `${app.appId} apiBaseUrl`);
      if (app.iconUrl) {
        this.validateAbsoluteUrl(app.iconUrl, `${app.appId} iconUrl`);
      }

      if (appIds.has(app.appId)) {
        throw new BadRequestException(
          `Duplicate registered app id ${app.appId}`
        );
      }
      appIds.add(app.appId);
    }
  }

  private validateDomain(app: AppRegistration): void {
    const domain = app.domain.trim();
    const isLocalhost = domain === 'localhost';
    const domainPattern =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

    if (!isLocalhost && !domainPattern.test(domain)) {
      throw new BadRequestException(
        `Registered app ${app.appId} has invalid domain ${app.domain}`
      );
    }
  }

  private validateAppUrl(
    value: string,
    app: AppRegistration,
    fieldName: string
  ): void {
    const url = this.validateAbsoluteUrl(value, `${app.appId} ${fieldName}`);
    const expectedHost = app.subdomain
      ? `${app.subdomain}.${app.domain}`
      : app.domain;

    if (url.hostname !== expectedHost) {
      throw new BadRequestException(
        `Registered app ${app.appId} ${fieldName} host must match ${expectedHost}`
      );
    }
  }

  private validateAbsoluteUrl(value: string, label: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(`${label} must be an absolute URL`);
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException(`${label} must use http or https`);
    }

    return url;
  }

  private assertRegisteredApp(
    registry: AppRegistry,
    appId: string
  ): AppRegistration {
    const app = registry.apps.find(
      (registration) => registration.appId === appId
    );

    if (!app) {
      throw new NotFoundException(`Application ${appId} is not registered`);
    }

    return app;
  }

  private isRegisteredApp(appId: string, registry: AppRegistry): boolean {
    return registry.apps.some((registration) => registration.appId === appId);
  }

  private setRegistryCacheHeaders(
    registry: AppRegistry,
    response?: HeaderResponse
  ): void {
    if (!response) {
      return;
    }

    response.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300'
    );
    response.setHeader('X-App-Registry-Version', registry.version);
    const etagValue = `${registry.version}-${registry.generatedAt}`;
    response.setHeader('ETag', `W/"app-registry-${etagValue}"`);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
