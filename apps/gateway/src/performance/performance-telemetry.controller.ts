import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { EmailService } from '@optimistic-tanuki/email';
import {
  AuthCommands,
  NotificationCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { Public } from '../decorators/public.decorator';
import {
  PerformanceRumInput,
  RuntimeObservationInput,
  PerformanceTelemetryService,
} from './performance-telemetry.service';

@ApiTags('performance')
@Controller('performance')
export class PerformanceTelemetryController {
  private readonly notifiedAlertIds = new Set<string>();

  constructor(
    private readonly telemetry: PerformanceTelemetryService,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authenticationClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    private readonly emailService: EmailService
  ) {}

  @Public()
  @Post('rum')
  async record(
    @Body() input: PerformanceRumInput
  ): Promise<{ accepted: boolean }> {
    this.telemetry.record(input);
    return { accepted: true };
  }

  @Public()
  @Post('runtime')
  runtime(@Body() input: RuntimeObservationInput): { accepted: boolean } {
    this.telemetry.recordRuntime(input);
    return { accepted: true };
  }

  @Public()
  @Header('content-type', 'text/plain; version=0.0.4')
  @Get('prometheus')
  prometheus(): string {
    return this.telemetry.prometheus();
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('security.observability.read')
  @Get('summary')
  summary() {
    return this.telemetry.summaries();
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('security.observability.read')
  @Get('runtime')
  runtimeSummary() {
    return this.telemetry.runtimeSummaries();
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('security.observability.read')
  @Get('alerts')
  async alerts() {
    const alerts = this.telemetry.listAlerts();
    await Promise.all(
      alerts
        .filter((alert) => alert.state === 'active')
        .map((alert) => this.notifyOwnersOnce(alert))
    );
    return alerts;
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('security.observability.read')
  @Post('alerts/:id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.telemetry.acknowledge(id);
  }

  private async notifyOwners(
    alert: Awaited<
      ReturnType<PerformanceTelemetryService['listAlerts']>
    >[number]
  ): Promise<void> {
    const profiles = await firstValueFrom(
      this.profileClient.send(
        { cmd: ProfileCommands.GetAll },
        { where: { appScope: 'owner-console' } }
      )
    );
    const userIds = (profiles ?? [])
      .map((profile: { userId?: string }) => profile.userId)
      .filter((userId): userId is string => !!userId);
    const users = await firstValueFrom(
      this.authenticationClient.send(
        { cmd: AuthCommands.GetUsersByIds },
        { userIds }
      )
    );
    const userById = new Map(
      (users ?? []).map((user: { id: string; email: string }) => [
        user.id,
        user,
      ])
    );
    const recipients = (profiles ?? [])
      .map((profile: { userId?: string; id?: string }) =>
        userById.get(profile.userId ?? '')
      )
      .filter((user): user is { id: string; email: string } => !!user?.email);
    const title = `${
      alert.severity === 'critical' ? 'Critical' : 'Warning'
    } performance issue: ${alert.appId}`;
    const body = `${alert.metric.toUpperCase()} for ${
      alert.route
    } is ${Math.round(alert.observed)} (threshold ${Math.round(
      alert.threshold
    )}). Open Owner Console → Performance.`;
    await Promise.all(
      recipients.map(async (recipient) => {
        await firstValueFrom(
          this.socialClient.send(
            { cmd: NotificationCommands.CREATE },
            {
              recipientId: recipient.id,
              type: 'system',
              title,
              body,
              resourceType: 'performance-alert',
              resourceId: alert.id,
              actionUrl: '/dashboard/performance',
            }
          )
        );
        await this.emailService.sendEmail({
          to: recipient.email,
          subject: title,
          text: body,
          html: `<p>${body}</p><p><a href="/dashboard/performance">Open performance monitoring</a></p>`,
        });
      })
    );
  }

  private async notifyOwnersOnce(
    alert: Awaited<
      ReturnType<PerformanceTelemetryService['listAlerts']>
    >[number]
  ): Promise<void> {
    if (this.notifiedAlertIds.has(alert.id)) return;
    await this.notifyOwners(alert);
    this.notifiedAlertIds.add(alert.id);
  }
}
