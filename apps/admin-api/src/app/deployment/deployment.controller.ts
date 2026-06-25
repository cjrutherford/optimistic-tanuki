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
  DeploymentService,
  ImageInfo,
  RolloutState,
} from './deployment.service';

@ApiTags('deployment')
@Controller()
export class DeploymentController {
  constructor(private readonly deploymentService: DeploymentService) {}

  @Get('api/status/public')
  @ApiOperation({ summary: 'Get public deployment status (legacy)' })
  @ApiResponse({ status: 200, description: 'Public status returned' })
  getPublicStatus() {
    const health = this.deploymentService.getHealth();
    const images = this.deploymentService.getImages();
    const enabledServices = images.map((img) => img.serviceId);
    const enabledProviders: string[] = [];

    return {
      deploymentName: 'production',
      namespace: 'optimistic-tanuki',
      provider: 'local',
      defaultTag: 'latest',
      serviceCount: enabledServices.length,
      appCount: 0,
      publicHosts: [],
      oauthEnabled: true,
      oauthProviders: enabledProviders.length,
    };
  }

  @Get('api/rollouts/preview')
  @ApiOperation({ summary: 'Preview a rollout (legacy)' })
  @ApiResponse({ status: 200, description: 'Rollout preview returned' })
  getRolloutPreview(@Query('tag') tag?: string) {
    const targetTag = tag || 'latest';
    const images = this.deploymentService.getImages();
    const services = images.map((img) => img.serviceId);
    const batchSize = 4;

    return {
      deploymentName: 'production',
      currentTag: 'latest',
      targetTag,
      strategy: 'scripts/docker-compose-deploy.sh',
      batchSize,
      services,
      waves: this.buildWaves(services, batchSize),
    };
  }

  @Get('api/rollouts/latest')
  @ApiOperation({ summary: 'Get latest rollout state (legacy)' })
  @ApiResponse({ status: 200, description: 'Latest rollout returned' })
  getLatestRollout() {
    const history = this.deploymentService.getRolloutHistory(1);
    if (history.length === 0) {
      return { status: 'pending' };
    }
    return history[0];
  }

  @Post('api/rollouts/start')
  @ApiOperation({ summary: 'Start a rollout (legacy)' })
  @ApiResponse({ status: 200, description: 'Rollout started' })
  startRollout(@Body('tag') tag?: string) {
    return {
      status: 'running',
      targetTag: tag || 'latest',
      services: this.deploymentService.getImages().map((img) => img.serviceId),
    };
  }

  @Get('api/oauth/inspect')
  @ApiOperation({ summary: 'Inspect OAuth configuration (legacy)' })
  @ApiResponse({ status: 200, description: 'OAuth inspection returned' })
  getOAuthInspect() {
    return {
      enabled: true,
      bridgeApp: 'client-interface',
      providers: [],
    };
  }

  @Get('api/deployment/health')
  @ApiOperation({ summary: 'Get deployment health' })
  @ApiResponse({ status: 200, description: 'Deployment health returned' })
  getHealth() {
    return this.deploymentService.getHealth();
  }

  @Get('api/rollouts/history')
  @ApiOperation({ summary: 'Get rollout history' })
  @ApiResponse({ status: 200, description: 'Rollout history returned' })
  getRolloutHistory(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.deploymentService.getRolloutHistory(limitNum);
  }

  @Get('api/deployment/images')
  @ApiOperation({ summary: 'Get image freshness information' })
  @ApiResponse({ status: 200, description: 'Image information returned' })
  getImages(): ImageInfo[] {
    return this.deploymentService.getImages();
  }

  private buildWaves(services: string[], batchSize: number): string[][] {
    const waves: string[][] = [];
    for (let i = 0; i < services.length; i += batchSize) {
      waves.push(services.slice(i, i + batchSize));
    }
    return waves;
  }
}
