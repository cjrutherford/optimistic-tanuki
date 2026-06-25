import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  OAuthService,
  OAuthAppsInfo,
  OAuthProviderInfo,
  OAuthTestResult,
  OAuthValidationResult,
} from './oauth.service';

@ApiTags('oauth')
@Controller()
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get('oauth/providers')
  @ApiOperation({ summary: 'Get OAuth provider status' })
  @ApiResponse({ status: 200, description: 'OAuth providers returned' })
  async getProviders(): Promise<{
    enabled: boolean;
    bridgeAppId: string;
    bridgeAppDomain: string;
    providers: OAuthProviderInfo[];
  }> {
    return this.oauthService.getProviders();
  }

  @Get('oauth/apps')
  @ApiOperation({ summary: 'Get OAuth-eligible apps' })
  @ApiResponse({ status: 200, description: 'OAuth apps returned' })
  async getApps(): Promise<OAuthAppsInfo> {
    return this.oauthService.getApps();
  }

  @Post('oauth/validate')
  @ApiOperation({ summary: 'Validate OAuth configuration' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validate(): Promise<OAuthValidationResult> {
    return this.oauthService.validate();
  }

  @Post('oauth/test')
  @ApiOperation({ summary: 'Test OAuth provider connectivity' })
  @ApiResponse({ status: 200, description: 'Test result' })
  async testProvider(
    @Body('provider') provider: string
  ): Promise<OAuthTestResult> {
    return this.oauthService.testProvider(provider);
  }
}
