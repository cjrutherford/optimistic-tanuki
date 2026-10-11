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
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { Public } from '../decorators/public.decorator';
import {
  SiteAnalyticsEventInput,
  SiteAnalyticsService,
} from './site-analytics.service';

/**
 * Per-client limit for the anonymous event endpoint. The gateway does not
 * trust forwarding headers, so behind the HAI server or an ingress many
 * visitors share one tracked address; the limits are generous for that
 * reason. They are defence in depth: storage is bounded by the service's
 * per-tier budgets and overflow counters, not by this limit.
 */
const EVENT_THROTTLE = {
  short: { limit: 25, ttl: 1000 },
  long: { limit: 600, ttl: 60000 },
};

@ApiTags('analytics')
@Controller('analytics')
export class SiteAnalyticsController {
  private readonly logger = new Logger(SiteAnalyticsController.name);

  constructor(private readonly analytics: SiteAnalyticsService) {}

  @Public()
  @Throttle(EVENT_THROTTLE)
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
