import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppRegistration } from '../../../../../libs/app-registry/src/lib/app-registry.types';
import { DEFAULT_APP_REGISTRY } from '../../../../../libs/app-registry/src/lib/default-registry';

@ApiTags('registry')
@Controller('registry')
export class RegistryController {
  @ApiOperation({ summary: 'Get the application registry' })
  @ApiResponse({ status: 200, description: 'Application registry retrieved' })
  @Get('apps')
  getApps() {
    return {
      success: true,
      data: DEFAULT_APP_REGISTRY,
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
    const app = DEFAULT_APP_REGISTRY.apps.find(
      (registration) => registration.appId === appId
    );

    if (!app) {
      throw new NotFoundException(`Application ${appId} is not registered`);
    }

    return {
      success: true,
      data: app,
    };
  }
}
