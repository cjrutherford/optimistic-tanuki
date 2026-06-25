import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { BootstrapService, BootstrapStatus } from './bootstrap.service';

@ApiTags('bootstrap')
@Controller()
export class BootstrapController {
  constructor(private readonly bootstrapService: BootstrapService) {}

  @Get('bootstrap/status')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiOperation({ summary: 'Get bootstrap status' })
  @ApiResponse({ status: 200, description: 'Bootstrap status returned' })
  async getStatus(): Promise<{
    configured: boolean;
    phase: string;
    checks: BootstrapStatus['checks'];
  }> {
    return this.bootstrapService.getStatus();
  }

  @Post('bootstrap/scaffold')
  @ApiOperation({ summary: 'Scaffold initial deployment config and secrets' })
  @ApiResponse({ status: 201, description: 'Config and secrets scaffolded' })
  async scaffoldConfig(
    @Body()
    body: {
      name: string;
      target: 'compose' | 'k8s';
      operatorName: string;
      operatorEmail: string;
      services: string[];
    }
  ) {
    const result = await this.bootstrapService.scaffoldConfig({
      name: body.name,
      target: body.target,
      operatorName: body.operatorName,
      operatorEmail: body.operatorEmail,
      services: body.services,
    });
    return { success: true, data: result };
  }

  @Get('bootstrap/state')
  @ApiOperation({ summary: 'Read deployment config (pre-config)' })
  @ApiResponse({ status: 200, description: 'Deployment config returned' })
  async getState() {
    const config = await this.bootstrapService.loadConfig();
    return { success: true, data: config };
  }

  @Put('bootstrap/state')
  @ApiOperation({ summary: 'Write deployment config (pre-config)' })
  @ApiResponse({ status: 200, description: 'Deployment config saved' })
  async putState(@Body() config: unknown) {
    await this.bootstrapService.saveConfig(
      config as Parameters<BootstrapService['saveConfig']>[0]
    );
    return { success: true };
  }

  @Get('bootstrap/secrets')
  @ApiOperation({ summary: 'Read secrets (masked)' })
  @ApiResponse({ status: 200, description: 'Secrets returned (masked)' })
  async getSecrets() {
    const secrets = await this.bootstrapService.loadSecrets();
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(secrets)) {
      masked[key] = this.maskSecret(value);
    }
    return { success: true, data: masked };
  }

  @Put('bootstrap/secrets')
  @ApiOperation({ summary: 'Write secrets' })
  @ApiResponse({ status: 200, description: 'Secrets saved' })
  async putSecrets(@Body() secrets: Record<string, string>) {
    await this.bootstrapService.saveSecrets(secrets);
    return { success: true };
  }

  @Post('bootstrap/validate')
  @ApiOperation({ summary: 'Validate deployment config' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validate() {
    return this.bootstrapService.validate();
  }

  @Post('bootstrap/build-images')
  @ApiOperation({ summary: 'Trigger image build/pull' })
  @ApiResponse({ status: 200, description: 'Build result' })
  async buildImages() {
    return this.bootstrapService.buildImages();
  }

  @Post('bootstrap/infra-compose')
  @ApiOperation({ summary: 'Provision Docker Compose infrastructure' })
  @ApiResponse({ status: 200, description: 'Infrastructure provisioned' })
  async infraCompose() {
    return this.bootstrapService.provisionInfraCompose();
  }

  @Post('bootstrap/infra-k8s')
  @ApiOperation({ summary: 'Provision Kubernetes infrastructure' })
  @ApiResponse({ status: 200, description: 'Infrastructure provisioned' })
  async infraK8s(@Query('kubeconfig') kubeconfig?: string) {
    return this.bootstrapService.provisionInfraK8s(kubeconfig);
  }

  @Post('bootstrap/init-databases')
  @ApiOperation({ summary: 'Initialize databases and run migrations' })
  @ApiResponse({ status: 200, description: 'Databases initialized' })
  async initDatabases() {
    return this.bootstrapService.initDatabases();
  }

  @Post('bootstrap/deploy')
  @ApiOperation({ summary: 'Run initial deployment' })
  @ApiResponse({ status: 200, description: 'Deployment started' })
  async deploy() {
    return this.bootstrapService.deployServices();
  }

  @Post('bootstrap/deploy-all')
  @ApiOperation({
    summary: 'Run full deployment pipeline: build, infra, db, deploy',
  })
  @ApiResponse({ status: 200, description: 'Deployment result' })
  async deployAll() {
    const build = await this.bootstrapService.buildImages();
    if (!build.success) return { phase: 'build-images', ...build };

    const infra = await this.bootstrapService.provisionInfraCompose();
    if (!infra.success) return { phase: 'infra-compose', ...infra };

    const db = await this.bootstrapService.initDatabases();
    if (!db.success) return { phase: 'init-databases', ...db };

    return this.bootstrapService.deployServices();
  }

  @Post('bootstrap/owner')
  @ApiOperation({
    summary: 'Create platform owner profile via gateway registration',
  })
  @ApiResponse({ status: 201, description: 'Owner created' })
  async createOwner(
    @Body() body: { name: string; email: string; password: string }
  ) {
    const result = await this.bootstrapService.createOwner(
      body.name,
      body.email,
      body.password
    );
    return result;
  }

  @Post('bootstrap/owner/activate')
  @ApiOperation({ summary: 'Activate platform owner and mark setup complete' })
  @ApiResponse({
    status: 200,
    description: 'Owner activated and setup marked complete',
  })
  async activateOwner() {
    await this.bootstrapService.completeSetup();
    return { activated: true, profile: {} };
  }

  @Put('bootstrap/oauth/configure')
  @ApiOperation({ summary: 'Configure OAuth provider credentials' })
  @ApiResponse({ status: 200, description: 'OAuth provider configured' })
  async configureOAuth(
    @Body()
    body: {
      provider: string;
      enabled: boolean;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }
  ) {
    await this.bootstrapService.configureOAuthProvider(body.provider, {
      enabled: body.enabled,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      redirectUri: body.redirectUri,
    });
    return { success: true };
  }

  private maskSecret(value: string): string {
    if (!value || value.length <= 4) return '****';
    return '****' + value.slice(-4);
  }
}
