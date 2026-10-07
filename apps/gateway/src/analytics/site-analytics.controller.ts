import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  private readonly logger = new Logger(SiteAnalyticsController.name);

  constructor(private readonly analytics: SiteAnalyticsService) {}

  @Public()
  @Post('events')
  async record(
    @Body() input: SiteAnalyticsEventInput
  ): Promise<{ accepted: boolean }> {
    try {
      await this.analytics.record(input);
      return { accepted: true };
    } catch (error) {
      // Invalid events are rejected; a store outage must never break pages,
      // which send beacons and ignore the response.
      if ((error as { status?: number }).status === 400) throw error;
      this.logger.warn(
        `Site analytics store unavailable: ${(error as Error).message}`
      );
      return { accepted: false };
    }
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('security.observability.read')
  @Get('summary')
  summary(@Query('appId') appId?: string) {
    return this.analytics.summary(appId);
  }
}
