import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AppRegistration,
  AppRegistry,
  PublishRegistryDto,
  RegistryReleaseBundle,
  RegistryReleaseState,
  NavigationLink,
  RollbackRegistryDto,
} from '@optimistic-tanuki/app-registry-backend';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';

export const GATEWAY_APP_REGISTRY = 'GATEWAY_APP_REGISTRY';
export const GATEWAY_NAVIGATION_LINKS = 'GATEWAY_NAVIGATION_LINKS';

interface NavigationLinksPayload {
  links: NavigationLink[];
}

interface AppRegistryPayload {
  registry: AppRegistry;
}

export interface RegistryAuditEntry {
  id: number;
  occurredAt: string;
  action: 'apps.updated' | 'links.updated';
  summary: string;
  metadata: Record<string, string | number | boolean>;
}

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('registry')
@Controller('registry')
export class RegistryController {
  private auditLog: RegistryAuditEntry[] = [];
  private nextAuditId = 1;
  private navigationLinks: NavigationLink[];
  private release: RegistryReleaseState;
  private registry: AppRegistry;

  constructor(
    @Inject(GATEWAY_APP_REGISTRY) registry: AppRegistry,
    @Inject(GATEWAY_NAVIGATION_LINKS) navigationLinks: NavigationLink[]
  ) {
    this.registry = registry;
    this.navigationLinks = [...navigationLinks];
    this.release = this.createInitialReleaseState(registry, navigationLinks);
  }

  @ApiOperation({ summary: 'Get the application registry' })
  @ApiResponse({ status: 200, description: 'Application registry retrieved' })
  @Get('apps')
  getApps(@Res({ passthrough: true }) response?: HeaderResponse) {
    this.setRegistryCacheHeaders(response);

    return {
      success: true,
      data: this.registry,
      release: this.release,
    };
  }

  @ApiOperation({ summary: 'Replace the runtime application registry' })
  @ApiResponse({ status: 201, description: 'Application registry updated' })
  @ApiResponse({ status: 400, description: 'Application registry is invalid' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Post('apps')
  updateApps(@Body() payload: AppRegistryPayload): {
    success: true;
    data: AppRegistry;
  } {
    const registry = payload?.registry;

    this.validateRegistry(registry);
    this.navigationLinks.forEach((link) => this.validateLink(link, registry));
    this.registry = {
      ...registry,
      apps: [...registry.apps],
    };
    this.release = this.buildUpdatedReleaseState(
      this.registry,
      this.navigationLinks
    );
    this.recordAudit(
      'apps.updated',
      `Updated application registry to version ${this.registry.version}`,
      {
        version: this.registry.version,
        appCount: this.registry.apps.length,
      }
    );

    return {
      success: true,
      data: this.registry,
    };
  }

  @ApiOperation({ summary: 'Get a registered application by ID' })
  @ApiResponse({ status: 200, description: 'Registered application found' })
  @ApiResponse({ status: 404, description: 'Registered application not found' })
  @Get('apps/:appId')
  getApp(@Param('appId') appId: string): {
    success: true;
    data: AppRegistration;
  } {
    const app = this.assertRegisteredApp(appId);

    return {
      success: true,
      data: app,
    };
  }

  @ApiOperation({ summary: 'Get registered navigation links' })
  @ApiResponse({ status: 200, description: 'Navigation links retrieved' })
  @Get('links')
  getLinks(): { success: true; data: NavigationLink[] } {
    return {
      success: true,
      data: this.navigationLinks,
    };
  }

  @ApiOperation({ summary: 'Get application registry audit log' })
  @ApiResponse({ status: 200, description: 'Registry audit log retrieved' })
  @Get('audit-log')
  getAuditLog(): { success: true; data: RegistryAuditEntry[] } {
    return {
      success: true,
      data: [...this.auditLog],
    };
  }

  @ApiOperation({ summary: 'Get navigation links for an application' })
  @ApiResponse({ status: 200, description: 'Navigation links retrieved' })
  @ApiResponse({ status: 404, description: 'Application is not registered' })
  @Get('links/:sourceAppId')
  getLinksForApp(@Param('sourceAppId') sourceAppId: string): {
    success: true;
    data: NavigationLink[];
  } {
    this.assertRegisteredApp(sourceAppId);

    return {
      success: true,
      data: this.navigationLinks.filter(
        (link) => link.sourceAppId === sourceAppId
      ),
    };
  }

  @ApiOperation({ summary: 'Replace registered navigation links' })
  @ApiResponse({ status: 201, description: 'Navigation links updated' })
  @ApiResponse({ status: 400, description: 'Navigation links are invalid' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Post('links')
  updateLinks(@Body() payload: NavigationLinksPayload): {
    success: true;
    data: NavigationLink[];
  } {
    const links = payload?.links;

    if (!Array.isArray(links)) {
      throw new BadRequestException('Navigation links payload is required');
    }

    links.forEach((link) => this.validateLink(link));
    this.navigationLinks = [...links];
    this.release = this.buildUpdatedReleaseState(
      this.registry,
      this.navigationLinks
    );
    this.recordAudit(
      'links.updated',
      `Updated ${links.length} navigation ${
        links.length === 1 ? 'link' : 'links'
      }`,
      { linkCount: links.length }
    );

    return {
      success: true,
      data: this.navigationLinks,
    };
  }

  @ApiOperation({ summary: 'Publish the current registry snapshot' })
  @ApiResponse({ status: 201, description: 'Registry snapshot published' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Post('publish')
  publishRegistry(@Body() payload: PublishRegistryDto): {
    success: true;
    data: RegistryReleaseBundle;
  } {
    if (!payload?.releaseNotes?.trim()) {
      throw new BadRequestException('Release notes are required');
    }

    const version = (this.release.publishedVersion ?? 0) + 1;
    const publishedAt = new Date().toISOString();
    const revision = {
      version,
      status: 'published' as const,
      publishedAt,
      releasedAt: publishedAt,
      releaseNotes: payload.releaseNotes.trim(),
      changeSummary: payload.changeSummary?.trim() || undefined,
      snapshot: this.createSnapshot(this.registry, this.navigationLinks),
    };

    this.release = {
      status: 'published',
      previewUrl: this.buildPreviewUrl(this.registry),
      publishedVersion: version,
      publishedAt,
      releaseNotes: revision.releaseNotes,
      changeSummary: revision.changeSummary,
      history: [revision, ...(this.release.history ?? [])],
    };

    this.recordAudit('apps.updated', `Published registry release v${version}`, {
      version,
      appCount: this.registry.apps.length,
    });

    return {
      success: true,
      data: this.currentReleaseBundle(),
    };
  }

  @ApiOperation({ summary: 'Rollback the registry to a published revision' })
  @ApiResponse({ status: 201, description: 'Registry rolled back' })
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('registry.manage')
  @Post('rollback')
  rollbackRegistry(@Body() payload: RollbackRegistryDto): {
    success: true;
    data: RegistryReleaseBundle;
  } {
    const revision = this.release.history.find(
      (entry) => entry.version === payload?.version
    );
    if (!revision) {
      throw new NotFoundException(
        `Registry release ${payload?.version} was not found`
      );
    }

    this.registry = this.clone(revision.snapshot.registry);
    this.navigationLinks = this.clone(revision.snapshot.links);
    this.release = {
      ...this.release,
      status: 'published',
      previewUrl: this.buildPreviewUrl(this.registry),
      publishedVersion: revision.version,
      publishedAt: revision.publishedAt,
      releaseNotes: revision.releaseNotes,
      changeSummary: revision.changeSummary,
    };

    this.recordAudit(
      'apps.updated',
      `Rolled registry back to release v${revision.version}`,
      {
        version: revision.version,
        reason: payload.releaseNotes,
      }
    );

    return {
      success: true,
      data: this.currentReleaseBundle(),
    };
  }

  private validateLink(
    link: NavigationLink,
    registry: AppRegistry = this.registry
  ): void {
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

  private currentReleaseBundle(): RegistryReleaseBundle {
    return {
      registry: this.registry,
      links: this.navigationLinks,
      release: this.release,
    };
  }

  private createInitialReleaseState(
    registry: AppRegistry,
    links: NavigationLink[]
  ): RegistryReleaseState {
    return {
      status: 'draft',
      previewUrl: this.buildPreviewUrl(registry),
      history: [],
    };
  }

  private buildUpdatedReleaseState(
    registry: AppRegistry,
    links: NavigationLink[]
  ): RegistryReleaseState {
    const status =
      this.release?.history?.length &&
      !this.snapshotsEqual(
        this.release.history[0].snapshot,
        this.createSnapshot(registry, links)
      )
        ? 'changes-pending'
        : this.release?.publishedVersion
        ? 'published'
        : 'draft';

    return {
      ...this.release,
      status,
      previewUrl: this.buildPreviewUrl(registry),
    };
  }

  private createSnapshot(
    registry: AppRegistry,
    links: NavigationLink[]
  ): { registry: AppRegistry; links: NavigationLink[] } {
    return {
      registry: this.clone(registry),
      links: this.clone(links),
    };
  }

  private snapshotsEqual(
    left: { registry: AppRegistry; links: NavigationLink[] },
    right: { registry: AppRegistry; links: NavigationLink[] }
  ): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private buildPreviewUrl(registry: AppRegistry): string | undefined {
    return registry.apps.find((app) => app.visibility === 'public')?.uiBaseUrl;
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

  private assertRegisteredApp(appId: string): AppRegistration {
    const app = this.registry.apps.find(
      (registration) => registration.appId === appId
    );

    if (!app) {
      throw new NotFoundException(`Application ${appId} is not registered`);
    }

    return app;
  }

  private isRegisteredApp(
    appId: string,
    registry: AppRegistry = this.registry
  ): boolean {
    return registry.apps.some((registration) => registration.appId === appId);
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

  private recordAudit(
    action: RegistryAuditEntry['action'],
    summary: string,
    metadata: RegistryAuditEntry['metadata']
  ): void {
    this.auditLog.unshift({
      id: this.nextAuditId,
      occurredAt: new Date().toISOString(),
      action,
      summary,
      metadata,
    });
    this.nextAuditId += 1;
  }

  private setRegistryCacheHeaders(response?: HeaderResponse): void {
    if (!response) {
      return;
    }

    response.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300'
    );
    response.setHeader('X-App-Registry-Version', this.registry.version);
    const etagValue = `${this.registry.version}-${this.registry.generatedAt}`;
    response.setHeader('ETag', `W/"app-registry-${etagValue}"`);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
