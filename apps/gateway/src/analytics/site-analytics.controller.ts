import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { Public } from '../decorators/public.decorator';
import {
  SiteAnalyticsEventInput,
  SiteAnalyticsService,
} from './site-analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class SiteAnalyticsController {
  constructor(private readonly analytics: SiteAnalyticsService) {}

  @Public()
  @Post('events')
  record(@Body() input: SiteAnalyticsEventInput): { accepted: boolean } {
    this.analytics.record(input);
    return { accepted: true };
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('security.observability.read')
  @Get('summary')
  summary(@Query('appId') appId?: string) {
    return this.analytics.summary(appId);
  }
}
