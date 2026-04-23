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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AppRegistration,
  AppRegistry,
} from '../../../../../libs/app-registry/src/lib/app-registry.types';
import { NavigationLink } from '../../../../../libs/app-registry/src/lib/navigation.types';

export const GATEWAY_APP_REGISTRY = 'GATEWAY_APP_REGISTRY';
export const GATEWAY_NAVIGATION_LINKS = 'GATEWAY_NAVIGATION_LINKS';

interface NavigationLinksPayload {
  links: NavigationLink[];
}

interface AppRegistryPayload {
  registry: AppRegistry;
}

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags('registry')
@Controller('registry')
export class RegistryController {
  private navigationLinks: NavigationLink[];
  private registry: AppRegistry;

  constructor(
    @Inject(GATEWAY_APP_REGISTRY) registry: AppRegistry,
    @Inject(GATEWAY_NAVIGATION_LINKS) navigationLinks: NavigationLink[]
  ) {
    this.registry = registry;
    this.navigationLinks = [...navigationLinks];
  }

  @ApiOperation({ summary: 'Get the application registry' })
  @ApiResponse({ status: 200, description: 'Application registry retrieved' })
  @Get('apps')
  getApps(@Res({ passthrough: true }) response?: HeaderResponse) {
    this.setRegistryCacheHeaders(response);

    return {
      success: true,
      data: this.registry,
    };
  }

  @ApiOperation({ summary: 'Replace the runtime application registry' })
  @ApiResponse({ status: 201, description: 'Application registry updated' })
  @ApiResponse({ status: 400, description: 'Application registry is invalid' })
  @Post('apps')
  updateApps(
    @Body() payload: AppRegistryPayload
  ): { success: true; data: AppRegistry } {
    const registry = payload?.registry;

    this.validateRegistry(registry);
    this.navigationLinks.forEach((link) => this.validateLink(link, registry));
    this.registry = {
      ...registry,
      apps: [...registry.apps],
    };

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

  @ApiOperation({ summary: 'Get navigation links for an application' })
  @ApiResponse({ status: 200, description: 'Navigation links retrieved' })
  @ApiResponse({ status: 404, description: 'Application is not registered' })
  @Get('links/:sourceAppId')
  getLinksForApp(
    @Param('sourceAppId') sourceAppId: string
  ): { success: true; data: NavigationLink[] } {
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
  @Post('links')
  updateLinks(
    @Body() payload: NavigationLinksPayload
  ): { success: true; data: NavigationLink[] } {
    const links = payload?.links;

    if (!Array.isArray(links)) {
      throw new BadRequestException('Navigation links payload is required');
    }

    links.forEach((link) => this.validateLink(link));
    this.navigationLinks = [...links];

    return {
      success: true,
      data: this.navigationLinks,
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

  private validateRegistry(registry: AppRegistry | undefined): asserts registry is AppRegistry {
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
    return registry.apps.some(
      (registration) => registration.appId === appId
    );
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
    response.setHeader('ETag', `W/"app-registry-${this.registry.version}"`);
  }
}
