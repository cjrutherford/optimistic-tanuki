import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import {
  SecurityEventQuery,
  SecurityTelemetryService,
} from './security-telemetry.service';

export const SECURITY_TELEMETRY_SERVICE = Symbol('SECURITY_TELEMETRY_SERVICE');

type EventQueryParams = Omit<SecurityEventQuery, 'limit'> & { limit?: string };

@Controller('security')
@UseGuards(AuthGuard, PermissionsGuard)
export class SecurityTelemetryController {
  constructor(
    @Inject(SECURITY_TELEMETRY_SERVICE)
    private readonly telemetry: SecurityTelemetryService
  ) {}

  @Get('events')
  @RequirePermissions('security.observability.read')
  listEvents(@Query() query: EventQueryParams) {
    return this.telemetry.listEvents(this.toEventQuery(query), {
      revealClientAddress: false,
    });
  }

  @Get('events/detailed')
  @RequirePermissions('security.enforcement.manage')
  listDetailedEvents(@Query() query: EventQueryParams) {
    return this.telemetry.listEvents(this.toEventQuery(query), {
      revealClientAddress: true,
    });
  }

  @Get('metrics')
  @RequirePermissions('security.observability.read')
  metrics(
    @Query() query: SecurityEventQuery & { bucket?: '1m' | '5m' | '15m' }
  ) {
    return this.telemetry.metrics(query);
  }

  private toEventQuery(query: EventQueryParams): SecurityEventQuery {
    return {
      ...query,
      limit: query.limit === undefined ? undefined : Number(query.limit),
    };
  }
}
